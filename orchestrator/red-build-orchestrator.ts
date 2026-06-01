import type { BuildError, RootCauseAnalysis } from "@ear-build/shared";
import type { BuildAnalyzerService } from "../services/mcp-jenkins/src/domain/services/build-analyzer.service.js";
import type { SvnClientPort } from "../services/mcp-svn/src/ports/outbound/svn-client.port.js";
import type { GraphIndexerService } from "../services/mcp-graphify/src/domain/services/graph-indexer.service.js";
import type { RootCauseAnalyzerService } from "../services/mcp-graphify/src/domain/services/root-cause-analyzer.service.js";
import type { IssueTrackerService } from "../services/mcp-jira/src/domain/services/issue-tracker.service.js";

/**
 * Reference orchestration of the "red build" circle.
 *
 * In production the MCP client (VS Code + Copilot) drives this by calling the
 * four MCP servers' tools in sequence. This module is the same flow expressed
 * in code, depending only on PORTS / domain services — so it runs against the
 * real adapters (Jenkins API, SVN CLI, Neo4j) or against in-memory doubles
 * with no change. That decoupling is the point of the hexagonal layering.
 *
 *   Jenkins → parse build log
 *   SVN     → index the repository (cat HEAD of every source file)
 *   Graphify→ root-cause analysis over the dependency graph
 *   SVN     → blame the most-recently-changed suspect  ⇒ who broke it
 *   Jira    → open a bug assigned to that author, with the analysis attached
 */
export interface OrchestratorDeps {
  buildAnalyzer: BuildAnalyzerService;
  svn: SvnClientPort;
  indexer: GraphIndexerService;
  rootCause: RootCauseAnalyzerService;
  issueTracker: IssueTrackerService;
}

export interface DiagnoseParams {
  jobName: string;
  buildNumber: number;
  /** Prefix stripped from build-log file paths to obtain repo-relative paths. */
  workspacePrefix: string;
  jiraProjectKey: string;
  /** Open a Jira ticket for the failure (default true). */
  createTicket?: boolean;
}

export interface Culprit {
  file: string;
  author: string;
  revision: number;
  message: string;
  blame: string;
  diff: string;
}

export interface RedBuildDiagnosis {
  jobName: string;
  buildNumber: number;
  errors: BuildError[];
  analysis: RootCauseAnalysis;
  culprit: Culprit | null;
  jiraIssueKey: string | null;
}

export async function diagnoseRedBuild(
  deps: OrchestratorDeps,
  params: DiagnoseParams
): Promise<RedBuildDiagnosis> {
  // ── 1. Jenkins: pull the failed build's console log and extract errors ──────
  const build = await deps.buildAnalyzer.analyzeBuild(params.jobName, params.buildNumber);
  const errors: BuildError[] = build.errors.map((e) => ({
    ...e,
    file: stripPrefix(e.file, params.workspacePrefix),
  }));

  // ── 2. SVN: index the repository into the knowledge graph ───────────────────
  await indexRepository(deps);

  // ── 3. Graphify: root-cause analysis over the dependency graph ──────────────
  const analysis = await deps.rootCause.analyze(errors);

  // ── 4. SVN: the suspect changed most recently before the break is the culprit
  const culprit = await blameCulprit(deps.svn, analysis);

  // ── 5. Jira: open a bug for the failure, assigned to the culprit ────────────
  let jiraIssueKey: string | null = null;
  if (params.createTicket !== false) {
    const issue = await deps.issueTracker.createBuildFailureIssue({
      projectKey: params.jiraProjectKey,
      jobName: params.jobName,
      buildNumber: params.buildNumber,
      errorSummary: analysis.errorSummary,
      assignee: culprit?.author,
    });
    await deps.issueTracker.addAnalysisComment(issue.key, renderAnalysisComment(analysis, culprit));
    jiraIssueKey = issue.key;
  }

  return { jobName: params.jobName, buildNumber: params.buildNumber, errors, analysis, culprit, jiraIssueKey };
}

async function indexRepository(deps: OrchestratorDeps): Promise<void> {
  const paths = await deps.svn.listRecursive("");
  const sources = paths.filter((p) => p.endsWith(".java") || p.endsWith("pom.xml"));
  const files = await Promise.all(
    sources.map(async (path) => ({ path, content: (await deps.svn.cat(path)).content }))
  );
  await deps.indexer.indexFiles(files);
}

async function blameCulprit(svn: SvnClientPort, analysis: RootCauseAnalysis): Promise<Culprit | null> {
  let culprit: Culprit | null = null;
  let highestRevision = -1;

  for (const suspect of analysis.suspectedFiles) {
    let lastCommit;
    try {
      [lastCommit] = await svn.log(suspect.path, 1);
    } catch {
      continue; // suspect not tracked in SVN (e.g. a synthetic node) — skip
    }
    if (lastCommit && lastCommit.revision > highestRevision) {
      highestRevision = lastCommit.revision;
      culprit = {
        file: suspect.path,
        author: lastCommit.author,
        revision: lastCommit.revision,
        message: lastCommit.message,
        blame: "",
        diff: "",
      };
    }
  }

  if (culprit) {
    culprit.blame = await safe(() => svn.blame(culprit!.file).then(formatBlame));
    culprit.diff = await safe(() => svn.diff(culprit!.file, culprit!.revision));
  }
  return culprit;
}

function formatBlame(lines: { revision: number; author: string; lineNumber: number; content: string }[]): string {
  return lines
    .map((l) => `${String(l.lineNumber).padStart(3)} | r${l.revision} ${l.author.padEnd(8)} | ${l.content}`)
    .join("\n");
}

function renderAnalysisComment(analysis: RootCauseAnalysis, culprit: Culprit | null): string {
  const suspects = analysis.suspectedFiles
    .slice(0, 5)
    .map((s) => `* {{${s.path}}} — ${(s.confidence * 100).toFixed(0)}% (${s.reason})`)
    .join("\n");
  const blame = culprit
    ? `\nh3. Likely culprit\n{{${culprit.file}}} last changed in r${culprit.revision} by *${culprit.author}* — "${culprit.message}"`
    : "";
  return [`h3. Suspected files`, suspects, blame, ``, `h3. Suggested fix`, analysis.suggestedFix].join("\n");
}

function stripPrefix(path: string, prefix: string): string {
  let p = path;
  if (prefix && p.startsWith(prefix)) p = p.slice(prefix.length);
  return p.replace(/^\/+/, "");
}

async function safe(fn: () => Promise<string>): Promise<string> {
  try {
    return await fn();
  } catch {
    return "";
  }
}

/**
 * Narrated end-to-end demo of the "red build" circle, running against a real
 * local SVN repo (2 commits) + in-memory graph/Jira doubles.
 *
 *   npm run demo
 *
 * It reproduces: bob renames Calculator.add -> addUp (r2), which breaks
 * MathService (owned by alice). The build goes red pointing at MathService,
 * but the pipeline traces the real cause back to Calculator / bob and proposes
 * a fix.
 */
import { SvnCliAdapter } from "../services/mcp-svn/src/adapters/outbound/svn-cli.adapter.js";
import { BuildAnalyzerService } from "../services/mcp-jenkins/src/domain/services/build-analyzer.service.js";
import { GraphIndexerService } from "../services/mcp-graphify/src/domain/services/graph-indexer.service.js";
import { RootCauseAnalyzerService } from "../services/mcp-graphify/src/domain/services/root-cause-analyzer.service.js";
import { InMemoryGraphAdapter } from "../services/mcp-graphify/src/adapters/outbound/in-memory-graph.adapter.js";
import { JavaParserAdapter } from "../services/mcp-graphify/src/adapters/outbound/java-parser.adapter.js";
import { IssueTrackerService } from "../services/mcp-jira/src/domain/services/issue-tracker.service.js";
import { InMemoryJiraAdapter } from "../services/mcp-jira/src/adapters/outbound/in-memory-jira.adapter.js";

import { diagnoseRedBuild } from "../orchestrator/red-build-orchestrator.js";
import { createScenarioRepo } from "../test/integration/svn-repo-setup.js";
import { MAVEN_FAILURE_LOG } from "../test/fixtures/java-sources.js";
import { StubJenkinsClient } from "../test/fixtures/stub-jenkins.js";

const B = "\x1b[1m";
const DIM = "\x1b[2m";
const R = "\x1b[31m";
const G = "\x1b[32m";
const Y = "\x1b[33m";
const C = "\x1b[36m";
const X = "\x1b[0m";

function header(step: string, title: string) {
  console.log(`\n${B}${C}━━ ${step} ${title} ${"━".repeat(Math.max(0, 56 - title.length - step.length))}${X}`);
}

async function main() {
  console.log(`${B}EAR Build — red-build diagnosis circle${X}`);
  console.log(`${DIM}Jenkins → SVN (index) → Graphify (root cause) → SVN (blame) → Jira${X}`);

  const repo = createScenarioRepo();
  console.log(`\n${DIM}scenario repo: ${repo.repoUrl}${X}`);
  console.log(`${DIM}  r1 alice: import Calculator(add) + MathService(calls add)${X}`);
  console.log(`${DIM}  r2 bob:   rename Calculator.add -> addUp   ← breaks the build${X}`);

  const svn = new SvnCliAdapter({ url: repo.repoUrl, user: "developer", password: "svn_secret" });
  const graph = new InMemoryGraphAdapter();
  const jira = new InMemoryJiraAdapter("EAR");

  try {
    const diagnosis = await diagnoseRedBuild(
      {
        buildAnalyzer: new BuildAnalyzerService(new StubJenkinsClient("math-app", 42, MAVEN_FAILURE_LOG)),
        svn,
        indexer: new GraphIndexerService(graph, new JavaParserAdapter()),
        rootCause: new RootCauseAnalyzerService(graph),
        issueTracker: new IssueTrackerService(jira),
      },
      { jobName: "math-app", buildNumber: 42, workspacePrefix: "/workspace/", jiraProjectKey: "EAR" }
    );

    // ── 1. Jenkins ────────────────────────────────────────────────────────────
    header("1 ⎈ JENKINS", "build math-app #42");
    console.log(`  ${R}✗ BUILD FAILURE${X}  — ${diagnosis.errors.length} error(s) parsed from console log:`);
    for (const e of diagnosis.errors) {
      console.log(`    ${R}●${X} ${e.file}:${e.line}  ${DIM}[${e.category}]${X} ${e.message}`);
    }

    // ── 2. Graphify index ───────────────────────────────────────────────────────
    header("2 ⎇ GRAPHIFY", "knowledge graph");
    const stats = await graph.getStats();
    console.log(`  indexed repo @ HEAD → ${B}${stats.nodeCount}${X} nodes, ${B}${stats.relationCount}${X} relations`);
    console.log(`    ${DIM}files=${stats.fileCount} classes=${stats.classCount} methods=${stats.methodCount}${X}`);
    console.log(`  ${Y}key edge:${X} MathService ${DIM}--IMPORTS-->${X} Calculator`);

    // ── 3. Root cause ───────────────────────────────────────────────────────────
    header("3 ◎ ROOT CAUSE", "suspected files");
    for (const s of diagnosis.analysis.suspectedFiles) {
      const bar = "█".repeat(Math.round(s.confidence * 10)).padEnd(10, "░");
      console.log(`  ${confColor(s.confidence)}${bar}${X} ${(s.confidence * 100).toFixed(0).padStart(3)}%  ${s.path}`);
      console.log(`        ${DIM}${s.reason}${X}`);
    }

    // ── 4. Blame ────────────────────────────────────────────────────────────────
    header("4 ⎌ SVN BLAME", "who broke it");
    const c = diagnosis.culprit!;
    console.log(`  ${R}${B}culprit → ${c.author}${X}  (r${c.revision}: "${c.message}")`);
    console.log(`  file: ${c.file}`);
    console.log(`${DIM}  ┌─ svn blame ${c.file}${X}`);
    for (const line of c.blame.split("\n")) console.log(`${DIM}  │${X} ${highlightAuthor(line, c.author)}`);
    console.log(`${DIM}  └─ svn diff -c ${c.revision}${X}`);
    for (const line of c.diff.split("\n").filter(diffSignal)) console.log(`     ${diffColor(line)}`);

    // ── 5. Jira ───────────────────────────────────────────────────────────────
    header("5 ⎙ JIRA", "ticket opened");
    const issue = jira.inspect(diagnosis.jiraIssueKey!)!;
    console.log(`  ${G}${issue.key}${X}  "${issue.summary}"`);
    console.log(`  assignee=${B}${issue.assignee}${X}  priority=${issue.priority}  labels=[${issue.labels.join(", ")}]`);

    // ── Suggested fix (dummy patch) ─────────────────────────────────────────────
    header("✔ SUGGESTED FIX", "");
    await printSuggestedFix(svn, diagnosis.errors[0].file, diagnosis.errors[0].line, c.diff);

    console.log(`\n${G}${B}✓ diagnosis complete${X} — red build traced from ${diagnosis.errors[0].file} back to ${c.author}'s change in ${c.file}.\n`);
  } finally {
    repo.cleanup();
  }
}

function confColor(c: number): string {
  return c >= 0.8 ? R : c >= 0.5 ? Y : DIM;
}
function highlightAuthor(line: string, author: string): string {
  return line.includes(author) ? `${R}${line}${X}` : line;
}
function diffSignal(line: string): boolean {
  return /^[-+]/.test(line) && !/^[-+]{3}/.test(line);
}
function diffColor(line: string): string {
  if (line.startsWith("+")) return `${G}${line}${X}`;
  if (line.startsWith("-")) return `${R}${line}${X}`;
  return line;
}

/** Build a dummy unified-diff patch that fixes the broken call site. */
async function printSuggestedFix(svn: SvnCliAdapter, errorFile: string, errorLine: number, culpritDiff: string) {
  const oldName = methodFrom(culpritDiff, "-"); // removed signature → add
  const newName = methodFrom(culpritDiff, "+"); // added signature   → addUp

  console.log(`  ${B}Diagnosis:${X} Calculator.${oldName ?? "add"}(...) was renamed to ${B}${newName ?? "addUp"}(...)${X}; the caller was not updated.`);
  console.log(`\n  ${B}Option A${X} ${DIM}(fix the caller)${X} — update ${errorFile}:${errorLine}`);

  const source = (await svn.cat(errorFile)).content.split("\n");
  const broken = source[errorLine - 1] ?? "        return calculator.add(a, b);";
  const fixed = oldName && newName ? broken.replace(`.${oldName}(`, `.${newName}(`) : broken.replace(".add(", ".addUp(");

  console.log(`${DIM}  --- a/${errorFile}${X}`);
  console.log(`${DIM}  +++ b/${errorFile}${X}`);
  console.log(`${DIM}  @@ -${errorLine},1 +${errorLine},1 @@${X}`);
  console.log(`  ${R}-${broken}${X}`);
  console.log(`  ${G}+${fixed}${X}`);

  console.log(`\n  ${B}Option B${X} ${DIM}(keep backwards-compat in Calculator)${X} — re-add a delegating method:`);
  console.log(`  ${G}+    public int ${oldName ?? "add"}(int a, int b) { return ${newName ?? "addUp"}(a, b); }${X}`);
}

function methodFrom(diff: string, sign: "+" | "-"): string | null {
  for (const line of diff.split("\n")) {
    if (!line.startsWith(sign) || line.startsWith(sign.repeat(3))) continue;
    const m = line.match(/public\s+\w+\s+(\w+)\s*\(/);
    if (m) return m[1];
  }
  return null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

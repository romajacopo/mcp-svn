import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { SvnCliAdapter } from "../../services/mcp-svn/src/adapters/outbound/svn-cli.adapter.js";
import { BuildAnalyzerService } from "../../services/mcp-jenkins/src/domain/services/build-analyzer.service.js";
import { GraphIndexerService } from "../../services/mcp-graphify/src/domain/services/graph-indexer.service.js";
import { RootCauseAnalyzerService } from "../../services/mcp-graphify/src/domain/services/root-cause-analyzer.service.js";
import { InMemoryGraphAdapter } from "../../services/mcp-graphify/src/adapters/outbound/in-memory-graph.adapter.js";
import { JavaParserAdapter } from "../../services/mcp-graphify/src/adapters/outbound/java-parser.adapter.js";
import { IssueTrackerService } from "../../services/mcp-jira/src/domain/services/issue-tracker.service.js";
import { InMemoryJiraAdapter } from "../../services/mcp-jira/src/adapters/outbound/in-memory-jira.adapter.js";

import { diagnoseRedBuild, type RedBuildDiagnosis } from "../../orchestrator/red-build-orchestrator.js";
import { createScenarioRepo, type ScenarioRepo } from "./svn-repo-setup.js";
import { MAVEN_FAILURE_LOG, CALC_PATH, SVC_PATH } from "../fixtures/java-sources.js";
import { StubJenkinsClient } from "../fixtures/stub-jenkins.js";

describe("full circle: red build → blame → diagnosis", () => {
  let repo: ScenarioRepo;
  let jira: InMemoryJiraAdapter;
  let diagnosis: RedBuildDiagnosis;

  beforeAll(async () => {
    repo = createScenarioRepo();

    const svn = new SvnCliAdapter({ url: repo.repoUrl, user: "developer", password: "svn_secret" });
    const graph = new InMemoryGraphAdapter();
    jira = new InMemoryJiraAdapter("EAR");

    const deps = {
      buildAnalyzer: new BuildAnalyzerService(new StubJenkinsClient("math-app", 42, MAVEN_FAILURE_LOG)),
      svn,
      indexer: new GraphIndexerService(graph, new JavaParserAdapter()),
      rootCause: new RootCauseAnalyzerService(graph),
      issueTracker: new IssueTrackerService(jira),
    };

    diagnosis = await diagnoseRedBuild(deps, {
      jobName: "math-app",
      buildNumber: 42,
      workspacePrefix: "/workspace/",
      jiraProjectKey: "EAR",
    });
  });

  afterAll(() => repo?.cleanup());

  it("parses the compile error from the Jenkins log at the right location", () => {
    expect(diagnosis.errors).toHaveLength(1);
    expect(diagnosis.errors[0].file).toBe(SVC_PATH);
    expect(diagnosis.errors[0].line).toBe(9);
    expect(diagnosis.errors[0].category).toBe("COMPILATION");
  });

  it("flags both the error site and the dependency as suspects", () => {
    const paths = diagnosis.analysis.suspectedFiles.map((s) => s.path);
    expect(paths).toContain(SVC_PATH); // where it failed to compile
    expect(paths).toContain(CALC_PATH); // the dependency that actually changed
  });

  it("blames the right person: bob, who changed Calculator in r2 (not the error file's author)", () => {
    expect(diagnosis.culprit).not.toBeNull();
    expect(diagnosis.culprit!.file).toBe(CALC_PATH);
    expect(diagnosis.culprit!.author).toBe("bob");
    expect(diagnosis.culprit!.revision).toBe(2);
  });

  it("shows the breaking line via svn blame and the rename via svn diff", () => {
    expect(diagnosis.culprit!.blame).toContain("addUp");
    expect(diagnosis.culprit!.blame).toContain("bob");
    expect(diagnosis.culprit!.diff).toContain("addUp");
    expect(diagnosis.culprit!.diff).toContain("add(int a, int b)"); // the removed signature
  });

  it("opens a Jira bug assigned to the culprit with the analysis attached", () => {
    expect(diagnosis.jiraIssueKey).toMatch(/^EAR-\d+$/);
    const issue = jira.inspect(diagnosis.jiraIssueKey!);
    expect(issue?.assignee).toBe("bob");
    expect(issue?.labels).toContain("build-failure");
    expect(issue?.summary).toContain("math-app");
    expect(issue?.comments[0]).toMatch(/Suggested fix/i);
  });

  it("proposes a compilation-oriented fix", () => {
    expect(diagnosis.analysis.suggestedFix).toMatch(/compilation/i);
  });
});

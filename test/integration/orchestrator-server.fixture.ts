/**
 * Test-only orchestrator MCP server: same inbound adapter as production, but
 * wired with the in-memory / stub doubles + a real local SVN repo (SVN_URL).
 * Spawned over stdio by orchestrator-tool.test.ts.
 */
import { McpServerAdapter, type DiagnoseArgs } from "../../services/mcp-orchestrator/src/adapters/inbound/mcp-server.adapter.js";
import { diagnoseRedBuild } from "../../orchestrator/red-build-orchestrator.js";
import { BuildAnalyzerService } from "../../services/mcp-jenkins/src/domain/services/build-analyzer.service.js";
import { SvnCliAdapter } from "../../services/mcp-svn/src/adapters/outbound/svn-cli.adapter.js";
import { InMemoryGraphAdapter } from "../../services/mcp-graphify/src/adapters/outbound/in-memory-graph.adapter.js";
import { JavaParserAdapter } from "../../services/mcp-graphify/src/adapters/outbound/java-parser.adapter.js";
import { GraphIndexerService } from "../../services/mcp-graphify/src/domain/services/graph-indexer.service.js";
import { RootCauseAnalyzerService } from "../../services/mcp-graphify/src/domain/services/root-cause-analyzer.service.js";
import { InMemoryJiraAdapter } from "../../services/mcp-jira/src/adapters/outbound/in-memory-jira.adapter.js";
import { IssueTrackerService } from "../../services/mcp-jira/src/domain/services/issue-tracker.service.js";
import { MAVEN_FAILURE_LOG } from "../fixtures/java-sources.js";
import { StubJenkinsClient } from "../fixtures/stub-jenkins.js";

const graph = new InMemoryGraphAdapter();

const deps = {
  buildAnalyzer: new BuildAnalyzerService(new StubJenkinsClient("math-app", 42, MAVEN_FAILURE_LOG)),
  svn: new SvnCliAdapter({ url: process.env.SVN_URL!, user: "developer", password: "svn_secret" }),
  indexer: new GraphIndexerService(graph, new JavaParserAdapter()),
  rootCause: new RootCauseAnalyzerService(graph),
  issueTracker: new IssueTrackerService(new InMemoryJiraAdapter("EAR")),
};

const server = new McpServerAdapter((args: DiagnoseArgs) =>
  diagnoseRedBuild(deps, {
    jobName: args.jobName,
    buildNumber: args.buildNumber,
    workspacePrefix: args.workspacePrefix ?? "/workspace/",
    jiraProjectKey: args.jiraProjectKey ?? "EAR",
    createTicket: args.createTicket,
  })
);

server.start();

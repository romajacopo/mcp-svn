import type { OrchestratorDeps } from "../../../orchestrator/red-build-orchestrator.js";
import { JenkinsApiAdapter } from "../../mcp-jenkins/src/adapters/outbound/jenkins-api.adapter.js";
import { BuildAnalyzerService } from "../../mcp-jenkins/src/domain/services/build-analyzer.service.js";
import { SvnCliAdapter } from "../../mcp-svn/src/adapters/outbound/svn-cli.adapter.js";
import { Neo4jGraphAdapter } from "../../mcp-graphify/src/adapters/outbound/neo4j-graph.adapter.js";
import { InMemoryGraphAdapter } from "../../mcp-graphify/src/adapters/outbound/in-memory-graph.adapter.js";
import { JavaParserAdapter } from "../../mcp-graphify/src/adapters/outbound/java-parser.adapter.js";
import { GraphIndexerService } from "../../mcp-graphify/src/domain/services/graph-indexer.service.js";
import { RootCauseAnalyzerService } from "../../mcp-graphify/src/domain/services/root-cause-analyzer.service.js";
import { JiraRestAdapter } from "../../mcp-jira/src/adapters/outbound/jira-rest.adapter.js";
import { InMemoryJiraAdapter } from "../../mcp-jira/src/adapters/outbound/in-memory-jira.adapter.js";
import { IssueTrackerService } from "../../mcp-jira/src/domain/services/issue-tracker.service.js";
import type { GraphStorePort } from "../../mcp-graphify/src/ports/outbound/graph-store.port.js";

type Env = Record<string, string | undefined>;

/**
 * Composition root. Selects outbound adapters from the environment:
 *   - GRAPH_BACKEND=memory  → InMemoryGraphAdapter (else Neo4j)
 *   - JIRA_URL unset        → InMemoryJiraAdapter   (else Jira REST)
 * Everything downstream depends only on the ports, so these choices are local.
 */
export function resolveDeps(env: Env = process.env): OrchestratorDeps {
  const graph: GraphStorePort =
    env.GRAPH_BACKEND === "memory"
      ? new InMemoryGraphAdapter()
      : new Neo4jGraphAdapter({
          uri: env.NEO4J_URI ?? "bolt://localhost:7687",
          user: env.NEO4J_USER ?? "neo4j",
          password: env.NEO4J_PASSWORD ?? "graphify_secret",
        });

  const issueTracker = new IssueTrackerService(
    env.JIRA_URL
      ? new JiraRestAdapter({
          baseUrl: env.JIRA_URL,
          user: env.JIRA_USER ?? "admin",
          token: env.JIRA_TOKEN ?? "",
        })
      : new InMemoryJiraAdapter(env.JIRA_PROJECT ?? "EAR")
  );

  return {
    buildAnalyzer: new BuildAnalyzerService(
      new JenkinsApiAdapter({
        baseUrl: env.JENKINS_URL ?? "http://localhost:8080",
        user: env.JENKINS_USER ?? "admin",
        token: env.JENKINS_TOKEN ?? "",
      })
    ),
    svn: new SvnCliAdapter({
      url: env.SVN_URL ?? "svn://localhost/test-repo",
      user: env.SVN_USER ?? "developer",
      password: env.SVN_PASSWORD ?? "svn_secret",
    }),
    indexer: new GraphIndexerService(graph, new JavaParserAdapter()),
    rootCause: new RootCauseAnalyzerService(graph),
    issueTracker,
  };
}

export function defaultParams(env: Env = process.env) {
  return {
    workspacePrefix: env.WORKSPACE_PREFIX ?? "/workspace/",
    jiraProjectKey: env.JIRA_PROJECT ?? "EAR",
  };
}

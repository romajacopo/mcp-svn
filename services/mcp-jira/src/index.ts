import { createLogger } from "@ear-build/shared";
import { JiraRestAdapter } from "./adapters/outbound/jira-rest.adapter.js";
import { IssueTrackerService } from "./domain/services/issue-tracker.service.js";
import { McpServerAdapter } from "./adapters/inbound/mcp-server.adapter.js";

const logger = createLogger("mcp-jira");

const jiraClient = new JiraRestAdapter({
  baseUrl: process.env.JIRA_URL || "http://localhost:8090",
  user: process.env.JIRA_USER || "admin",
  token: process.env.JIRA_TOKEN || "admin",
});

const tracker = new IssueTrackerService(jiraClient);
const mcpServer = new McpServerAdapter(tracker);

mcpServer.start().then(() => {
  logger.info("MCP Jira server started");
}).catch((err) => {
  logger.error("Failed to start MCP Jira server", { error: String(err) });
  process.exit(1);
});

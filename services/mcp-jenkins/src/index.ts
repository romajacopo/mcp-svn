import { createLogger } from "@ear-build/shared";
import { JenkinsApiAdapter } from "./adapters/outbound/jenkins-api.adapter.js";
import { BuildAnalyzerService } from "./domain/services/build-analyzer.service.js";
import { McpServerAdapter } from "./adapters/inbound/mcp-server.adapter.js";

const logger = createLogger("mcp-jenkins");

const jenkinsClient = new JenkinsApiAdapter({
  baseUrl: process.env.JENKINS_URL || "http://localhost:8080",
  user: process.env.JENKINS_USER || "admin",
  token: process.env.JENKINS_TOKEN || "admin",
});

const analyzer = new BuildAnalyzerService(jenkinsClient);
const mcpServer = new McpServerAdapter(jenkinsClient, analyzer);

mcpServer.start().then(() => {
  logger.info("MCP Jenkins server started");
}).catch((err) => {
  logger.error("Failed to start MCP Jenkins server", { error: String(err) });
  process.exit(1);
});

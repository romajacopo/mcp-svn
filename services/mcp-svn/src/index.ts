import { createLogger } from "@ear-build/shared";
import { SvnCliAdapter } from "./adapters/outbound/svn-cli.adapter.js";
import { CommitResolverService } from "./domain/services/commit-resolver.service.js";
import { McpServerAdapter } from "./adapters/inbound/mcp-server.adapter.js";

const logger = createLogger("mcp-svn");

const svnClient = new SvnCliAdapter({
  url: process.env.SVN_URL || "svn://localhost/test-repo",
  user: process.env.SVN_USER || "developer",
  password: process.env.SVN_PASSWORD || "svn_secret",
});

const commitResolver = new CommitResolverService(svnClient);
const mcpServer = new McpServerAdapter(svnClient, commitResolver);

mcpServer.start().then(() => {
  logger.info("MCP SVN server started");
}).catch((err) => {
  logger.error("Failed to start MCP SVN server", { error: String(err) });
  process.exit(1);
});

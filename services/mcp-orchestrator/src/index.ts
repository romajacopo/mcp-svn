import { createLogger } from "@ear-build/shared";
import { diagnoseRedBuild } from "../../../orchestrator/red-build-orchestrator.js";
import { resolveDeps, defaultParams } from "./composition.js";
import { McpServerAdapter, type DiagnoseArgs } from "./adapters/inbound/mcp-server.adapter.js";

const logger = createLogger("mcp-orchestrator");

const deps = resolveDeps();
const defaults = defaultParams();

const mcpServer = new McpServerAdapter((args: DiagnoseArgs) =>
  diagnoseRedBuild(deps, {
    jobName: args.jobName,
    buildNumber: args.buildNumber,
    workspacePrefix: args.workspacePrefix ?? defaults.workspacePrefix,
    jiraProjectKey: args.jiraProjectKey ?? defaults.jiraProjectKey,
    createTicket: args.createTicket,
  })
);

mcpServer
  .start()
  .then(() => logger.info("MCP Orchestrator server started"))
  .catch((err) => {
    logger.error("Failed to start MCP Orchestrator server", { error: String(err) });
    process.exit(1);
  });

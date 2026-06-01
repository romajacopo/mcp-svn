import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export interface DiagnoseArgs {
  jobName: string;
  buildNumber: number;
  jiraProjectKey?: string;
  workspacePrefix?: string;
  createTicket?: boolean;
}

export type DiagnoseHandler = (args: DiagnoseArgs) => Promise<unknown>;

/**
 * Inbound MCP adapter for the orchestrator. Decoupled from the wiring: it is
 * given a `diagnose` handler (built in the composition root) and only owns the
 * MCP protocol surface — listing and dispatching the `diagnose_red_build` tool.
 */
export class McpServerAdapter {
  private readonly server: Server;

  constructor(private readonly diagnose: DiagnoseHandler) {
    this.server = new Server(
      { name: "mcp-orchestrator", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.registerHandlers();
  }

  private registerHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "diagnose_red_build",
          description:
            "Diagnose a failed (red) build end to end: parse the Jenkins log, index the " +
            "repository into the knowledge graph, run root-cause analysis, blame the " +
            "most-recently-changed suspect in SVN, and open a Jira bug for the culprit. " +
            "Returns errors, suspected files, the culprit (file/author/revision/blame/diff), " +
            "a suggested fix, and the Jira issue key.",
          inputSchema: {
            type: "object",
            properties: {
              jobName: { type: "string", description: "Jenkins job name" },
              buildNumber: { type: "number", description: "Failed build number" },
              jiraProjectKey: { type: "string", description: "Jira project key for the ticket (optional)" },
              workspacePrefix: {
                type: "string",
                description: "Prefix stripped from build-log paths to get repo-relative paths (optional)",
              },
              createTicket: { type: "boolean", description: "Open a Jira ticket (default true)" },
            },
            required: ["jobName", "buildNumber"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      if (name !== "diagnose_red_build") {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const diagnosis = await this.diagnose(args as unknown as DiagnoseArgs);
        return { content: [{ type: "text", text: JSON.stringify(diagnosis, null, 2) }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `diagnose_red_build failed: ${err instanceof Error ? err.message : String(err)}` }],
        };
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

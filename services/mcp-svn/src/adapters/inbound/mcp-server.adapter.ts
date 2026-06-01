import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { SvnClientPort } from "../../ports/outbound/svn-client.port.js";
import type { CommitResolverService } from "../../domain/services/commit-resolver.service.js";

export class McpServerAdapter {
  private readonly server: Server;

  constructor(
    private readonly svn: SvnClientPort,
    private readonly commitResolver: CommitResolverService
  ) {
    this.server = new Server(
      { name: "mcp-svn", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.registerHandlers();
  }

  private registerHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "svn_log",
          description: "Get SVN commit history for a path",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Repository path" },
              limit: { type: "number", description: "Max entries (default 20)" },
            },
            required: ["path"],
          },
        },
        {
          name: "svn_diff",
          description: "Get diff for a specific revision",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Repository path" },
              revision: { type: "number", description: "SVN revision number" },
            },
            required: ["path", "revision"],
          },
        },
        {
          name: "svn_cat",
          description: "Get file content at a specific revision",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path in repository" },
              revision: { type: "number", description: "Revision (omit for HEAD)" },
            },
            required: ["path"],
          },
        },
        {
          name: "svn_list",
          description: "List files in a directory",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Directory path" },
              revision: { type: "number", description: "Revision (omit for HEAD)" },
            },
            required: ["path"],
          },
        },
        {
          name: "svn_blame",
          description: "Get annotated blame for a file (who changed each line)",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path" },
              startLine: { type: "number", description: "Start line (optional)" },
              endLine: { type: "number", description: "End line (optional)" },
            },
            required: ["path"],
          },
        },
        {
          name: "svn_find_commits_for_file",
          description: "Find commits that modified a specific file",
          inputSchema: {
            type: "object",
            properties: {
              filePath: { type: "string", description: "File path to search" },
              limit: { type: "number", description: "Max results" },
            },
            required: ["filePath"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "svn_log": {
          const commits = await this.commitResolver.getRecentCommits(
            args!.path as string, args?.limit as number
          );
          return { content: [{ type: "text", text: JSON.stringify(commits, null, 2) }] };
        }
        case "svn_diff": {
          const diff = await this.commitResolver.getCommitDiff(
            args!.path as string, args!.revision as number
          );
          return { content: [{ type: "text", text: diff }] };
        }
        case "svn_cat": {
          const content = await this.svn.cat(args!.path as string, args?.revision as number);
          return { content: [{ type: "text", text: content.content }] };
        }
        case "svn_list": {
          const files = await this.svn.list(args!.path as string, args?.revision as number);
          return { content: [{ type: "text", text: files.join("\n") }] };
        }
        case "svn_blame": {
          if (args?.startLine && args?.endLine) {
            const blame = await this.commitResolver.getBlameForLines(
              args!.path as string, args.startLine as number, args.endLine as number
            );
            return { content: [{ type: "text", text: blame }] };
          }
          const blame = await this.svn.blame(args!.path as string);
          const text = blame.map((b) => `r${b.revision} ${b.author} | ${b.content}`).join("\n");
          return { content: [{ type: "text", text }] };
        }
        case "svn_find_commits_for_file": {
          const commits = await this.commitResolver.findCommitsForFile(
            args!.filePath as string, args?.limit as number
          );
          return { content: [{ type: "text", text: JSON.stringify(commits, null, 2) }] };
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

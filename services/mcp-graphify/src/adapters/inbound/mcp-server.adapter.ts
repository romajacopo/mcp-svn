import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { GraphIndexerService } from "../../domain/services/graph-indexer.service.js";
import type { RootCauseAnalyzerService } from "../../domain/services/root-cause-analyzer.service.js";
import type { GraphStorePort } from "../../ports/outbound/graph-store.port.js";

export class McpServerAdapter {
  private readonly server: Server;

  constructor(
    private readonly indexer: GraphIndexerService,
    private readonly analyzer: RootCauseAnalyzerService,
    private readonly graph: GraphStorePort
  ) {
    this.server = new Server(
      { name: "mcp-graphify", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.registerHandlers();
  }

  private registerHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "graphify_index_files",
          description: "Index source files into the knowledge graph. Send file paths and content to build the dependency graph.",
          inputSchema: {
            type: "object",
            properties: {
              files: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    content: { type: "string" },
                  },
                  required: ["path", "content"],
                },
                description: "Files to index",
              },
            },
            required: ["files"],
          },
        },
        {
          name: "graphify_analyze_errors",
          description: "Analyze build errors using the knowledge graph to find root cause and impacted files",
          inputSchema: {
            type: "object",
            properties: {
              errors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    file: { type: "string" },
                    line: { type: "number" },
                    message: { type: "string" },
                    severity: { type: "string", enum: ["ERROR", "WARNING"] },
                    category: { type: "string", enum: ["COMPILATION", "TEST", "DEPENDENCY", "RUNTIME"] },
                  },
                  required: ["file", "line", "message", "severity", "category"],
                },
              },
            },
            required: ["errors"],
          },
        },
        {
          name: "graphify_find_dependencies",
          description: "Find what a file/class depends on (outbound dependencies)",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path or node ID" },
              depth: { type: "number", description: "Traversal depth (default 3)" },
            },
            required: ["path"],
          },
        },
        {
          name: "graphify_find_dependents",
          description: "Find what depends on a file/class (inbound — who uses it)",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path or node ID" },
              depth: { type: "number", description: "Traversal depth (default 3)" },
            },
            required: ["path"],
          },
        },
        {
          name: "graphify_impact_analysis",
          description: "Given a list of changed files, find all impacted nodes in the graph",
          inputSchema: {
            type: "object",
            properties: {
              changedPaths: {
                type: "array",
                items: { type: "string" },
                description: "Paths of changed files",
              },
            },
            required: ["changedPaths"],
          },
        },
        {
          name: "graphify_search",
          description: "Search the knowledge graph by name or path pattern",
          inputSchema: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "Search pattern (name or path fragment)" },
            },
            required: ["pattern"],
          },
        },
        {
          name: "graphify_stats",
          description: "Get knowledge graph statistics",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "graphify_index_files": {
          const result = await this.indexer.indexFiles(args!.files as { path: string; content: string }[]);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "graphify_analyze_errors": {
          const analysis = await this.analyzer.analyze(args!.errors as any[]);
          return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
        }
        case "graphify_find_dependencies": {
          const node = await this.graph.findNodeByPath(args!.path as string);
          if (!node) return { content: [{ type: "text", text: `No node found for path: ${args!.path}` }] };
          const deps = await this.graph.findDependencies(node.id, (args?.depth as number) || 3);
          return { content: [{ type: "text", text: JSON.stringify(deps, null, 2) }] };
        }
        case "graphify_find_dependents": {
          const node = await this.graph.findNodeByPath(args!.path as string);
          if (!node) return { content: [{ type: "text", text: `No node found for path: ${args!.path}` }] };
          const deps = await this.graph.findDependents(node.id, (args?.depth as number) || 3);
          return { content: [{ type: "text", text: JSON.stringify(deps, null, 2) }] };
        }
        case "graphify_impact_analysis": {
          const impacted = await this.analyzer.findImpactOfChange(args!.changedPaths as string[]);
          return { content: [{ type: "text", text: JSON.stringify(impacted, null, 2) }] };
        }
        case "graphify_search": {
          const results = await this.graph.queryByPattern(args!.pattern as string);
          return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
        }
        case "graphify_stats": {
          const stats = await this.graph.getStats();
          return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
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

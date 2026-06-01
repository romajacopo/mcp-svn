import { createLogger } from "@ear-build/shared";
import { Neo4jGraphAdapter } from "./adapters/outbound/neo4j-graph.adapter.js";
import { JavaParserAdapter } from "./adapters/outbound/java-parser.adapter.js";
import { GraphIndexerService } from "./domain/services/graph-indexer.service.js";
import { RootCauseAnalyzerService } from "./domain/services/root-cause-analyzer.service.js";
import { McpServerAdapter } from "./adapters/inbound/mcp-server.adapter.js";

const logger = createLogger("mcp-graphify");

const graphStore = new Neo4jGraphAdapter({
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  user: process.env.NEO4J_USER || "neo4j",
  password: process.env.NEO4J_PASSWORD || "graphify_secret",
});

const codeParser = new JavaParserAdapter();
const indexer = new GraphIndexerService(graphStore, codeParser);
const analyzer = new RootCauseAnalyzerService(graphStore);
const mcpServer = new McpServerAdapter(indexer, analyzer, graphStore);

mcpServer.start().then(() => {
  logger.info("MCP Graphify server started");
}).catch((err) => {
  logger.error("Failed to start MCP Graphify server", { error: String(err) });
  process.exit(1);
});

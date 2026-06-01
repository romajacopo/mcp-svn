/**
 * Validates the REAL Neo4jGraphAdapter against a live Neo4j (docker compose).
 *   docker compose up -d neo4j
 *   npx tsx scripts/validate-neo4j.ts
 *
 * Indexes the scenario sources into Neo4j, then runs the same root-cause query
 * the in-memory adapter is unit-tested with — proving the Cypher traversals work.
 */
import { Neo4jGraphAdapter } from "../services/mcp-graphify/src/adapters/outbound/neo4j-graph.adapter.js";
import { GraphIndexerService } from "../services/mcp-graphify/src/domain/services/graph-indexer.service.js";
import { JavaParserAdapter } from "../services/mcp-graphify/src/adapters/outbound/java-parser.adapter.js";
import { RootCauseAnalyzerService } from "../services/mcp-graphify/src/domain/services/root-cause-analyzer.service.js";
import { CALC_PATH, SVC_PATH, CALCULATOR_V2_BUG, MATH_SERVICE } from "../test/fixtures/java-sources.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForNeo4j(graph: Neo4jGraphAdapter, attempts = 30): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await graph.ping();
      return;
    } catch {
      process.stdout.write(`  waiting for neo4j (${i}/${attempts})\r`);
      await sleep(2000);
    }
  }
  throw new Error("neo4j did not become ready in time");
}

async function main() {
  const graph = new Neo4jGraphAdapter({
    uri: process.env.NEO4J_URI ?? "bolt://localhost:7687",
    user: process.env.NEO4J_USER ?? "neo4j",
    password: process.env.NEO4J_PASSWORD ?? "graphify_secret",
  });

  try {
    console.log("• connecting to Neo4j…");
    await waitForNeo4j(graph);
    console.log("• connected. clearing graph.        ");
    await graph.clear();

    console.log("• indexing scenario sources into Neo4j…");
    const indexer = new GraphIndexerService(graph, new JavaParserAdapter());
    await indexer.indexFiles([
      { path: CALC_PATH, content: CALCULATOR_V2_BUG },
      { path: SVC_PATH, content: MATH_SERVICE },
    ]);

    const stats = await graph.getStats();
    console.log("• graph stats:", stats);

    const analyzer = new RootCauseAnalyzerService(graph);
    const analysis = await analyzer.analyze([
      { file: SVC_PATH, line: 9, message: "cannot find symbol", severity: "ERROR", category: "COMPILATION" },
    ]);

    console.log("• suspected files (via real Cypher traversal):");
    for (const s of analysis.suspectedFiles) {
      console.log(`    ${(s.confidence * 100).toFixed(0).padStart(3)}%  ${s.path}`);
    }

    const paths = analysis.suspectedFiles.map((s) => s.path);
    const ok =
      stats.nodeCount > 0 &&
      stats.relationCount > 0 &&
      paths.includes(SVC_PATH) &&
      paths.includes(CALC_PATH);

    console.log(ok ? "\n✓ Neo4jGraphAdapter validated against real Neo4j" : "\n✗ validation FAILED");
    process.exitCode = ok ? 0 : 1;
  } finally {
    await graph.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

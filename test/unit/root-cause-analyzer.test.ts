import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryGraphAdapter } from "../../services/mcp-graphify/src/adapters/outbound/in-memory-graph.adapter.js";
import { JavaParserAdapter } from "../../services/mcp-graphify/src/adapters/outbound/java-parser.adapter.js";
import { GraphIndexerService } from "../../services/mcp-graphify/src/domain/services/graph-indexer.service.js";
import { RootCauseAnalyzerService } from "../../services/mcp-graphify/src/domain/services/root-cause-analyzer.service.js";
import { CALC_PATH, SVC_PATH, CALCULATOR_V2_BUG, MATH_SERVICE } from "../fixtures/java-sources.js";

describe("RootCauseAnalyzerService", () => {
  let analyzer: RootCauseAnalyzerService;

  beforeEach(async () => {
    const graph = new InMemoryGraphAdapter();
    const indexer = new GraphIndexerService(graph, new JavaParserAdapter());
    await indexer.indexFiles([
      { path: CALC_PATH, content: CALCULATOR_V2_BUG },
      { path: SVC_PATH, content: MATH_SERVICE },
    ]);
    analyzer = new RootCauseAnalyzerService(graph);
  });

  it("surfaces the error file AND its dependency (the real culprit)", async () => {
    const analysis = await analyzer.analyze([
      { file: SVC_PATH, line: 9, message: "cannot find symbol", severity: "ERROR", category: "COMPILATION" },
    ]);

    const paths = analysis.suspectedFiles.map((s) => s.path);
    expect(paths).toContain(SVC_PATH);
    expect(paths).toContain(CALC_PATH);
  });

  it("ranks the direct error location highest", async () => {
    const analysis = await analyzer.analyze([
      { file: SVC_PATH, line: 9, message: "cannot find symbol", severity: "ERROR", category: "COMPILATION" },
    ]);

    expect(analysis.suspectedFiles[0].path).toBe(SVC_PATH);
    const calc = analysis.suspectedFiles.find((s) => s.path === CALC_PATH);
    expect(calc?.reason).toMatch(/dependency/i);
  });

  it("summarises errors by category and proposes a compilation-oriented fix", async () => {
    const analysis = await analyzer.analyze([
      { file: SVC_PATH, line: 9, message: "cannot find symbol", severity: "ERROR", category: "COMPILATION" },
    ]);

    expect(analysis.errorSummary).toContain("COMPILATION");
    expect(analysis.suggestedFix).toMatch(/compilation/i);
  });
});

import type { CodeNode, CodeRelation } from "@ear-build/shared";
import { createLogger } from "@ear-build/shared";
import type { GraphStorePort } from "../../ports/outbound/graph-store.port.js";
import type { CodeParserPort, ParseResult } from "../../ports/outbound/code-parser.port.js";

const logger = createLogger("graph-indexer");

export class GraphIndexerService {
  private readonly supportedExts: Set<string>;

  constructor(
    private readonly graph: GraphStorePort,
    private readonly parser: CodeParserPort
  ) {
    this.supportedExts = new Set(parser.supportedExtensions());
  }

  async indexFiles(files: { path: string; content: string }[]): Promise<IndexResult> {
    const allNodes: CodeNode[] = [];
    const allRelations: CodeRelation[] = [];
    let parsed = 0;
    let skipped = 0;

    for (const file of files) {
      const ext = this.getExtension(file.path);
      if (!this.supportedExts.has(ext)) {
        skipped++;
        continue;
      }

      try {
        const result = this.parser.parseFile(file.path, file.content);
        allNodes.push(...result.nodes);
        allRelations.push(...result.relations);
        parsed++;
      } catch (err) {
        logger.warn("Failed to parse file", { path: file.path, error: String(err) });
        skipped++;
      }
    }

    await this.graph.batchUpsertNodes(allNodes);
    await this.graph.batchUpsertRelations(allRelations);

    logger.info("Indexing complete", { parsed, skipped, nodes: allNodes.length, relations: allRelations.length });
    return { parsed, skipped, nodeCount: allNodes.length, relationCount: allRelations.length };
  }

  async indexSingleFile(path: string, content: string): Promise<ParseResult> {
    const result = this.parser.parseFile(path, content);
    await this.graph.batchUpsertNodes(result.nodes);
    await this.graph.batchUpsertRelations(result.relations);
    return result;
  }

  private getExtension(path: string): string {
    const dot = path.lastIndexOf(".");
    return dot >= 0 ? path.slice(dot) : "";
  }
}

export interface IndexResult {
  parsed: number;
  skipped: number;
  nodeCount: number;
  relationCount: number;
}

import type { CodeNode, CodeRelation } from "@ear-build/shared";
import type { GraphStorePort, GraphStats } from "../../ports/outbound/graph-store.port.js";

const TYPE_PRIORITY: Record<CodeNode["type"], number> = {
  FILE: 0,
  CLASS: 1,
  METHOD: 2,
  MODULE: 3,
  PACKAGE: 4,
};

/**
 * In-memory implementation of {@link GraphStorePort}.
 *
 * Same port as {@link Neo4jGraphAdapter} — swapping one for the other requires
 * no change to the domain services. Used for tests and for running the full
 * pipeline locally without a Neo4j instance.
 */
export class InMemoryGraphAdapter implements GraphStorePort {
  private readonly nodes = new Map<string, CodeNode>();
  private readonly outEdges = new Map<string, Set<string>>();
  private readonly inEdges = new Map<string, Set<string>>();

  async upsertNode(node: CodeNode): Promise<void> {
    this.nodes.set(node.id, node);
  }

  async upsertRelation(relation: CodeRelation): Promise<void> {
    this.addEdge(relation.source, relation.target);
  }

  async batchUpsertNodes(nodes: CodeNode[]): Promise<void> {
    for (const node of nodes) this.nodes.set(node.id, node);
  }

  async batchUpsertRelations(relations: CodeRelation[]): Promise<void> {
    for (const rel of relations) this.addEdge(rel.source, rel.target);
  }

  async findNodeByPath(path: string): Promise<CodeNode | null> {
    const candidates = [...this.nodes.values()].filter((n) => n.path === path);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type]);
    return candidates[0];
  }

  async findDependencies(nodeId: string, depth = 3): Promise<CodeNode[]> {
    return this.traverse(nodeId, depth, this.outEdges);
  }

  async findDependents(nodeId: string, depth = 3): Promise<CodeNode[]> {
    return this.traverse(nodeId, depth, this.inEdges);
  }

  async findImpactedNodes(changedPaths: string[]): Promise<CodeNode[]> {
    const changedIds = new Set(
      [...this.nodes.values()].filter((n) => changedPaths.includes(n.path)).map((n) => n.id)
    );

    const impacted = new Map<string, CodeNode>();
    for (const id of changedIds) {
      for (const dependent of this.traverse(id, 3, this.inEdges)) {
        if (!changedIds.has(dependent.id)) impacted.set(dependent.id, dependent);
      }
    }
    return [...impacted.values()];
  }

  async findShortestPath(sourceId: string, targetId: string): Promise<CodeNode[]> {
    const queue: string[][] = [[sourceId]];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      if (current === targetId) {
        return path.map((id) => this.nodes.get(id)).filter((n): n is CodeNode => Boolean(n));
      }
      const neighbours = new Set([
        ...(this.outEdges.get(current) ?? []),
        ...(this.inEdges.get(current) ?? []),
      ]);
      for (const next of neighbours) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push([...path, next]);
        }
      }
    }
    return [];
  }

  async queryByPattern(pattern: string): Promise<CodeNode[]> {
    const needle = pattern.toLowerCase();
    return [...this.nodes.values()]
      .filter((n) => n.name.toLowerCase().includes(needle) || n.path.toLowerCase().includes(needle))
      .slice(0, 50);
  }

  async getStats(): Promise<GraphStats> {
    const nodes = [...this.nodes.values()];
    const relationCount = [...this.outEdges.values()].reduce((sum, set) => sum + set.size, 0);
    return {
      nodeCount: nodes.length,
      relationCount,
      fileCount: nodes.filter((n) => n.type === "FILE").length,
      classCount: nodes.filter((n) => n.type === "CLASS").length,
      methodCount: nodes.filter((n) => n.type === "METHOD").length,
    };
  }

  async clear(): Promise<void> {
    this.nodes.clear();
    this.outEdges.clear();
    this.inEdges.clear();
  }

  private addEdge(source: string, target: string): void {
    if (!this.outEdges.has(source)) this.outEdges.set(source, new Set());
    if (!this.inEdges.has(target)) this.inEdges.set(target, new Set());
    this.outEdges.get(source)!.add(target);
    this.inEdges.get(target)!.add(source);
  }

  /** Breadth-first traversal following the given edge map, up to `depth` hops. */
  private traverse(startId: string, depth: number, edges: Map<string, Set<string>>): CodeNode[] {
    const result = new Map<string, CodeNode>();
    let frontier = new Set<string>([startId]);
    const visited = new Set<string>([startId]);

    for (let hop = 0; hop < depth; hop++) {
      const next = new Set<string>();
      for (const id of frontier) {
        for (const neighbour of edges.get(id) ?? []) {
          if (visited.has(neighbour)) continue;
          visited.add(neighbour);
          next.add(neighbour);
          const node = this.nodes.get(neighbour);
          if (node) result.set(neighbour, node);
        }
      }
      if (next.size === 0) break;
      frontier = next;
    }

    return [...result.values()];
  }
}

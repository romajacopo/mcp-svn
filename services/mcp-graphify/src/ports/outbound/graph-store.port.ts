import type { CodeNode, CodeRelation } from "@ear-build/shared";

export interface GraphStorePort {
  upsertNode(node: CodeNode): Promise<void>;
  upsertRelation(relation: CodeRelation): Promise<void>;
  batchUpsertNodes(nodes: CodeNode[]): Promise<void>;
  batchUpsertRelations(relations: CodeRelation[]): Promise<void>;
  findNodeByPath(path: string): Promise<CodeNode | null>;
  findDependencies(nodeId: string, depth?: number): Promise<CodeNode[]>;
  findDependents(nodeId: string, depth?: number): Promise<CodeNode[]>;
  findImpactedNodes(changedPaths: string[]): Promise<CodeNode[]>;
  findShortestPath(sourceId: string, targetId: string): Promise<CodeNode[]>;
  queryByPattern(pattern: string): Promise<CodeNode[]>;
  getStats(): Promise<GraphStats>;
  clear(): Promise<void>;
}

export interface GraphStats {
  nodeCount: number;
  relationCount: number;
  fileCount: number;
  classCount: number;
  methodCount: number;
}

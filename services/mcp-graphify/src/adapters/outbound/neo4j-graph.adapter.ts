import neo4j, { type Driver, type Session } from "neo4j-driver";
import type { CodeNode, CodeRelation } from "@ear-build/shared";
import type { GraphStorePort, GraphStats } from "../../ports/outbound/graph-store.port.js";

interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

export class Neo4jGraphAdapter implements GraphStorePort {
  private readonly driver: Driver;

  constructor(config: Neo4jConfig) {
    this.driver = neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password));
  }

  async upsertNode(node: CodeNode): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MERGE (n:CodeNode {id: $id})
         SET n.path = $path, n.type = $type, n.name = $name, n.language = $language`,
        node
      );
    } finally {
      await session.close();
    }
  }

  async upsertRelation(relation: CodeRelation): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (s:CodeNode {id: $source}), (t:CodeNode {id: $target})
         MERGE (s)-[r:${relation.type}]->(t)`,
        { source: relation.source, target: relation.target }
      );
    } finally {
      await session.close();
    }
  }

  async batchUpsertNodes(nodes: CodeNode[]): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `UNWIND $nodes AS node
         MERGE (n:CodeNode {id: node.id})
         SET n.path = node.path, n.type = node.type, n.name = node.name, n.language = node.language`,
        { nodes }
      );
    } finally {
      await session.close();
    }
  }

  async batchUpsertRelations(relations: CodeRelation[]): Promise<void> {
    const session = this.driver.session();
    try {
      for (const relType of ["IMPORTS", "EXTENDS", "IMPLEMENTS", "CALLS", "DEPENDS_ON", "CONTAINS"]) {
        const batch = relations.filter((r) => r.type === relType);
        if (batch.length === 0) continue;
        await session.run(
          `UNWIND $rels AS rel
           MATCH (s:CodeNode {id: rel.source}), (t:CodeNode {id: rel.target})
           MERGE (s)-[:${relType}]->(t)`,
          { rels: batch }
        );
      }
    } finally {
      await session.close();
    }
  }

  async findNodeByPath(path: string): Promise<CodeNode | null> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (n:CodeNode) WHERE n.path = $path RETURN n LIMIT 1`,
        { path }
      );
      if (result.records.length === 0) return null;
      return result.records[0].get("n").properties as CodeNode;
    } finally {
      await session.close();
    }
  }

  async findDependencies(nodeId: string, depth = 3): Promise<CodeNode[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (n:CodeNode {id: $nodeId})-[*1..${depth}]->(dep:CodeNode)
         RETURN DISTINCT dep`,
        { nodeId }
      );
      return result.records.map((r) => r.get("dep").properties as CodeNode);
    } finally {
      await session.close();
    }
  }

  async findDependents(nodeId: string, depth = 3): Promise<CodeNode[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (dep:CodeNode)-[*1..${depth}]->(n:CodeNode {id: $nodeId})
         RETURN DISTINCT dep`,
        { nodeId }
      );
      return result.records.map((r) => r.get("dep").properties as CodeNode);
    } finally {
      await session.close();
    }
  }

  async findImpactedNodes(changedPaths: string[]): Promise<CodeNode[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (changed:CodeNode) WHERE changed.path IN $paths
         MATCH (impacted:CodeNode)-[*1..3]->(changed)
         RETURN DISTINCT impacted`,
        { paths: changedPaths }
      );
      return result.records.map((r) => r.get("impacted").properties as CodeNode);
    } finally {
      await session.close();
    }
  }

  async findShortestPath(sourceId: string, targetId: string): Promise<CodeNode[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH path = shortestPath((s:CodeNode {id: $sourceId})-[*..10]-(t:CodeNode {id: $targetId}))
         UNWIND nodes(path) AS node
         RETURN node`,
        { sourceId, targetId }
      );
      return result.records.map((r) => r.get("node").properties as CodeNode);
    } finally {
      await session.close();
    }
  }

  async queryByPattern(pattern: string): Promise<CodeNode[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (n:CodeNode) WHERE n.name =~ $pattern OR n.path =~ $pattern
         RETURN n LIMIT 50`,
        { pattern: `(?i).*${pattern}.*` }
      );
      return result.records.map((r) => r.get("n").properties as CodeNode);
    } finally {
      await session.close();
    }
  }

  async getStats(): Promise<GraphStats> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (n:CodeNode)
        RETURN count(n) AS nodeCount,
               sum(CASE WHEN n.type = 'FILE' THEN 1 ELSE 0 END) AS fileCount,
               sum(CASE WHEN n.type = 'CLASS' THEN 1 ELSE 0 END) AS classCount,
               sum(CASE WHEN n.type = 'METHOD' THEN 1 ELSE 0 END) AS methodCount
      `);
      const row = result.records[0];
      const relResult = await session.run(`MATCH ()-[r]->() RETURN count(r) AS relCount`);
      return {
        nodeCount: row.get("nodeCount").toNumber(),
        fileCount: row.get("fileCount").toNumber(),
        classCount: row.get("classCount").toNumber(),
        methodCount: row.get("methodCount").toNumber(),
        relationCount: relResult.records[0].get("relCount").toNumber(),
      };
    } finally {
      await session.close();
    }
  }

  async clear(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run("MATCH (n) DETACH DELETE n");
    } finally {
      await session.close();
    }
  }

  /** Verify connectivity — throws if the database is unreachable. */
  async ping(): Promise<void> {
    await this.driver.verifyConnectivity();
  }

  /** Release the driver's connection pool. Call on shutdown. */
  async close(): Promise<void> {
    await this.driver.close();
  }
}

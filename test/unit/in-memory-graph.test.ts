import { describe, it, expect, beforeEach } from "vitest";
import type { CodeNode } from "@ear-build/shared";
import { InMemoryGraphAdapter } from "../../services/mcp-graphify/src/adapters/outbound/in-memory-graph.adapter.js";

const node = (id: string): CodeNode => ({ id, path: `${id}.java`, type: "FILE", name: id, language: "java" });

describe("InMemoryGraphAdapter", () => {
  let graph: InMemoryGraphAdapter;

  beforeEach(async () => {
    graph = new InMemoryGraphAdapter();
    await graph.batchUpsertNodes([node("a"), node("b"), node("c")]);
    // a -> b -> c
    await graph.batchUpsertRelations([
      { source: "a", target: "b", type: "IMPORTS" },
      { source: "b", target: "c", type: "IMPORTS" },
    ]);
  });

  it("finds transitive dependencies (outbound)", async () => {
    const deps = await graph.findDependencies("a", 3);
    expect(deps.map((n) => n.id).sort()).toEqual(["b", "c"]);
  });

  it("finds transitive dependents (inbound)", async () => {
    const dependents = await graph.findDependents("c", 3);
    expect(dependents.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("respects traversal depth", async () => {
    const deps = await graph.findDependencies("a", 1);
    expect(deps.map((n) => n.id)).toEqual(["b"]);
  });

  it("computes impacted nodes from changed paths", async () => {
    const impacted = await graph.findImpactedNodes(["b.java"]);
    expect(impacted.map((n) => n.id)).toEqual(["a"]);
  });

  it("finds the shortest path between two nodes", async () => {
    const path = await graph.findShortestPath("a", "c");
    expect(path.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });
});

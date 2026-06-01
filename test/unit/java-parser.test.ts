import { describe, it, expect } from "vitest";
import { JavaParserAdapter } from "../../services/mcp-graphify/src/adapters/outbound/java-parser.adapter.js";
import { CALC_PATH, SVC_PATH, CALCULATOR_V1, MATH_SERVICE } from "../fixtures/java-sources.js";

describe("JavaParserAdapter", () => {
  const parser = new JavaParserAdapter();

  it("extracts file, package, class and method nodes from a Java source", () => {
    const { nodes } = parser.parseFile(CALC_PATH, CALCULATOR_V1);

    expect(nodes.find((n) => n.type === "FILE" && n.id === CALC_PATH)).toBeDefined();
    expect(nodes.find((n) => n.type === "PACKAGE" && n.name === "com.example.math")).toBeDefined();

    const classNode = nodes.find((n) => n.type === "CLASS");
    expect(classNode?.id).toBe("class:com.example.math.Calculator");
    expect(classNode?.name).toBe("Calculator");
    expect(classNode?.path).toBe(CALC_PATH);

    expect(nodes.find((n) => n.type === "METHOD" && n.name === "add")).toBeDefined();
  });

  it("records an IMPORTS relation from the importing file to the imported class", () => {
    const { relations } = parser.parseFile(SVC_PATH, MATH_SERVICE);

    expect(relations).toContainEqual({
      source: SVC_PATH,
      target: "class:com.example.math.Calculator",
      type: "IMPORTS",
    });
  });
});

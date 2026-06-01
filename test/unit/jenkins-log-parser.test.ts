import { describe, it, expect } from "vitest";
import { parseMavenLog } from "../../services/mcp-jenkins/src/domain/services/log-error-parser.js";
import { MAVEN_FAILURE_LOG, SVC_PATH } from "../fixtures/java-sources.js";

describe("parseMavenLog", () => {
  it("extracts a modern maven compiler error in [line,col] format", () => {
    const errors = parseMavenLog(MAVEN_FAILURE_LOG);
    const compile = errors.filter((e) => e.category === "COMPILATION");

    expect(compile).toHaveLength(1);
    expect(compile[0].file).toContain(SVC_PATH);
    expect(compile[0].line).toBe(9);
    expect(compile[0].message).toContain("cannot find symbol");
    expect(compile[0].severity).toBe("ERROR");
  });

  it("supports the legacy file:line: format", () => {
    const errors = parseMavenLog("[ERROR] /src/Foo.java:42: incompatible types");
    expect(errors).toEqual([
      {
        file: "/src/Foo.java",
        line: 42,
        message: "incompatible types",
        severity: "ERROR",
        category: "COMPILATION",
      },
    ]);
  });

  it("detects dependency resolution failures", () => {
    const log =
      "[ERROR] Failed to execute goal: Could not resolve dependencies for project com.x:app:jar:1.0: missing junit:junit:jar:9.9";
    const errors = parseMavenLog(log);

    expect(errors).toHaveLength(1);
    expect(errors[0].category).toBe("DEPENDENCY");
    expect(errors[0].file).toBe("pom.xml");
  });

  it("returns no errors for a clean log", () => {
    expect(parseMavenLog("[INFO] BUILD SUCCESS")).toEqual([]);
  });
});

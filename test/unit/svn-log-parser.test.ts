import { describe, it, expect } from "vitest";
import { parseSvnLogXml } from "../../services/mcp-svn/src/adapters/outbound/svn-log.parser.js";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<log>
<logentry revision="2">
<author>bob</author>
<date>2026-05-30T10:00:00.000000Z</date>
<paths>
<path kind="file" action="M" prop-mods="false" text-mods="true">/src/main/java/com/example/math/Calculator.java</path>
</paths>
<msg>rename add to addUp</msg>
</logentry>
<logentry revision="1">
<author>alice</author>
<date>2026-05-29T09:00:00.000000Z</date>
<paths>
<path kind="file" action="A">/src/main/java/com/example/math/Calculator.java</path>
<path kind="file" action="A">/src/main/java/com/example/service/MathService.java</path>
</paths>
<msg>initial import</msg>
</logentry>
</log>`;

describe("parseSvnLogXml", () => {
  it("parses multiple log entries newest-first", () => {
    const commits = parseSvnLogXml(SAMPLE_XML);
    expect(commits).toHaveLength(2);
    expect(commits[0].revision).toBe(2);
    expect(commits[1].revision).toBe(1);
  });

  it("extracts author, message and changed paths", () => {
    const [r2, r1] = parseSvnLogXml(SAMPLE_XML);

    expect(r2.author).toBe("bob");
    expect(r2.message).toBe("rename add to addUp");
    expect(r2.changedPaths).toEqual([
      { action: "M", path: "/src/main/java/com/example/math/Calculator.java" },
    ]);

    expect(r1.author).toBe("alice");
    expect(r1.changedPaths).toHaveLength(2);
    expect(r1.changedPaths.every((p) => p.action === "A")).toBe(true);
  });

  it("returns an empty array for empty output", () => {
    expect(parseSvnLogXml("<log></log>")).toEqual([]);
  });
});

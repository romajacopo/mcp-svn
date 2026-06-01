import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { createScenarioRepo, type ScenarioRepo } from "./svn-repo-setup.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

/**
 * Drives the orchestrator over a REAL MCP stdio connection: spawns the server,
 * lists tools, then calls diagnose_red_build and checks the diagnosis.
 */
describe("mcp-orchestrator: diagnose_red_build over MCP stdio", () => {
  let repo: ScenarioRepo;
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    repo = createScenarioRepo();

    transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", "test/integration/orchestrator-server.fixture.ts"],
      cwd: repoRoot,
      env: { ...process.env, SVN_URL: repo.repoUrl },
    });
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
  }, 60000);

  afterAll(async () => {
    await client?.close();
    repo?.cleanup();
  });

  it("advertises the diagnose_red_build tool", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "diagnose_red_build");
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.required).toContain("jobName");
  });

  it("runs the full circle and returns a diagnosis blaming bob", async () => {
    const result: any = await client.callTool({
      name: "diagnose_red_build",
      arguments: { jobName: "math-app", buildNumber: 42 },
    });

    expect(result.isError).toBeFalsy();
    const diagnosis = JSON.parse(result.content[0].text);

    expect(diagnosis.errors[0].file).toContain("MathService.java");
    expect(diagnosis.culprit.author).toBe("bob");
    expect(diagnosis.culprit.file).toContain("Calculator.java");
    expect(diagnosis.culprit.revision).toBe(2);
    expect(diagnosis.jiraIssueKey).toMatch(/^EAR-\d+$/);
  }, 30000);
});

# Testing & local demo

Two ways to exercise the system without the full Docker stack:

## Prerequisites
- Node ≥ 20
- `svn` + `svnadmin` on PATH (macOS: `brew install subversion`)
- `npm install` at the repo root (installs vitest + tsx)

## Unit tests (TDD)
Pure domain logic, no external services. Fast.

```bash
npm run test:unit
```

Covers: Jenkins build-log error parsing, SVN `log --xml` parsing, Java→graph
extraction, the in-memory graph store, and the root-cause analyzer.

## Integration test — the full circle
Spins up a **real local SVN repo** with two commits (alice imports the code,
bob renames `Calculator.add → addUp` and breaks it), then runs the whole
pipeline and asserts the blame lands on bob.

```bash
npm run test:integration
```

## Narrated demo
Same scenario, printed step by step (Jenkins → Graphify → blame → Jira →
suggested fix):

```bash
npm run demo
```

## Validate the real adapters against live infra
These exercise the real outbound adapters (not the in-memory doubles) against
containers from `docker-compose.yml`:

```bash
make validate-neo4j     # real Neo4jGraphAdapter: index + Cypher traversals vs live Neo4j
make validate-jenkins   # real JenkinsApiAdapter: seed a failing job, read the real console log
```

`validate-jenkins` seeds a freestyle job that fails with a maven-style error
line, triggers it, then parses the **real** console log via `BuildAnalyzer`.

> If host port 8080 is taken, pick another: `make up JENKINS_PORT=8085` (and the
> validate target follows it). The Jenkins image is custom-built to include the
> `configuration-as-code` plugin so `casc.yaml` (admin user) is applied.

## The 5th server: orchestrator
`services/mcp-orchestrator` exposes a single tool, **`diagnose_red_build`**, that
runs the whole circle in one call (the same `orchestrator/red-build-orchestrator.ts`
flow). It selects adapters from env: `GRAPH_BACKEND=memory` → in-memory graph
(else Neo4j); `JIRA_URL` unset → in-memory Jira (else REST). It runs via `tsx`.
`test/integration/orchestrator-tool.test.ts` drives it over a real MCP stdio
connection.

## How the pieces map to the architecture
- The 4 MCP servers expose their domain logic as tools (`services/mcp-*`).
- `orchestrator/red-build-orchestrator.ts` is the reference "circle" — in
  production the VS Code + Copilot client drives this by calling the MCP tools.
  It depends only on **ports**, so it runs against the real adapters
  (Jenkins API, SVN CLI, Neo4j) or the in-memory doubles used by the tests:
  - `InMemoryGraphAdapter` (vs `Neo4jGraphAdapter`)
  - `InMemoryJiraAdapter` (vs `JiraRestAdapter`)
  - `StubJenkinsClient` (replays a captured console log)

## Full real stack
For the real Jenkins/Jira/SVN/Neo4j instances: `make up` (see `README`/`docker-compose.yml`).

# EAR Build — red-build diagnosis via MCP

A set of **Model Context Protocol (MCP) servers** that let an AI assistant
(VS Code + GitHub Copilot, Claude, …) turn a **red CI build** into a concrete,
code-level diagnosis:

> parse the Jenkins log → index the repository into a code knowledge graph →
> root-cause analysis → `svn blame` the culprit → open a Jira bug for them.

The headline trick: the file where compilation *fails* is often **not** the file
that *caused* it. The knowledge graph links the two, so blame lands on the change
that actually broke the build.

## Architecture

Five MCP servers, each [hexagonal](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software))
(domain / ports / adapters):

| Server | Purpose | Key tools |
|---|---|---|
| `mcp-jenkins` | parse build logs & test reports | `jenkins_analyze_build`, `jenkins_get_build_log` |
| `mcp-svn` | history, diff, cat, blame | `svn_log`, `svn_diff`, `svn_blame` |
| `mcp-graphify` | code knowledge graph (Neo4j) | `graphify_index_files`, `graphify_analyze_errors` |
| `mcp-jira` | issue tracking | `jira_create_build_failure`, `jira_add_comment` |
| `mcp-orchestrator` | **the whole circle in one call** | `diagnose_red_build` |

```
services/mcp-<name>/src/
  domain/services/   ← pure business logic (no I/O)
  ports/outbound/    ← interfaces
  adapters/outbound/ ← real clients (Jenkins API, SVN CLI, Neo4j) + in-memory doubles
  adapters/inbound/  ← the MCP server (exposes tools)
orchestrator/        ← reference end-to-end flow (depends only on ports)
openspec/specs/      ← validated capability specifications
```

## Quick start (local test stack)

```bash
cp .env.example .env          # local dev secrets (defaults are fine)
make up JENKINS_PORT=8085     # Jenkins, Jira, SVN, Neo4j + the 5 MCP servers
make health
npm install && npm test       # 25 tests (unit + integration)
npm run demo                  # narrated end-to-end walkthrough
```

See [TESTING.md](TESTING.md) for unit/integration tests and the live-instance
validation scripts (`make validate-neo4j`, `make validate-jenkins`).

## 🔧 Point it at your company servers

For real use, developers connect their editor's MCP client to these servers and
point them at the **company** Jenkins, Subversion and Jira. **Neo4j stays local**
— it is the code knowledge graph this tool builds, not company infrastructure.

Edit **`mcp-servers.json`** (this is the file your MCP client / Copilot reads) and
replace the URLs:

```jsonc
"mcp-orchestrator": {
  "command": "npx",
  "args": ["tsx", "services/mcp-orchestrator/src/index.ts"],
  "env": {
    "JENKINS_URL": "https://jenkins.your-company.com",   // ← company Jenkins
    "JENKINS_USER": "your.user",
    "JENKINS_TOKEN": "<jenkins-api-token>",              // Jenkins → user → Configure → API token
    "SVN_URL":      "https://svn.your-company.com/repo/trunk", // ← company Subversion
    "SVN_USER":     "your.user",
    "SVN_PASSWORD": "<svn-password>",
    "JIRA_URL":     "https://jira.your-company.com",     // ← company Jira (optional)
    "JIRA_USER":    "your.user",
    "JIRA_TOKEN":   "<jira-api-token>",
    "JIRA_PROJECT": "EAR",
    "NEO4J_URI":      "bolt://localhost:7687",           // stays local (docker compose up -d neo4j)
    "NEO4J_USER":     "neo4j",
    "NEO4J_PASSWORD": "<neo4j-password>"
  }
}
```

The same `JENKINS_URL` / `SVN_URL` / `JIRA_URL` keys exist on the individual
`mcp-jenkins`, `mcp-svn`, `mcp-jira` entries if you prefer to wire the four
servers separately instead of using the orchestrator.

> **Tip:** keep secrets out of the file by using `${JENKINS_TOKEN}` placeholders
> (already used for tokens) and exporting them in your shell / editor secret store.

## Using it from VS Code + GitHub Copilot

1. Install the prerequisites once: Node ≥ 20, `svn` client (`brew install subversion`
   / `apt-get install subversion`), Docker (for the local Neo4j).
2. `docker compose up -d neo4j` — start the code knowledge graph.
3. Register the servers: copy `mcp-servers.json` into your Copilot/MCP config and
   fill in the company URLs + tokens (see above).
4. In chat, ask Copilot something like:
   > "Build `payments-service` #318 is red — `diagnose_red_build` and tell me who to ping."
   The orchestrator returns the parsed errors, the suspected files, the **culprit
   (author + revision + blame)**, a suggested fix, and the Jira issue it opened.

## Specifications

Capabilities are specified and validated with [OpenSpec](https://github.com/Fission-AI/OpenSpec):

```bash
openspec list --specs        # 6 capabilities, 16 requirements
openspec validate --specs    # all green
```

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

---

## Step-by-step usage guide

### 0 · Prerequisites
- **Node.js ≥ 20**, **npm**
- **`svn` CLI** in `PATH` (`apt-get install subversion` / `brew install subversion`)
- **Docker** (only needed for the local Neo4j knowledge graph)
- An MCP client (e.g. VS Code + GitHub Copilot, Claude Desktop, …)

### 1 · Install
```bash
git clone <this repo> && cd mcp-svn
make install        # installs shared/, services/mcp-*, builds shared/
npm install         # root deps (tsx, vitest)
```

### 2 · Configure secrets — `.env`
Secrets never live in `mcp-servers.json`. They live in `.env` (gitignored) and
`mcp-servers.json` references them with `${VAR}` placeholders.

```bash
cp .env.example .env
# then edit .env and fill in your real values for the section you need
```

The `.env` template covers both modes (local docker stack defaults + company
overrides). For company use, set at minimum:
```bash
JENKINS_USER=<your.user>
JENKINS_TOKEN=<jenkins api token>     # Jenkins → user → Configure → API Token
SVN_USER=<your.user>
SVN_PASSWORD=<your svn password>
```

### 3 · Point at your infrastructure — `mcp-servers.json`
Edit `mcp-servers.json` and set the company URLs. Usernames and tokens stay as
`${VAR}` and come from `.env`:

```jsonc
"mcp-jenkins": {
  "command": "node",
  "args": ["services/mcp-jenkins/dist/index.js"],
  "env": {
    "JENKINS_URL":  "https://jenkins.your-company.com",
    "JENKINS_USER": "${JENKINS_USER}",
    "JENKINS_TOKEN": "${JENKINS_TOKEN}",
    "NODE_TLS_REJECT_UNAUTHORIZED": "0"   // only if Jenkins uses a self-signed cert
  }
},
"mcp-svn": {
  "command": "node",
  "args": ["services/mcp-svn/dist/index.js"],
  "env": {
    "SVN_URL":      "svn://svn.your-company.com/path/to/repo",
    "SVN_USER":     "${SVN_USER}",
    "SVN_PASSWORD": "${SVN_PASSWORD}"
  }
}
```

> **TLS note** — `NODE_TLS_REJECT_UNAUTHORIZED=0` is the quickest way to make
> Node trust a self-signed corporate cert, but it disables verification. For a
> proper fix, mount the corporate CA bundle and use `NODE_EXTRA_CA_CERTS=/path/to/ca.pem`.

### 4 · Start the local Neo4j graph (optional)
Needed only by `mcp-graphify` and the orchestrator's root-cause step.
```bash
docker compose up -d neo4j
```

### 5 · Verify the wiring before plugging Copilot in
```bash
set -a; source .env; set +a            # export the secrets into the shell
export JENKINS_URL=https://jenkins.your-company.com
export SVN_URL=svn://svn.your-company.com/path/to/repo
export JENKINS_TEST_JOB=folder/job-name        # supports folder/sub-job paths
export JENKINS_TEST_BUILD=12345

npx tsx scripts/smoke-company.ts       # read-only probe (whoAmI, build, log, svn info/log)
npm run test:unit                      # 17 unit tests
npm run demo                           # narrated end-to-end demo on a local fixture
```

`scripts/smoke-company.ts` is read-only: it fetches `consoleText`, parses errors
with the production `parseMavenLog`, dumps the test report summary, and exercises
`SvnCliAdapter.log/list`. Use it whenever you change endpoints or credentials.

### 6 · Build the MCP servers
```bash
( cd services/mcp-jenkins     && npx tsc )
( cd services/mcp-svn         && npx tsc )
( cd services/mcp-jira        && npx tsc )
( cd services/mcp-graphify    && npx tsc )
```
(or simply run them via `tsx` in dev — see each service's `package.json`).

### 7 · Wire the MCP servers into your editor
Copy/symlink `mcp-servers.json` to where your client looks for it:

- **VS Code + GitHub Copilot** → `.vscode/mcp.json` in the workspace, or your
  user-level MCP config.
- **Claude Desktop** → `claude_desktop_config.json` (`mcpServers` section).

Reload the client. The tools `jenkins_analyze_build`, `svn_blame`,
`diagnose_red_build`, etc. become available.

### 8 · Use it from chat
Type something like:
> *"Build `folder/job-name` #12345 is red — run `diagnose_red_build` and tell me
> who to ping."*

The orchestrator returns:
1. Parsed compile / test errors from the Jenkins log + JUnit report.
2. The set of *suspected files* with confidence scores (root-cause analyzer
   walking the code knowledge graph).
3. The **culprit**: author + revision + `svn blame` excerpt + `svn diff -c <rev>`.
4. A suggested fix (concrete diff hunks where possible).
5. The Jira issue automatically opened for the culprit.

### Worked example — what this stack found in practice
A real run against a corporate `smoke-test/...-spring-context-bean-loading`
build flagged a single failing JUnit test whose assertion only said
*"module `X` is present in role `$ALL` but missing in role `$AUDIT`"*.
The pipeline:

1. parsed the Jenkins `testReport` and surfaced the failing class & assertion;
2. checked the build history: previous build green at SVN r*N*, current red
   at r*N+4* — so the breaking change is in the four commits in between;
3. queried `svn log -v` at the **repo root** (the build's own module had *"no
   changes since previous build"*, the breakage was transitive);
4. spotted that a shared `bom/pom.xml` bumped one library from `x.y.2` → `x.y.3`;
5. diffed the tag → exactly one file changed in that library: a
   `*AllRoleRegisterLoader.java` that added a grant for module `X` to role
   `$ALL`, with no matching change in `*AuditRoleRegisterLoader.java`;
6. **suggested fix** = add the same `grants.add(...)` line for module `X` to
   `*AuditRoleRegisterLoader.java`.

That whole chain — *failing JUnit assertion → blame on a BOM bump that pulled a
release whose only diff was a missing symmetric grant* — is what the orchestrator
is designed to do for you in one chat turn.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `SSL certificate problem: self-signed certificate` | Corporate Jenkins TLS | Add `"NODE_TLS_REJECT_UNAUTHORIZED": "0"` to the `mcp-jenkins` env, or set `NODE_EXTRA_CA_CERTS` to your CA bundle. |
| `404 Not Found` on a job path like `folder/sub-job` | Old `JenkinsApiAdapter` URL-encoded the slash | Fixed: each path segment is encoded individually (`/job/folder/job/sub-job`). Re-build `mcp-jenkins`. |
| `parseMavenLog` returns 0 errors but the build is `UNSTABLE` | Failure is a JUnit test, not a Maven `[ERROR]` | `analyzeBuild()` merges `testReport.failures` as `BuildError` of category `TEST` — make sure the orchestrator calls it (not just `getBuildLog`). |
| `svn log` shows no commits in the window but the build flipped red | Breakage is transitive (dep version bump) | Run `svn log -v` at the **repo root** (not the build module path) to see commits in sibling folders / BOM files. |
| Aggregated `testReport` returns no `suites` | Build is a `MavenModuleSetBuild` | Drill into `childReports[*].child.url` and fetch each module's `testReport`. |

## Security notes
- **Never commit `.env`** — it is in `.gitignore`. Tokens and passwords belong only there.
- `mcp-servers.json` is safe to commit because it only references `${VAR}`
  placeholders for secrets (and now also for usernames).
- If a token ever leaks (chat, log, screenshot, ticket), **revoke and rotate it**
  immediately (Jenkins → user → Configure → API Token).

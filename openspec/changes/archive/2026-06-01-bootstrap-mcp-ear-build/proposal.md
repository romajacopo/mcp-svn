## Why

Company developers (VS Code + GitHub Copilot) need to turn a red CI build into a
concrete, code-level diagnosis without manually crawling Jenkins logs, SVN
history and Jira. This change captures, as specs, the capabilities already built
and tested in this repository so coverage is explicit and verifiable.

## What Changes

- Establishes the baseline specifications for the four MCP servers (Jenkins,
  SVN, Graphify/knowledge-graph, Jira) and the orchestrator that ties them
  together into a single `diagnose_red_build` flow.
- Each requirement maps to an automated test (unit and/or integration) and, for
  the Jenkins/Neo4j adapters, to a live-instance validation script.

## Capabilities

### New Capabilities
- `jenkins-build-analysis`: parse Jenkins console logs and test reports into structured build errors.
- `svn-source-access`: read SVN history, file content, diffs and line-level blame.
- `code-knowledge-graph`: index source into a dependency graph with pluggable storage (Neo4j / in-memory).
- `root-cause-analysis`: rank suspected files and suggest a fix from build errors over the graph.
- `jira-issue-tracking`: open build-failure issues and attach analysis.
- `red-build-diagnosis`: orchestrate the end-to-end red-build diagnosis as one MCP tool.

### Modified Capabilities
<!-- none: this is the baseline -->

## Impact

- Code: `services/mcp-*`, `orchestrator/`, `shared/` (all already implemented).
- Tests: `test/unit/*`, `test/integration/*` (25 tests).
- Validation: `scripts/validate-neo4j.ts`, `scripts/validate-jenkins.ts`.
- Infra: `docker-compose.yml` (Jenkins, Jira, SVN, Neo4j + 5 MCP services).

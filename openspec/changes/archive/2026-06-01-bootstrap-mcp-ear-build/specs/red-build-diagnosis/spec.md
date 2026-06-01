## ADDED Requirements

### Requirement: Diagnose a red build end to end
The system SHALL expose a single `diagnose_red_build` MCP tool that, given a job
name and build number, returns the parsed errors, the ranked suspected files,
the culprit, a suggested fix, and the opened Jira issue key.

#### Scenario: Diagnose over MCP stdio
- **WHEN** an MCP client calls `diagnose_red_build` with `jobName=math-app` and `buildNumber=42`
- **THEN** the result contains `errors`, `suspectedFiles`, `culprit`, `suggestedFix` and `jiraIssueKey`

### Requirement: Identify the culprit as the most-recently-changed suspect
The system SHALL select, among the suspected files, the one whose latest SVN
commit has the highest revision as the culprit, reporting its author, revision
and blame — even when that file is not the file where compilation failed.

#### Scenario: Caller fails but a dependency changed last
- **WHEN** the build fails in `MathService.java` (last changed by `alice` in r1) but its dependency `Calculator.java` was changed in r2 by `bob`
- **THEN** the culprit is `Calculator.java` with author `bob` at revision `2`

### Requirement: Select adapters from the environment
The system SHALL choose its outbound adapters from environment configuration so
the same orchestration runs against real or in-memory backends.

#### Scenario: In-memory backends
- **WHEN** `GRAPH_BACKEND=memory` and `JIRA_URL` is unset
- **THEN** the orchestrator uses the in-memory graph and in-memory Jira adapters

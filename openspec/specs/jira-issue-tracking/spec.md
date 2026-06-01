# jira-issue-tracking Specification

## Purpose
TBD - created by archiving change bootstrap-mcp-ear-build. Update Purpose after archive.
## Requirements
### Requirement: Open a build-failure issue
The system SHALL create a Jira issue for a failed build, with a summary
identifying the job and build number, a Bug issue type, build-failure labels,
and an optional assignee.

#### Scenario: Create issue for a red build
- **WHEN** a build-failure issue is created for job `math-app` build `42` assigned to `bob`
- **THEN** an issue is returned whose summary contains `math-app`, whose labels include `build-failure`, and whose assignee is `bob`

### Requirement: Attach analysis to an issue
The system SHALL attach the root-cause analysis to an existing issue as a comment.

#### Scenario: Add analysis comment
- **WHEN** the analysis is attached to a created issue
- **THEN** the issue carries a comment containing the suggested fix


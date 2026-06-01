## 1. Jenkins build analysis
- [x] 1.1 Parse compilation errors (modern `[line,col]` + legacy `line:`) — `test/unit/jenkins-log-parser.test.ts`
- [x] 1.2 Extract test failures from build reports — `BuildAnalyzerService`
- [x] 1.3 Validate against live Jenkins — `scripts/validate-jenkins.ts`

## 2. SVN source access
- [x] 2.1 Parse `svn log --xml` into commits — `test/unit/svn-log-parser.test.ts`
- [x] 2.2 Blame / cat / diff / listRecursive — `SvnCliAdapter`, exercised in `test/integration/full-circle.test.ts`

## 3. Code knowledge graph
- [x] 3.1 Index Java sources into nodes/relations — `test/unit/java-parser.test.ts`
- [x] 3.2 Dependency / dependent traversal — `test/unit/in-memory-graph.test.ts`
- [x] 3.3 Pluggable store validated on real Neo4j — `scripts/validate-neo4j.ts`

## 4. Root-cause analysis
- [x] 4.1 Rank suspected files + suggest fix — `test/unit/root-cause-analyzer.test.ts`

## 5. Jira issue tracking
- [x] 5.1 Create build-failure issue + comment — `IssueTrackerService`, `test/integration/full-circle.test.ts`

## 6. Red-build diagnosis (orchestration)
- [x] 6.1 End-to-end flow + culprit identification — `test/integration/full-circle.test.ts`
- [x] 6.2 Exposed as `diagnose_red_build` over MCP stdio — `test/integration/orchestrator-tool.test.ts`

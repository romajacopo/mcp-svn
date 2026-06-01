# code-knowledge-graph Specification

## Purpose
TBD - created by archiving change bootstrap-mcp-ear-build. Update Purpose after archive.
## Requirements
### Requirement: Index source files into a dependency graph
The system SHALL parse source files into graph nodes (FILE, PACKAGE, CLASS,
METHOD, MODULE) and relations (CONTAINS, IMPORTS, EXTENDS, IMPLEMENTS,
DEPENDS_ON), persisting them in the graph store.

#### Scenario: Index a Java class with an import
- **WHEN** a Java file declaring a class and importing `com.example.math.Calculator` is indexed
- **THEN** a CLASS node is created and an IMPORTS relation links the file to `class:com.example.math.Calculator`

### Requirement: Traverse dependencies and dependents
The system SHALL return the transitive dependencies (outbound) and dependents
(inbound) of a node up to a given depth.

#### Scenario: Transitive dependencies
- **WHEN** dependencies of node `a` are requested with depth 3 in a graph `a → b → c`
- **THEN** both `b` and `c` are returned

#### Scenario: Depth limit
- **WHEN** dependencies of node `a` are requested with depth 1 in `a → b → c`
- **THEN** only `b` is returned

### Requirement: Pluggable graph storage
The system SHALL expose graph storage behind a single port so the same behavior
is available from an in-memory store and from Neo4j.

#### Scenario: Identical result across adapters
- **WHEN** the same sources are indexed and queried via the in-memory adapter and the Neo4j adapter
- **THEN** both report the same node/relation counts and the same suspected files


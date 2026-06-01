# root-cause-analysis Specification

## Purpose
TBD - created by archiving change bootstrap-mcp-ear-build. Update Purpose after archive.
## Requirements
### Requirement: Rank suspected files for build errors
The system SHALL produce a ranked list of suspected files for a set of build
errors, placing the direct error location highest and surfacing its graph
dependencies as lower-confidence suspects.

#### Scenario: Error in a caller, cause in a dependency
- **WHEN** a COMPILATION error points at `MathService.java` which depends on `Calculator.java`
- **THEN** `MathService.java` is the top suspect and `Calculator.java` appears as a lower-confidence dependency suspect

#### Scenario: Noise is filtered
- **WHEN** suspected files are computed
- **THEN** only FILE/CLASS nodes are surfaced (METHOD/PACKAGE nodes are excluded)

### Requirement: Suggest a fix oriented to the error category
The system SHALL summarise errors by category and suggest a fix whose wording
matches the dominant category.

#### Scenario: Compilation error
- **WHEN** the analysed errors are of category COMPILATION
- **THEN** the suggested fix is compilation-oriented and names the top suspect


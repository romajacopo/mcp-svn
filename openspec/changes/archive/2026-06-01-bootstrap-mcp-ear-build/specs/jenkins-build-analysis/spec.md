## ADDED Requirements

### Requirement: Parse compilation errors from a build log
The system SHALL extract structured compilation errors (file, line, message) from
a raw Jenkins/Maven console log, supporting both the modern `maven-compiler-plugin`
`file:[line,col]` format and the legacy `file:line:` format.

#### Scenario: Modern maven compiler error
- **WHEN** a log line reads `[ERROR] /workspace/.../MathService.java:[9,27] cannot find symbol`
- **THEN** one COMPILATION error is produced with the file path and line `9`

#### Scenario: Legacy file:line: format
- **WHEN** a log line reads `[ERROR] /src/Foo.java:42: incompatible types`
- **THEN** one COMPILATION error is produced with line `42`

#### Scenario: Clean log
- **WHEN** the log contains no error lines
- **THEN** no errors are produced

### Requirement: Classify dependency resolution failures
The system SHALL classify Maven dependency resolution failures as DEPENDENCY
errors attributed to `pom.xml`.

#### Scenario: Unresolved dependency
- **WHEN** the log contains `Could not resolve dependencies for project ...`
- **THEN** one DEPENDENCY error is produced with file `pom.xml`

### Requirement: Extract test failures from build reports
The system SHALL turn failed/regressed test cases from a Jenkins test report into
TEST-category build errors that point at the test's source file.

#### Scenario: Failed test case
- **WHEN** a build's test report contains a case with status FAILED
- **THEN** a TEST error is produced referencing that test class

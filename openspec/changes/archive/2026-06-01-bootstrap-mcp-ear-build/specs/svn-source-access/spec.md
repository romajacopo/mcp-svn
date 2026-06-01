## ADDED Requirements

### Requirement: Retrieve commit history
The system SHALL return the commit history for a repository path, parsing
`svn log --xml` into commits with revision, author, date, message and changed paths.

#### Scenario: Parse log entries
- **WHEN** `svn log --xml -v` output for two revisions is parsed
- **THEN** two commits are returned newest-first, each with author and changed paths

### Requirement: Attribute lines to authors
The system SHALL return line-level blame for a file, giving the revision and
author that last changed each line.

#### Scenario: Blame a modified file
- **WHEN** blame is requested for a file whose method was changed in revision 2 by `bob`
- **THEN** the changed line reports revision `2` and author `bob`

### Requirement: Read file content and changes at a revision
The system SHALL return a file's content (`cat`) and the diff introduced by a
specific revision (`diff -c`).

#### Scenario: Read a file and its change
- **WHEN** content and the revision diff are requested for a changed file
- **THEN** the file content is returned and the diff shows the added/removed lines

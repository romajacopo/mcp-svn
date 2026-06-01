export interface BuildInfo {
  jobName: string;
  buildNumber: number;
  status: "SUCCESS" | "FAILURE" | "UNSTABLE" | "ABORTED";
  timestamp: number;
  duration: number;
  url: string;
}

export interface BuildLog {
  jobName: string;
  buildNumber: number;
  rawLog: string;
  errors: BuildError[];
}

export interface BuildError {
  file: string;
  line: number;
  message: string;
  severity: "ERROR" | "WARNING";
  category: "COMPILATION" | "TEST" | "DEPENDENCY" | "RUNTIME";
}

export interface SvnCommit {
  revision: number;
  author: string;
  date: string;
  message: string;
  changedPaths: SvnChangedPath[];
}

export interface SvnChangedPath {
  action: "A" | "M" | "D" | "R";
  path: string;
}

export interface SvnFileContent {
  path: string;
  revision: number;
  content: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  labels: string[];
}

export interface CodeNode {
  id: string;
  path: string;
  type: "FILE" | "CLASS" | "METHOD" | "PACKAGE" | "MODULE";
  name: string;
  language: string;
}

export interface CodeRelation {
  source: string;
  target: string;
  type: "IMPORTS" | "EXTENDS" | "IMPLEMENTS" | "CALLS" | "DEPENDS_ON" | "CONTAINS";
}

export interface RootCauseAnalysis {
  errorSummary: string;
  suspectedFiles: SuspectedFile[];
  dependencyChain: string[];
  suggestedFix: string;
}

export interface SuspectedFile {
  path: string;
  confidence: number;
  reason: string;
  relatedNodes: string[];
}

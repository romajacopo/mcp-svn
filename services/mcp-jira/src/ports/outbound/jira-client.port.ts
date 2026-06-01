import type { JiraIssue } from "@ear-build/shared";

export interface JiraClientPort {
  getIssue(issueKey: string): Promise<JiraIssue>;
  searchIssues(jql: string, maxResults?: number): Promise<JiraIssue[]>;
  createIssue(params: CreateIssueParams): Promise<JiraIssue>;
  addComment(issueKey: string, body: string): Promise<void>;
  transitionIssue(issueKey: string, transitionName: string): Promise<void>;
}

export interface CreateIssueParams {
  projectKey: string;
  summary: string;
  description: string;
  issueType: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
}

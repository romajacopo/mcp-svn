import type { JiraIssue } from "@ear-build/shared";
import { NotFoundError } from "@ear-build/shared";
import type { JiraClientPort, CreateIssueParams } from "../../ports/outbound/jira-client.port.js";

interface StoredIssue extends JiraIssue {
  comments: string[];
}

/**
 * In-memory implementation of {@link JiraClientPort}.
 *
 * Same port as {@link JiraRestAdapter} — lets the pipeline run end-to-end
 * (and ticket payloads be asserted) without a live Jira instance.
 */
export class InMemoryJiraAdapter implements JiraClientPort {
  private readonly issues = new Map<string, StoredIssue>();
  private counter = 0;

  constructor(private readonly projectKey = "EAR") {}

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const issue = this.issues.get(issueKey);
    if (!issue) throw new NotFoundError("Issue", issueKey);
    return this.strip(issue);
  }

  async searchIssues(jql: string, maxResults = 50): Promise<JiraIssue[]> {
    return [...this.issues.values()].slice(0, maxResults).map((i) => this.strip(i));
  }

  async createIssue(params: CreateIssueParams): Promise<JiraIssue> {
    const key = `${params.projectKey}-${++this.counter}`;
    const issue: StoredIssue = {
      key,
      summary: params.summary,
      description: params.description,
      status: "Open",
      priority: params.priority ?? "Medium",
      assignee: params.assignee ?? "Unassigned",
      labels: params.labels ?? [],
      comments: [],
    };
    this.issues.set(key, issue);
    return this.strip(issue);
  }

  async addComment(issueKey: string, body: string): Promise<void> {
    const issue = this.issues.get(issueKey);
    if (!issue) throw new NotFoundError("Issue", issueKey);
    issue.comments.push(body);
  }

  async transitionIssue(issueKey: string, transitionName: string): Promise<void> {
    const issue = this.issues.get(issueKey);
    if (!issue) throw new NotFoundError("Issue", issueKey);
    issue.status = transitionName;
  }

  /** Test/demo helper: read back the full stored issue including comments. */
  inspect(issueKey: string): StoredIssue | undefined {
    return this.issues.get(issueKey);
  }

  private strip(issue: StoredIssue): JiraIssue {
    const { comments, ...rest } = issue;
    return rest;
  }
}

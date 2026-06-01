import type { JiraIssue } from "@ear-build/shared";
import type { JiraClientPort, CreateIssueParams } from "../../ports/outbound/jira-client.port.js";

export class IssueTrackerService {
  constructor(private readonly jira: JiraClientPort) {}

  async getIssue(key: string): Promise<JiraIssue> {
    return this.jira.getIssue(key);
  }

  async findRelatedIssues(errorMessage: string, projectKey: string): Promise<JiraIssue[]> {
    const keywords = errorMessage
      .split(/[\s:]+/)
      .filter((w) => w.length > 3)
      .slice(0, 5)
      .join(" OR ");

    const jql = `project = ${projectKey} AND text ~ "${keywords}" ORDER BY updated DESC`;
    return this.jira.searchIssues(jql, 10);
  }

  async createBuildFailureIssue(params: {
    projectKey: string;
    jobName: string;
    buildNumber: number;
    errorSummary: string;
    assignee?: string;
  }): Promise<JiraIssue> {
    const createParams: CreateIssueParams = {
      projectKey: params.projectKey,
      summary: `[Build Failure] ${params.jobName} #${params.buildNumber}`,
      description: [
        `h2. Build Failure Report`,
        ``,
        `*Job:* ${params.jobName}`,
        `*Build:* #${params.buildNumber}`,
        ``,
        `h3. Error Summary`,
        `{noformat}`,
        params.errorSummary,
        `{noformat}`,
      ].join("\n"),
      issueType: "Bug",
      priority: "High",
      assignee: params.assignee,
      labels: ["build-failure", "automated"],
    };

    return this.jira.createIssue(createParams);
  }

  async addAnalysisComment(issueKey: string, analysis: string): Promise<void> {
    await this.jira.addComment(issueKey, analysis);
  }
}

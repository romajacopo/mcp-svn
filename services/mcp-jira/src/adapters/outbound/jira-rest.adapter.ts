import type { JiraIssue } from "@ear-build/shared";
import { ConnectionError, NotFoundError } from "@ear-build/shared";
import type { JiraClientPort, CreateIssueParams } from "../../ports/outbound/jira-client.port.js";

interface JiraConfig {
  baseUrl: string;
  user: string;
  token: string;
}

export class JiraRestAdapter implements JiraClientPort {
  private readonly authHeader: string;

  constructor(private readonly config: JiraConfig) {
    this.authHeader = "Basic " + Buffer.from(`${config.user}:${config.token}`).toString("base64");
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const data = await this.request<JiraApiIssue>(`/rest/api/2/issue/${issueKey}`);
    return this.mapIssue(data);
  }

  async searchIssues(jql: string, maxResults = 50): Promise<JiraIssue[]> {
    const data = await this.request<{ issues: JiraApiIssue[] }>(
      `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`
    );
    return data.issues.map((i) => this.mapIssue(i));
  }

  async createIssue(params: CreateIssueParams): Promise<JiraIssue> {
    const body = {
      fields: {
        project: { key: params.projectKey },
        summary: params.summary,
        description: params.description,
        issuetype: { name: params.issueType },
        ...(params.priority && { priority: { name: params.priority } }),
        ...(params.assignee && { assignee: { name: params.assignee } }),
        ...(params.labels && { labels: params.labels }),
      },
    };

    const data = await this.request<{ key: string }>("/rest/api/2/issue", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return this.getIssue(data.key);
  }

  async addComment(issueKey: string, body: string): Promise<void> {
    await this.request(`/rest/api/2/issue/${issueKey}/comment`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  async transitionIssue(issueKey: string, transitionName: string): Promise<void> {
    const transitions = await this.request<{ transitions: { id: string; name: string }[] }>(
      `/rest/api/2/issue/${issueKey}/transitions`
    );
    const target = transitions.transitions.find(
      (t) => t.name.toLowerCase() === transitionName.toLowerCase()
    );
    if (!target) throw new NotFoundError("Transition", transitionName);

    await this.request(`/rest/api/2/issue/${issueKey}/transitions`, {
      method: "POST",
      body: JSON.stringify({ transition: { id: target.id } }),
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
    } catch (err) {
      throw new ConnectionError("Jira", err);
    }
    if (res.status === 404) throw new NotFoundError("Issue", path);
    if (!res.ok) throw new ConnectionError("Jira");
    return res.json() as Promise<T>;
  }

  private mapIssue(data: JiraApiIssue): JiraIssue {
    return {
      key: data.key,
      summary: data.fields.summary,
      description: data.fields.description || "",
      status: data.fields.status.name,
      priority: data.fields.priority?.name || "Medium",
      assignee: data.fields.assignee?.displayName || "Unassigned",
      labels: data.fields.labels || [],
    };
  }
}

interface JiraApiIssue {
  key: string;
  fields: {
    summary: string;
    description: string | null;
    status: { name: string };
    priority: { name: string } | null;
    assignee: { displayName: string } | null;
    labels: string[];
  };
}

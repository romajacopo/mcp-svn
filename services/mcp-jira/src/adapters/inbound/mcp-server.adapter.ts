import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { IssueTrackerService } from "../../domain/services/issue-tracker.service.js";

export class McpServerAdapter {
  private readonly server: Server;

  constructor(private readonly tracker: IssueTrackerService) {
    this.server = new Server(
      { name: "mcp-jira", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.registerHandlers();
  }

  private registerHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "jira_get_issue",
          description: "Get a Jira issue by key",
          inputSchema: {
            type: "object",
            properties: { key: { type: "string", description: "Issue key (e.g. PROJ-123)" } },
            required: ["key"],
          },
        },
        {
          name: "jira_find_related",
          description: "Find Jira issues related to an error message",
          inputSchema: {
            type: "object",
            properties: {
              errorMessage: { type: "string", description: "Error text to search for" },
              projectKey: { type: "string", description: "Jira project key" },
            },
            required: ["errorMessage", "projectKey"],
          },
        },
        {
          name: "jira_create_build_failure",
          description: "Create a Jira bug for a build failure",
          inputSchema: {
            type: "object",
            properties: {
              projectKey: { type: "string", description: "Jira project key" },
              jobName: { type: "string", description: "Jenkins job name" },
              buildNumber: { type: "number", description: "Build number" },
              errorSummary: { type: "string", description: "Summary of the error" },
              assignee: { type: "string", description: "Assignee username (optional)" },
            },
            required: ["projectKey", "jobName", "buildNumber", "errorSummary"],
          },
        },
        {
          name: "jira_add_comment",
          description: "Add a comment to an existing Jira issue",
          inputSchema: {
            type: "object",
            properties: {
              key: { type: "string", description: "Issue key" },
              comment: { type: "string", description: "Comment body" },
            },
            required: ["key", "comment"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "jira_get_issue": {
          const issue = await this.tracker.getIssue(args!.key as string);
          return { content: [{ type: "text", text: JSON.stringify(issue, null, 2) }] };
        }
        case "jira_find_related": {
          const issues = await this.tracker.findRelatedIssues(
            args!.errorMessage as string, args!.projectKey as string
          );
          return { content: [{ type: "text", text: JSON.stringify(issues, null, 2) }] };
        }
        case "jira_create_build_failure": {
          const issue = await this.tracker.createBuildFailureIssue({
            projectKey: args!.projectKey as string,
            jobName: args!.jobName as string,
            buildNumber: args!.buildNumber as number,
            errorSummary: args!.errorSummary as string,
            assignee: args?.assignee as string | undefined,
          });
          return { content: [{ type: "text", text: JSON.stringify(issue, null, 2) }] };
        }
        case "jira_add_comment": {
          await this.tracker.addAnalysisComment(args!.key as string, args!.comment as string);
          return { content: [{ type: "text", text: `Comment added to ${args!.key}` }] };
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

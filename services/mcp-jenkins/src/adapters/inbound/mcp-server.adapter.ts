import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { BuildAnalyzerService } from "../../domain/services/build-analyzer.service.js";
import type { JenkinsClientPort } from "../../ports/outbound/jenkins-client.port.js";

export class McpServerAdapter {
  private readonly server: Server;

  constructor(
    private readonly jenkins: JenkinsClientPort,
    private readonly analyzer: BuildAnalyzerService
  ) {
    this.server = new Server(
      { name: "mcp-jenkins", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.registerHandlers();
  }

  private registerHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "jenkins_list_jobs",
          description: "List all Jenkins jobs",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "jenkins_get_build",
          description: "Get build info for a specific job and build number",
          inputSchema: {
            type: "object",
            properties: {
              jobName: { type: "string", description: "Jenkins job name" },
              buildNumber: { type: "number", description: "Build number" },
            },
            required: ["jobName", "buildNumber"],
          },
        },
        {
          name: "jenkins_get_last_build",
          description: "Get the last build info for a job",
          inputSchema: {
            type: "object",
            properties: {
              jobName: { type: "string", description: "Jenkins job name" },
            },
            required: ["jobName"],
          },
        },
        {
          name: "jenkins_get_failed_builds",
          description: "Get recent failed builds for a job",
          inputSchema: {
            type: "object",
            properties: {
              jobName: { type: "string", description: "Jenkins job name" },
              limit: { type: "number", description: "Max results (default 10)" },
            },
            required: ["jobName"],
          },
        },
        {
          name: "jenkins_get_build_log",
          description: "Get raw console log for a build",
          inputSchema: {
            type: "object",
            properties: {
              jobName: { type: "string", description: "Jenkins job name" },
              buildNumber: { type: "number", description: "Build number" },
            },
            required: ["jobName", "buildNumber"],
          },
        },
        {
          name: "jenkins_analyze_build",
          description: "Analyze a failed build: parse errors, extract test failures, identify root cause patterns",
          inputSchema: {
            type: "object",
            properties: {
              jobName: { type: "string", description: "Jenkins job name" },
              buildNumber: { type: "number", description: "Build number" },
            },
            required: ["jobName", "buildNumber"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "jenkins_list_jobs": {
          const jobs = await this.jenkins.getJobs();
          return { content: [{ type: "text", text: JSON.stringify(jobs, null, 2) }] };
        }
        case "jenkins_get_build": {
          const build = await this.jenkins.getBuild(args!.jobName as string, args!.buildNumber as number);
          return { content: [{ type: "text", text: JSON.stringify(build, null, 2) }] };
        }
        case "jenkins_get_last_build": {
          const build = await this.jenkins.getLastBuild(args!.jobName as string);
          return { content: [{ type: "text", text: JSON.stringify(build, null, 2) }] };
        }
        case "jenkins_get_failed_builds": {
          const builds = await this.jenkins.getFailedBuilds(args!.jobName as string, args?.limit as number);
          return { content: [{ type: "text", text: JSON.stringify(builds, null, 2) }] };
        }
        case "jenkins_get_build_log": {
          const log = await this.jenkins.getBuildLog(args!.jobName as string, args!.buildNumber as number);
          return { content: [{ type: "text", text: log }] };
        }
        case "jenkins_analyze_build": {
          const analysis = await this.analyzer.analyzeBuild(args!.jobName as string, args!.buildNumber as number);
          return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
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

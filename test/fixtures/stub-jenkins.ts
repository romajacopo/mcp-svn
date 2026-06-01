import type { BuildInfo } from "@ear-build/shared";
import type { JenkinsClientPort, TestReport } from "../../services/mcp-jenkins/src/ports/outbound/jenkins-client.port.js";

/**
 * Test double for {@link JenkinsClientPort} that replays a captured console log.
 * The error-parsing logic under test is the real one — only the HTTP fetch is faked.
 */
export class StubJenkinsClient implements JenkinsClientPort {
  constructor(
    private readonly jobName: string,
    private readonly buildNumber: number,
    private readonly consoleLog: string,
    private readonly testReport: TestReport | null = null
  ) {}

  async getJobs(): Promise<string[]> {
    return [this.jobName];
  }

  async getBuild(jobName: string, buildNumber: number): Promise<BuildInfo> {
    return this.buildInfo(jobName, buildNumber, "FAILURE");
  }

  async getLastBuild(jobName: string): Promise<BuildInfo> {
    return this.buildInfo(jobName, this.buildNumber, "FAILURE");
  }

  async getFailedBuilds(jobName: string): Promise<BuildInfo[]> {
    return [this.buildInfo(jobName, this.buildNumber, "FAILURE")];
  }

  async getBuildLog(): Promise<string> {
    return this.consoleLog;
  }

  async getBuildTestReport(): Promise<TestReport | null> {
    return this.testReport;
  }

  private buildInfo(jobName: string, buildNumber: number, status: BuildInfo["status"]): BuildInfo {
    return {
      jobName,
      buildNumber,
      status,
      timestamp: 0,
      duration: 0,
      url: `http://jenkins/job/${jobName}/${buildNumber}/`,
    };
  }
}

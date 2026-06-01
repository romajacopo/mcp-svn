import type { BuildError, BuildLog } from "@ear-build/shared";
import type { JenkinsClientPort, TestReport } from "../../ports/outbound/jenkins-client.port.js";
import { parseMavenLog } from "./log-error-parser.js";

export class BuildAnalyzerService {
  constructor(private readonly jenkins: JenkinsClientPort) {}

  async analyzeBuild(jobName: string, buildNumber: number): Promise<BuildLog> {
    const rawLog = await this.jenkins.getBuildLog(jobName, buildNumber);
    const errors = parseMavenLog(rawLog);
    const testReport = await this.jenkins.getBuildTestReport(jobName, buildNumber);

    if (testReport) {
      errors.push(...this.extractTestErrors(testReport));
    }

    return { jobName, buildNumber, rawLog, errors };
  }

  private extractTestErrors(report: TestReport): BuildError[] {
    return report.failures.map((failure) => ({
      file: failure.className.replace(/\./g, "/") + ".java",
      line: this.extractLineFromStack(failure.errorStackTrace),
      message: `${failure.name}: ${failure.errorDetails}`,
      severity: "ERROR" as const,
      category: "TEST" as const,
    }));
  }

  private extractLineFromStack(stack: string): number {
    const match = stack.match(/:(\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

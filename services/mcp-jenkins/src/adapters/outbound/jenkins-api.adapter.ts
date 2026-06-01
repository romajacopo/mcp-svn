import type { BuildInfo } from "@ear-build/shared";
import { ConnectionError, NotFoundError } from "@ear-build/shared";
import type { JenkinsClientPort, TestReport, TestFailure } from "../../ports/outbound/jenkins-client.port.js";

interface JenkinsConfig {
  baseUrl: string;
  user: string;
  token: string;
}

export class JenkinsApiAdapter implements JenkinsClientPort {
  private readonly authHeader: string;

  constructor(private readonly config: JenkinsConfig) {
    this.authHeader = "Basic " + Buffer.from(`${config.user}:${config.token}`).toString("base64");
  }

  /**
   * Build the URL path prefix for a job, supporting Jenkins folders.
   * "a/b/c" → "/job/a/job/b/job/c" (each segment encoded individually).
   */
  private jobPath(jobName: string): string {
    return jobName
      .split("/")
      .filter(Boolean)
      .map((seg) => `/job/${encodeURIComponent(seg)}`)
      .join("");
  }

  async getJobs(): Promise<string[]> {
    const data = await this.request<{ jobs: { name: string }[] }>("/api/json?tree=jobs[name]");
    return data.jobs.map((j) => j.name);
  }

  async getBuild(jobName: string, buildNumber: number): Promise<BuildInfo> {
    const data = await this.request<JenkinsBuildResponse>(
      `${this.jobPath(jobName)}/${buildNumber}/api/json`
    );
    return this.mapBuild(jobName, data);
  }

  async getLastBuild(jobName: string): Promise<BuildInfo> {
    const data = await this.request<JenkinsBuildResponse>(
      `${this.jobPath(jobName)}/lastBuild/api/json`
    );
    return this.mapBuild(jobName, data);
  }

  async getFailedBuilds(jobName: string, limit = 10): Promise<BuildInfo[]> {
    const data = await this.request<{ builds: JenkinsBuildResponse[] }>(
      `${this.jobPath(jobName)}/api/json?tree=builds[number,result,timestamp,duration,url]{0,${limit}}`
    );
    return data.builds
      .filter((b) => b.result === "FAILURE")
      .map((b) => this.mapBuild(jobName, b));
  }

  async getBuildLog(jobName: string, buildNumber: number): Promise<string> {
    const url = `${this.config.baseUrl}${this.jobPath(jobName)}/${buildNumber}/consoleText`;
    const res = await fetch(url, { headers: { Authorization: this.authHeader } });
    if (!res.ok) throw new NotFoundError("BuildLog", `${jobName}#${buildNumber}`);
    return res.text();
  }

  async getBuildTestReport(jobName: string, buildNumber: number): Promise<TestReport | null> {
    try {
      const data = await this.request<JenkinsTestReport>(
        `${this.jobPath(jobName)}/${buildNumber}/testReport/api/json`
      );
      return {
        totalCount: data.totalCount,
        failCount: data.failCount,
        skipCount: data.skipCount,
        failures: data.suites
          .flatMap((s) => s.cases)
          .filter((c) => c.status === "FAILED" || c.status === "REGRESSION")
          .map((c) => ({
            className: c.className,
            name: c.name,
            errorDetails: c.errorDetails || "",
            errorStackTrace: c.errorStackTrace || "",
          })),
      };
    } catch {
      return null;
    }
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: this.authHeader } });
    } catch (err) {
      throw new ConnectionError("Jenkins", err);
    }
    if (res.status === 404) throw new NotFoundError("Resource", path);
    if (!res.ok) throw new ConnectionError("Jenkins");
    return res.json() as Promise<T>;
  }

  private mapBuild(jobName: string, data: JenkinsBuildResponse): BuildInfo {
    return {
      jobName,
      buildNumber: data.number,
      status: (data.result as BuildInfo["status"]) || "ABORTED",
      timestamp: data.timestamp,
      duration: data.duration,
      url: data.url,
    };
  }
}

interface JenkinsBuildResponse {
  number: number;
  result: string;
  timestamp: number;
  duration: number;
  url: string;
}

interface JenkinsTestReport {
  totalCount: number;
  failCount: number;
  skipCount: number;
  suites: { cases: JenkinsTestCase[] }[];
}

interface JenkinsTestCase {
  className: string;
  name: string;
  status: string;
  errorDetails?: string;
  errorStackTrace?: string;
}

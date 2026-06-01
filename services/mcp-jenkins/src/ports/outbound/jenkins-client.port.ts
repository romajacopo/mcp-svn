import type { BuildInfo, BuildLog } from "@ear-build/shared";

export interface JenkinsClientPort {
  getJobs(): Promise<string[]>;
  getBuild(jobName: string, buildNumber: number): Promise<BuildInfo>;
  getLastBuild(jobName: string): Promise<BuildInfo>;
  getFailedBuilds(jobName: string, limit?: number): Promise<BuildInfo[]>;
  getBuildLog(jobName: string, buildNumber: number): Promise<string>;
  getBuildTestReport(jobName: string, buildNumber: number): Promise<TestReport | null>;
}

export interface TestReport {
  totalCount: number;
  failCount: number;
  skipCount: number;
  failures: TestFailure[];
}

export interface TestFailure {
  className: string;
  name: string;
  errorDetails: string;
  errorStackTrace: string;
}

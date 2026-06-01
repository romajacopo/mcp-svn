import type { SvnCommit } from "@ear-build/shared";
import type { SvnClientPort } from "../../ports/outbound/svn-client.port.js";

export class CommitResolverService {
  constructor(private readonly svn: SvnClientPort) {}

  async getRecentCommits(path: string, limit?: number): Promise<SvnCommit[]> {
    return this.svn.log(path, limit);
  }

  async getCommitDiff(path: string, revision: number): Promise<string> {
    return this.svn.diff(path, revision);
  }

  async getFileAtRevision(path: string, revision: number): Promise<string> {
    const file = await this.svn.cat(path, revision);
    return file.content;
  }

  async findCommitsForFile(filePath: string, limit = 10): Promise<SvnCommit[]> {
    const commits = await this.svn.log(filePath, limit);
    return commits.filter((c) =>
      c.changedPaths.some((p) => p.path.includes(filePath))
    );
  }

  async getBlameForLines(filePath: string, startLine: number, endLine: number): Promise<string> {
    const blame = await this.svn.blame(filePath);
    return blame
      .filter((b) => b.lineNumber >= startLine && b.lineNumber <= endLine)
      .map((b) => `r${b.revision} ${b.author} | ${b.content}`)
      .join("\n");
  }
}

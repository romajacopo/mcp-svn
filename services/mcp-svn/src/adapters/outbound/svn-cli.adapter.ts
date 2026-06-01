import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SvnCommit, SvnFileContent } from "@ear-build/shared";
import { ConnectionError } from "@ear-build/shared";
import type { SvnClientPort, BlameLine, SvnInfo } from "../../ports/outbound/svn-client.port.js";
import { parseSvnLogXml } from "./svn-log.parser.js";

const exec = promisify(execFile);

interface SvnConfig {
  url: string;
  user: string;
  password: string;
}

export class SvnCliAdapter implements SvnClientPort {
  private readonly authArgs: string[];

  constructor(private readonly config: SvnConfig) {
    this.authArgs = [
      "--username", config.user,
      "--password", config.password,
      "--non-interactive",
      "--no-auth-cache",
    ];
  }

  async log(path: string, limit = 20): Promise<SvnCommit[]> {
    const fullPath = this.resolvePath(path);
    const { stdout } = await this.run(["log", fullPath, "--xml", "-v", "--limit", String(limit)]);
    return parseSvnLogXml(stdout);
  }

  async logRange(path: string, fromRev: number, toRev: number): Promise<SvnCommit[]> {
    const fullPath = this.resolvePath(path);
    const { stdout } = await this.run(["log", fullPath, "--xml", "-v", "-r", `${fromRev}:${toRev}`]);
    return parseSvnLogXml(stdout);
  }

  async diff(path: string, revision: number): Promise<string> {
    const fullPath = this.resolvePath(path);
    const { stdout } = await this.run(["diff", fullPath, "-c", String(revision)]);
    return stdout;
  }

  async cat(path: string, revision?: number): Promise<SvnFileContent> {
    const fullPath = this.resolvePath(path);
    const args = ["cat", fullPath];
    if (revision) args.push("-r", String(revision));
    const { stdout } = await this.run(args);
    return { path, revision: revision || 0, content: stdout };
  }

  async list(path: string, revision?: number): Promise<string[]> {
    const fullPath = this.resolvePath(path);
    const args = ["list", fullPath];
    if (revision) args.push("-r", String(revision));
    const { stdout } = await this.run(args);
    return stdout.trim().split("\n").filter(Boolean);
  }

  async listRecursive(path: string, revision?: number): Promise<string[]> {
    const fullPath = this.resolvePath(path);
    const args = ["list", "-R", fullPath];
    if (revision) args.push("-r", String(revision));
    const { stdout } = await this.run(args);
    return stdout
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.endsWith("/"));
  }

  async blame(path: string, revision?: number): Promise<BlameLine[]> {
    const fullPath = this.resolvePath(path);
    const args = ["blame", fullPath];
    if (revision) args.push("-r", `1:${revision}`);
    const { stdout } = await this.run(args);
    const lines = stdout.split("\n");
    if (lines.at(-1) === "") lines.pop(); // drop trailing newline artifact, keep line numbers
    return lines.map((line, i) => {
      const match = line.match(/^\s*(\d+)\s+(\S+)\s(.*)$/);
      return {
        revision: match ? parseInt(match[1], 10) : 0,
        author: match ? match[2] : "unknown",
        lineNumber: i + 1,
        content: match ? match[3] : line,
      };
    });
  }

  async info(path: string): Promise<SvnInfo> {
    const fullPath = this.resolvePath(path);
    const { stdout } = await this.run(["info", fullPath, "--xml"]);
    const urlMatch = stdout.match(/<url>(.+?)<\/url>/);
    const revMatch = stdout.match(/revision="(\d+)"/);
    const authorMatch = stdout.match(/<author>(.+?)<\/author>/);
    const dateMatch = stdout.match(/<date>(.+?)<\/date>/);
    return {
      url: urlMatch?.[1] || fullPath,
      lastChangedRev: revMatch ? parseInt(revMatch[1], 10) : 0,
      lastChangedAuthor: authorMatch?.[1] || "unknown",
      lastChangedDate: dateMatch?.[1] || "",
    };
  }

  private resolvePath(path: string): string {
    if (path.startsWith("svn://") || path.startsWith("http")) return path;
    return `${this.config.url}/${path.replace(/^\//, "")}`;
  }

  private async run(args: string[]): Promise<{ stdout: string }> {
    try {
      return await exec("svn", [...args, ...this.authArgs], { maxBuffer: 50 * 1024 * 1024 });
    } catch (err: any) {
      throw new ConnectionError("SVN", err.message || err);
    }
  }
}

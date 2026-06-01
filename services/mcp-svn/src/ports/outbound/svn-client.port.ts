import type { SvnCommit, SvnFileContent } from "@ear-build/shared";

export interface SvnClientPort {
  log(path: string, limit?: number): Promise<SvnCommit[]>;
  logRange(path: string, fromRev: number, toRev: number): Promise<SvnCommit[]>;
  diff(path: string, revision: number): Promise<string>;
  cat(path: string, revision?: number): Promise<SvnFileContent>;
  list(path: string, revision?: number): Promise<string[]>;
  listRecursive(path: string, revision?: number): Promise<string[]>;
  blame(path: string, revision?: number): Promise<BlameLine[]>;
  info(path: string): Promise<SvnInfo>;
}

export interface BlameLine {
  revision: number;
  author: string;
  lineNumber: number;
  content: string;
}

export interface SvnInfo {
  url: string;
  lastChangedRev: number;
  lastChangedAuthor: string;
  lastChangedDate: string;
}

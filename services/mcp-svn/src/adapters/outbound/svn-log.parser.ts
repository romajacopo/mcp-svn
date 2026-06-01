import type { SvnCommit, SvnChangedPath } from "@ear-build/shared";

/**
 * Pure parser for `svn log --xml -v` output.
 * No I/O — takes the raw XML string and returns structured commits.
 */
export function parseSvnLogXml(xml: string): SvnCommit[] {
  const entries: SvnCommit[] = [];
  const logEntryRegex = /<logentry\s+revision="(\d+)">([\s\S]*?)<\/logentry>/g;
  let match: RegExpExecArray | null;

  while ((match = logEntryRegex.exec(xml)) !== null) {
    const revision = parseInt(match[1], 10);
    const body = match[2];
    const author = body.match(/<author>(.+?)<\/author>/)?.[1] || "unknown";
    const date = body.match(/<date>(.+?)<\/date>/)?.[1] || "";
    const message = body.match(/<msg>([\s\S]*?)<\/msg>/)?.[1]?.trim() || "";

    const changedPaths: SvnChangedPath[] = [];
    const pathRegex = /<path\s[^>]*action="([AMDR])"[^>]*>(.+?)<\/path>/g;
    let pathMatch: RegExpExecArray | null;
    while ((pathMatch = pathRegex.exec(body)) !== null) {
      changedPaths.push({
        action: pathMatch[1] as SvnChangedPath["action"],
        path: pathMatch[2],
      });
    }

    entries.push({ revision, author, date, message, changedPaths });
  }

  return entries;
}

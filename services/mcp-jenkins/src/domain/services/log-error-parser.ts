import type { BuildError } from "@ear-build/shared";

/**
 * Pure parser for Maven/Java build console logs.
 * Extracts structured {@link BuildError}s from raw text — no I/O, fully testable.
 */
export function parseMavenLog(log: string): BuildError[] {
  const errors: BuildError[] = [];

  for (const line of log.split("\n")) {
    // Modern maven-compiler-plugin / javac: "[ERROR] /path/File.java:[line,col] message"
    const colMatch = line.match(/\[ERROR\]\s+(\S+?):\[(\d+),\d+\]\s*(.+)/);
    if (colMatch) {
      errors.push({
        file: colMatch[1],
        line: parseInt(colMatch[2], 10),
        message: colMatch[3].trim(),
        severity: "ERROR",
        category: "COMPILATION",
      });
      continue;
    }

    // Legacy / other tools: "[ERROR] /path/File.java:line: message"
    const lineMatch = line.match(/\[ERROR\]\s+(\S+?):(\d+):\s*(.+)/);
    if (lineMatch) {
      errors.push({
        file: lineMatch[1],
        line: parseInt(lineMatch[2], 10),
        message: lineMatch[3].trim(),
        severity: "ERROR",
        category: "COMPILATION",
      });
      continue;
    }

    const depMatch = line.match(/Could not resolve dependencies for project .+?: (.+)/);
    if (depMatch) {
      errors.push({
        file: "pom.xml",
        line: 0,
        message: depMatch[1].trim(),
        severity: "ERROR",
        category: "DEPENDENCY",
      });
    }
  }

  return errors;
}

import type { BuildError, CodeNode, RootCauseAnalysis, SuspectedFile } from "@ear-build/shared";
import type { GraphStorePort } from "../../ports/outbound/graph-store.port.js";

export class RootCauseAnalyzerService {
  constructor(private readonly graph: GraphStorePort) {}

  async analyze(errors: BuildError[]): Promise<RootCauseAnalysis> {
    const suspectedFiles: SuspectedFile[] = [];
    const dependencyChains: string[][] = [];

    for (const error of errors) {
      const node = await this.graph.findNodeByPath(error.file);
      if (!node) {
        suspectedFiles.push({
          path: error.file,
          confidence: 0.9,
          reason: `Direct error location: ${error.message}`,
          relatedNodes: [],
        });
        continue;
      }

      const dependents = await this.graph.findDependents(node.id, 2);
      const dependencies = await this.graph.findDependencies(node.id, 2);

      suspectedFiles.push({
        path: error.file,
        confidence: 0.95,
        reason: `Direct error: ${error.message}`,
        relatedNodes: dependents.map((d) => d.id).slice(0, 5),
      });

      for (const dep of dependencies) {
        if (dep.type !== "FILE" && dep.type !== "CLASS") continue;
        const existing = suspectedFiles.find((s) => s.path === dep.path);
        if (existing) {
          existing.confidence = Math.min(existing.confidence + 0.1, 0.9);
        } else {
          suspectedFiles.push({
            path: dep.path,
            confidence: 0.4,
            reason: `Dependency of ${error.file} — may propagate the error`,
            relatedNodes: [node.id],
          });
        }
      }

      dependencyChains.push([error.file, ...dependencies.map((d) => d.path).slice(0, 5)]);
    }

    const impactedPaths = errors.map((e) => e.file);
    const impacted = await this.graph.findImpactedNodes(impactedPaths);
    for (const node of impacted) {
      if (node.type !== "FILE" && node.type !== "CLASS") continue;
      if (!suspectedFiles.find((s) => s.path === node.path)) {
        suspectedFiles.push({
          path: node.path,
          confidence: 0.3,
          reason: `Depends on modified files — potential cascading impact`,
          relatedNodes: impactedPaths,
        });
      }
    }

    suspectedFiles.sort((a, b) => b.confidence - a.confidence);

    return {
      errorSummary: this.buildErrorSummary(errors),
      suspectedFiles: suspectedFiles.slice(0, 15),
      dependencyChain: dependencyChains.flat().filter((v, i, a) => a.indexOf(v) === i),
      suggestedFix: this.generateFixSuggestion(errors, suspectedFiles),
    };
  }

  async findImpactOfChange(changedPaths: string[]): Promise<CodeNode[]> {
    return this.graph.findImpactedNodes(changedPaths);
  }

  private buildErrorSummary(errors: BuildError[]): string {
    const byCategory = new Map<string, BuildError[]>();
    for (const e of errors) {
      const list = byCategory.get(e.category) || [];
      list.push(e);
      byCategory.set(e.category, list);
    }

    const parts: string[] = [];
    for (const [cat, errs] of byCategory) {
      parts.push(`${cat}: ${errs.length} error(s) — ${errs[0].message}`);
    }
    return parts.join("\n");
  }

  private generateFixSuggestion(errors: BuildError[], suspects: SuspectedFile[]): string {
    const topSuspect = suspects[0];
    if (!topSuspect) return "Insufficient data to suggest a fix.";

    const categories = new Set(errors.map((e) => e.category));

    if (categories.has("COMPILATION")) {
      return `Compilation error in ${topSuspect.path}. Check the import statements and class/method signatures. Related files: ${topSuspect.relatedNodes.join(", ")}`;
    }
    if (categories.has("TEST")) {
      return `Test failure originating from ${topSuspect.path}. Review recent changes to this file and its dependencies: ${topSuspect.relatedNodes.join(", ")}`;
    }
    if (categories.has("DEPENDENCY")) {
      return `Dependency resolution failure. Check pom.xml for version conflicts or missing repositories.`;
    }
    return `Error in ${topSuspect.path}: ${topSuspect.reason}`;
  }
}

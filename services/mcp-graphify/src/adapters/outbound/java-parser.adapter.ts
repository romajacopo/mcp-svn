import type { CodeNode, CodeRelation } from "@ear-build/shared";
import type { CodeParserPort, ParseResult } from "../../ports/outbound/code-parser.port.js";

export class JavaParserAdapter implements CodeParserPort {
  supportedExtensions(): string[] {
    return [".java", ".xml"];
  }

  parseFile(path: string, content: string): ParseResult {
    if (path.endsWith(".xml")) return this.parsePom(path, content);
    return this.parseJava(path, content);
  }

  private parseJava(path: string, content: string): ParseResult {
    const nodes: CodeNode[] = [];
    const relations: CodeRelation[] = [];

    const fileNode: CodeNode = {
      id: path,
      path,
      type: "FILE",
      name: path.split("/").pop() || path,
      language: "java",
    };
    nodes.push(fileNode);

    const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
    const packageName = packageMatch?.[1] || "";

    if (packageName) {
      const pkgNode: CodeNode = {
        id: `pkg:${packageName}`,
        path: packageName.replace(/\./g, "/"),
        type: "PACKAGE",
        name: packageName,
        language: "java",
      };
      nodes.push(pkgNode);
      relations.push({ source: pkgNode.id, target: fileNode.id, type: "CONTAINS" });
    }

    const classRegex = /(?:public\s+)?(?:abstract\s+)?(?:class|interface|enum)\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
    let classMatch;
    while ((classMatch = classRegex.exec(content)) !== null) {
      const className = classMatch[1];
      const fqcn = packageName ? `${packageName}.${className}` : className;
      const classNode: CodeNode = {
        id: `class:${fqcn}`,
        path,
        type: "CLASS",
        name: className,
        language: "java",
      };
      nodes.push(classNode);
      relations.push({ source: fileNode.id, target: classNode.id, type: "CONTAINS" });

      if (classMatch[2]) {
        relations.push({ source: classNode.id, target: `class:${classMatch[2]}`, type: "EXTENDS" });
      }
      if (classMatch[3]) {
        const interfaces = classMatch[3].split(",").map((i) => i.trim());
        for (const iface of interfaces) {
          relations.push({ source: classNode.id, target: `class:${iface}`, type: "IMPLEMENTS" });
        }
      }

      const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/g;
      let methodMatch;
      while ((methodMatch = methodRegex.exec(content)) !== null) {
        const methodName = methodMatch[1];
        const methodNode: CodeNode = {
          id: `method:${fqcn}.${methodName}`,
          path,
          type: "METHOD",
          name: methodName,
          language: "java",
        };
        nodes.push(methodNode);
        relations.push({ source: classNode.id, target: methodNode.id, type: "CONTAINS" });
      }
    }

    const importRegex = /import\s+([\w.]+)\s*;/g;
    let importMatch;
    while ((importMatch = importRegex.exec(content)) !== null) {
      const importedClass = importMatch[1];
      relations.push({ source: fileNode.id, target: `class:${importedClass}`, type: "IMPORTS" });
    }

    return { nodes, relations };
  }

  private parsePom(path: string, content: string): ParseResult {
    const nodes: CodeNode[] = [];
    const relations: CodeRelation[] = [];

    const fileNode: CodeNode = { id: path, path, type: "FILE", name: "pom.xml", language: "xml" };
    nodes.push(fileNode);

    const artifactMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
    if (artifactMatch) {
      const moduleNode: CodeNode = {
        id: `module:${artifactMatch[1]}`,
        path,
        type: "MODULE",
        name: artifactMatch[1],
        language: "java",
      };
      nodes.push(moduleNode);
      relations.push({ source: moduleNode.id, target: fileNode.id, type: "CONTAINS" });
    }

    const depRegex = /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>/g;
    let depMatch;
    while ((depMatch = depRegex.exec(content)) !== null) {
      const depId = `module:${depMatch[1]}:${depMatch[2]}`;
      const depNode: CodeNode = {
        id: depId,
        path: "",
        type: "MODULE",
        name: `${depMatch[1]}:${depMatch[2]}`,
        language: "java",
      };
      nodes.push(depNode);
      if (artifactMatch) {
        relations.push({ source: `module:${artifactMatch[1]}`, target: depId, type: "DEPENDS_ON" });
      }
    }

    return { nodes, relations };
  }
}

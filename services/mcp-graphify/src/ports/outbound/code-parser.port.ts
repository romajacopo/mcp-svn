import type { CodeNode, CodeRelation } from "@ear-build/shared";

export interface CodeParserPort {
  parseFile(path: string, content: string): ParseResult;
  supportedExtensions(): string[];
}

export interface ParseResult {
  nodes: CodeNode[];
  relations: CodeRelation[];
}

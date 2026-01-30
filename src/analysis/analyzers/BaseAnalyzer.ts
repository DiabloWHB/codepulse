import { SyntaxNode } from '../Parser';
import { Issue, FunctionInfo, SourceLocation, IssueSeverity, IssueCategory } from '../../types';
import { Logger } from '../../utils/logger';
import { createUniqueId } from '../../utils/hash';

export interface AnalysisContext {
  filePath: string;
  content: string;
  rootNode: SyntaxNode;
  functions: FunctionInfo[];
  workspaceRoot: string;
}

export interface AnalyzerResult {
  issues: Issue[];
  functionUpdates?: Map<string, Partial<FunctionInfo>>;
}

/**
 * Base class for all analyzers.
 */
export abstract class BaseAnalyzer {
  public abstract readonly name: string;
  public abstract readonly category: IssueCategory;
  protected readonly logger: Logger;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  public abstract analyze(context: AnalysisContext): Promise<AnalyzerResult>;

  public shouldAnalyze(_context: AnalysisContext): boolean {
    return true;
  }

  protected createIssue(
    severity: IssueSeverity,
    message: string,
    description: string,
    location: SourceLocation,
    options?: { fix?: Issue['fix']; documentationUrl?: string }
  ): Issue {
    return {
      id: createUniqueId(
        this.name,
        this.category,
        location.file,
        String(location.startLine),
        message
      ),
      severity,
      category: this.category,
      message: message.substring(0, 80),
      description,
      location,
      source: this.name,
      fix: options?.fix,
      documentationUrl: options?.documentationUrl,
      detectedAt: Date.now()
    };
  }

  protected nodeToLocation(node: SyntaxNode, filePath: string): SourceLocation {
    return {
      file: filePath,
      startLine: node.startPosition.row,
      startColumn: node.startPosition.column,
      endLine: node.endPosition.row,
      endColumn: node.endPosition.column
    };
  }

  protected findNodes(root: SyntaxNode, type: string | string[]): SyntaxNode[] {
    const types = Array.isArray(type) ? type : [type];
    const nodes: SyntaxNode[] = [];
    this.traverse(root, (node) => {
      if (types.includes(node.type)) nodes.push(node);
    });
    return nodes;
  }

  protected traverse(node: SyntaxNode, visitor: (node: SyntaxNode) => void): void {
    visitor(node);
    for (const child of node.children) {
      this.traverse(child, visitor);
    }
  }

  protected extractStringLiteral(node: SyntaxNode): string | null {
    if (node.type === 'string' || node.type === 'template_string') {
      const text = node.text;
      if (text.startsWith("'") || text.startsWith('"') || text.startsWith('`')) {
        return text.slice(1, -1);
      }
      return text;
    }
    return null;
  }
}

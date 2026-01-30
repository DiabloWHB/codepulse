import { SyntaxNode } from './Parser';
import {
  FunctionInfo,
  CodeElementType,
  HealthStatus,
  SourceLocation,
  FunctionReference,
  createFunctionId
} from '../types';
import { Logger } from '../utils/logger';

/**
 * Extracts function information from AST.
 */
export class FunctionExtractor {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('FunctionExtractor');
  }

  /**
   * Extract all functions from AST root node.
   */
  public extract(rootNode: SyntaxNode, filePath: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    this.traverse(rootNode, (node) => {
      const fnInfo = this.extractFunction(node, filePath);
      if (fnInfo) functions.push(fnInfo);
    });

    this.logger.debug(`Extracted ${functions.length} functions from ${filePath}`);
    return functions;
  }

  private traverse(node: SyntaxNode, visitor: (node: SyntaxNode) => void): void {
    visitor(node);
    for (const child of node.children) {
      this.traverse(child, visitor);
    }
  }

  private extractFunction(node: SyntaxNode, filePath: string): FunctionInfo | null {
    const type = this.getCodeElementType(node);
    if (!type) return null;

    const name = this.extractName(node);
    if (!name) return null;

    const location = this.getLocation(node, filePath);
    const id = createFunctionId(filePath, name, location.startLine);

    // Extract function calls - important for dependency tracking!
    const calls = this.extractCalls(node, filePath);

    return {
      id,
      name,
      type,
      file: filePath,
      location,
      health: HealthStatus.UNKNOWN,
      issues: [],
      calls,
      calledBy: [], // Populated by DependencyGraphBuilder
      imports: [],
      databaseTables: this.extractDatabaseTables(node),
      apiEndpoints: this.extractApiEndpoints(node),
      envVariables: this.extractEnvVariables(node),
      isAsync: this.isAsync(node),
      isExported: this.isExported(node),
      documentation: this.extractDocumentation(node),
      lastAnalyzedAt: Date.now()
    };
  }

  private getCodeElementType(node: SyntaxNode): CodeElementType | null {
    switch (node.type) {
      case 'function_declaration':
        return this.isReactComponent(node)
          ? CodeElementType.REACT_COMPONENT
          : CodeElementType.FUNCTION;
      case 'arrow_function': {
        const parent = node.parent;
        if (parent?.type === 'variable_declarator') {
          const name = parent.childForFieldName('name')?.text ?? '';
          if (this.isHookName(name)) return CodeElementType.HOOK;
          if (this.startsWithUpperCase(name)) return CodeElementType.REACT_COMPONENT;
        }
        return CodeElementType.ARROW_FUNCTION;
      }
      case 'method_definition':
        return CodeElementType.METHOD;
      case 'class_declaration':
        return CodeElementType.CLASS;
      default:
        return null;
    }
  }

  private extractName(node: SyntaxNode): string | null {
    switch (node.type) {
      case 'function_declaration':
      case 'class_declaration':
        return node.childForFieldName('name')?.text ?? null;
      case 'arrow_function': {
        const parent = node.parent;
        if (parent?.type === 'variable_declarator') {
          return parent.childForFieldName('name')?.text ?? null;
        }
        return null;
      }
      case 'method_definition':
        return node.childForFieldName('name')?.text ?? null;
      default:
        return null;
    }
  }

  private getLocation(node: SyntaxNode, filePath: string): SourceLocation {
    return {
      file: filePath,
      startLine: node.startPosition.row,
      startColumn: node.startPosition.column,
      endLine: node.endPosition.row,
      endColumn: node.endPosition.column
    };
  }

  private isReactComponent(node: SyntaxNode): boolean {
    const name = node.childForFieldName('name')?.text;
    if (!name || !this.startsWithUpperCase(name)) return false;
    const body = node.childForFieldName('body');
    return body ? this.containsJSX(body) : false;
  }

  private containsJSX(node: SyntaxNode): boolean {
    if (node.type === 'jsx_element' || node.type === 'jsx_self_closing_element') return true;
    for (const child of node.children) {
      if (this.containsJSX(child)) return true;
    }
    return false;
  }

  private isHookName(name: string): boolean {
    return /^use[A-Z]/.test(name);
  }

  private startsWithUpperCase(str: string): boolean {
    return /^[A-Z]/.test(str);
  }

  private isAsync(node: SyntaxNode): boolean {
    for (const child of node.children) {
      if (child.type === 'async') return true;
    }
    return false;
  }

  private isExported(node: SyntaxNode): boolean {
    const parent = node.parent;
    if (!parent) return false;
    if (parent.type === 'export_statement') return true;
    if (node.type === 'arrow_function') {
      const varDecl = parent.parent;
      const lexDecl = varDecl?.parent;
      const exportStmt = lexDecl?.parent;
      return exportStmt?.type === 'export_statement';
    }
    return false;
  }

  /**
   * Extract function calls - critical for dependency tracking!
   */
  private extractCalls(node: SyntaxNode, filePath: string): FunctionReference[] {
    const calls: FunctionReference[] = [];
    const seenNames = new Set<string>();
    const nodeTypes = new Set<string>();
    let totalNodes = 0;
    let callExpressionCount = 0;
    let fnNodeNullCount = 0;
    let nameNullCount = 0;

    this.traverse(node, (child) => {
      totalNodes++;
      nodeTypes.add(child.type);

      if (child.type === 'call_expression') {
        callExpressionCount++;
        const fnNode = child.childForFieldName('function');
        if (!fnNode) {
          fnNodeNullCount++;
          this.logger.debug(`call_expression at line ${child.startPosition.row} has no 'function' field. Children: ${child.children.length}`);
        } else {
          const name = this.extractCallName(fnNode);
          if (!name) {
            nameNullCount++;
            this.logger.debug(`fnNode type '${fnNode.type}' at line ${child.startPosition.row} returned null name. Text: '${fnNode.text.substring(0, 50)}'`);
          } else if (!seenNames.has(name)) {
            seenNames.add(name);
            calls.push({
              functionId: '', // Will be resolved by DependencyGraphBuilder
              file: filePath,
              name,
              line: child.startPosition.row,
              column: child.startPosition.column
            });
          }
        }
      }
    });

    this.logger.debug(`Traversed ${totalNodes} nodes, found ${nodeTypes.size} unique types, ${callExpressionCount} call_expression nodes`);

    if (callExpressionCount > 0) {
      this.logger.info(`Found ${callExpressionCount} call_expression nodes: ${fnNodeNullCount} had null fnNode, ${nameNullCount} had null name, ${calls.length} extracted successfully`);
    }

    if (nodeTypes.size < 20) {
      this.logger.debug(`Node types found: ${Array.from(nodeTypes).join(', ')}`);
    }

    if (calls.length > 0) {
      this.logger.debug(`Found ${calls.length} calls: ${calls.slice(0, 5).map(c => c.name).join(', ')}`);
    } else if (callExpressionCount > 0) {
      this.logger.warn(`Found ${callExpressionCount} call_expression nodes but extracted 0 calls! fnNodeNull: ${fnNodeNullCount}, nameNull: ${nameNullCount}`);
    } else {
      this.logger.warn(`No call_expression nodes found! Node types: ${Array.from(nodeTypes).slice(0, 10).join(', ')}`);
    }

    return calls;
  }

  private extractCallName(node: SyntaxNode): string | null {
    switch (node.type) {
      case 'identifier':
        return node.text;
      case 'member_expression': {
        const obj = node.childForFieldName('object');
        const prop = node.childForFieldName('property');
        if (obj && prop) return `${obj.text}.${prop.text}`;
        return null;
      }
      default:
        return null;
    }
  }

  private extractDatabaseTables(node: SyntaxNode): string[] {
    const tables: Set<string> = new Set();
    this.traverse(node, (child) => {
      if (child.type === 'call_expression') {
        const text = child.text;
        const match = text.match(/\.from\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (match) tables.add(match[1]);
      }
    });
    return Array.from(tables);
  }

  private extractApiEndpoints(node: SyntaxNode): string[] {
    const endpoints: Set<string> = new Set();
    this.traverse(node, (child) => {
      if (child.type === 'call_expression') {
        const fnNode = child.childForFieldName('function');
        if (fnNode?.text === 'fetch') {
          const args = child.childForFieldName('arguments');
          const firstArg = args?.children[1];
          if (firstArg?.type === 'string') {
            endpoints.add(firstArg.text.slice(1, -1));
          }
        }
      }
    });
    return Array.from(endpoints);
  }

  private extractEnvVariables(node: SyntaxNode): string[] {
    const envVars: Set<string> = new Set();
    this.traverse(node, (child) => {
      if (child.type === 'member_expression') {
        const text = child.text;
        const match = text.match(/(?:process\.env|import\.meta\.env)\.([A-Z_][A-Z0-9_]*)/);
        if (match) envVars.add(match[1]);
      }
    });
    return Array.from(envVars);
  }

  private extractDocumentation(node: SyntaxNode): string | undefined {
    let current = node.previousSibling;
    while (current) {
      if (current.type === 'comment') {
        const text = current.text;
        if (text.startsWith('/**') || text.startsWith('///')) return text;
      } else if (current.type !== 'comment') {
        break;
      }
      current = current.previousSibling;
    }
    return undefined;
  }
}

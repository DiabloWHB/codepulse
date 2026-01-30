import * as ts from 'typescript';
import { ParseError } from '../types';
import { Logger } from '../utils/logger';
import { isTypeScript, isJavaScript } from '../utils/paths';

export type SupportedLanguage = 'typescript' | 'tsx' | 'javascript' | 'jsx';

// Type definitions compatible with both tree-sitter and TypeScript compiler
export interface SyntaxNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  parent: SyntaxNode | null;
  children: SyntaxNode[];
  previousSibling: SyntaxNode | null;
  childForFieldName(name: string): SyntaxNode | null;
  hasError?(): boolean;
  isMissing?(): boolean;
}

export interface Tree {
  rootNode: SyntaxNode;
}

/**
 * Adapter to convert TypeScript AST Node to our SyntaxNode interface.
 */
class TypeScriptNodeAdapter implements SyntaxNode {
  private node: ts.Node;
  private sourceFile: ts.SourceFile;
  private parentAdapter: TypeScriptNodeAdapter | null;

  constructor(node: ts.Node, sourceFile: ts.SourceFile, parentAdapter: TypeScriptNodeAdapter | null = null) {
    this.node = node;
    this.sourceFile = sourceFile;
    this.parentAdapter = parentAdapter;
  }

  get type(): string {
    // Convert TypeScript SyntaxKind to tree-sitter style names
    // This maintains compatibility with existing analyzers
    const tsType = ts.SyntaxKind[this.node.kind];
    return this.convertToTreeSitterStyle(tsType);
  }

  /**
   * Convert TypeScript SyntaxKind names to tree-sitter snake_case style.
   */
  private convertToTreeSitterStyle(tsType: string): string {
    // Map common TypeScript syntax kinds to tree-sitter equivalents
    const typeMap: Record<string, string> = {
      'FunctionDeclaration': 'function_declaration',
      'FunctionExpression': 'function_expression',
      'ArrowFunction': 'arrow_function',
      'MethodDeclaration': 'method_definition',
      'ClassDeclaration': 'class_declaration',
      'VariableDeclaration': 'variable_declarator', // TypeScript uses VariableDeclaration for what tree-sitter calls variable_declarator
      'VariableDeclarationList': 'variable_declaration',
      'VariableStatement': 'variable_statement',
      'Identifier': 'identifier',
      'CallExpression': 'call_expression',
      'PropertyAccessExpression': 'member_expression',
      'ImportDeclaration': 'import_declaration',
      'ExportDeclaration': 'export_declaration',
      'NamedExports': 'export_clause',
      'StringLiteral': 'string',
      'NumericLiteral': 'number',
      'ObjectLiteralExpression': 'object',
      'ArrayLiteralExpression': 'array',
      'Block': 'statement_block',
      'IfStatement': 'if_statement',
      'ForStatement': 'for_statement',
      'WhileStatement': 'while_statement',
      'ReturnStatement': 'return_statement',
      'ThrowStatement': 'throw_statement',
      'TryStatement': 'try_statement',
      'CatchClause': 'catch_clause',
      'Parameter': 'formal_parameter',
      'TypeReference': 'type_identifier',
      'PropertyDeclaration': 'property_declaration',
      'PropertySignature': 'property_signature',
      'InterfaceDeclaration': 'interface_declaration',
      'TypeAliasDeclaration': 'type_alias_declaration',
      'EnumDeclaration': 'enum_declaration',
      'SourceFile': 'program'
    };

    return typeMap[tsType] || tsType.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  get text(): string {
    return this.node.getText(this.sourceFile);
  }

  get startPosition(): { row: number; column: number } {
    const pos = this.sourceFile.getLineAndCharacterOfPosition(this.node.getStart(this.sourceFile));
    return { row: pos.line, column: pos.character };
  }

  get endPosition(): { row: number; column: number } {
    const pos = this.sourceFile.getLineAndCharacterOfPosition(this.node.getEnd());
    return { row: pos.line, column: pos.character };
  }

  get parent(): SyntaxNode | null {
    return this.parentAdapter;
  }

  get children(): SyntaxNode[] {
    const children: SyntaxNode[] = [];
    ts.forEachChild(this.node, (child) => {
      children.push(new TypeScriptNodeAdapter(child, this.sourceFile, this));
    });
    return children;
  }

  get previousSibling(): SyntaxNode | null {
    if (!this.node.parent) return null;

    const siblings: ts.Node[] = [];
    ts.forEachChild(this.node.parent, (child) => {
      siblings.push(child);
    });

    const index = siblings.indexOf(this.node);
    if (index <= 0) return null;

    return new TypeScriptNodeAdapter(siblings[index - 1], this.sourceFile, this.parentAdapter);
  }

  childForFieldName(name: string): SyntaxNode | null {
    // TypeScript doesn't use field names like tree-sitter
    // We'll try to match tree-sitter field names to TypeScript AST properties
    const node = this.node as any;

    // Common field mappings
    switch (name) {
      case 'name':
        if (node.name) return new TypeScriptNodeAdapter(node.name, this.sourceFile, this);
        break;

      case 'type':
        if (node.type) return new TypeScriptNodeAdapter(node.type, this.sourceFile, this);
        break;

      case 'body':
        if (node.body) return new TypeScriptNodeAdapter(node.body, this.sourceFile, this);
        break;

      case 'function':
        // For call expressions: the function being called is in 'expression' property
        if (node.expression) return new TypeScriptNodeAdapter(node.expression, this.sourceFile, this);
        break;

      case 'object':
        // For member expressions: foo.bar -> 'foo' is the object
        if (node.expression) return new TypeScriptNodeAdapter(node.expression, this.sourceFile, this);
        break;

      case 'property':
        // For member expressions: foo.bar -> 'bar' is the property
        if (node.name) return new TypeScriptNodeAdapter(node.name, this.sourceFile, this);
        break;

      case 'value':
        // For various nodes that have a value
        if (node.initializer) return new TypeScriptNodeAdapter(node.initializer, this.sourceFile, this);
        break;
    }

    return null;
  }

  hasError(): boolean {
    // Check if this node or any child has syntax errors
    let hasError = false;

    const visit = (node: ts.Node): void => {
      if (node.kind === ts.SyntaxKind.Unknown) {
        hasError = true;
        return;
      }
      ts.forEachChild(node, visit);
    };

    visit(this.node);
    return hasError;
  }

  isMissing(): boolean {
    // TypeScript marks missing nodes differently
    return (this.node as any).isMissing === true;
  }
}

/**
 * Parser wrapper using TypeScript Compiler API.
 * Supports files of any size without the 32KB limitation of tree-sitter.
 */
export class CodeParser {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('Parser');
  }

  /**
   * Parse source code and return AST.
   */
  public parse(code: string, filePath: string): Tree {
    // Validate input
    if (typeof code !== 'string') {
      throw new ParseError(`Invalid code input: expected string, got ${typeof code}`, filePath);
    }

    // Handle empty files gracefully - TypeScript compiler can parse empty files
    // We'll return a valid but empty AST
    const language = this.detectLanguage(filePath);
    this.logger.debug(`Parsing ${filePath} as ${language}, code length: ${code.length}`);

    try {
      // Determine script kind based on file extension
      const scriptKind = this.getScriptKind(language);

      // Parse using TypeScript compiler
      const sourceFile = ts.createSourceFile(
        filePath,
        code,
        ts.ScriptTarget.Latest,
        true, // setParentNodes
        scriptKind
      );

      // TypeScript parser is very permissive and creates AST even with errors
      // Errors are represented as nodes with specific kinds (e.g., Unknown)
      // We'll let hasError() check for those when needed

      // Create root node adapter
      const rootNode = new TypeScriptNodeAdapter(sourceFile, sourceFile);

      return { rootNode };
    } catch (error) {
      if (error instanceof ParseError) throw error;
      throw new ParseError(
        `Parse error: ${error instanceof Error ? error.message : String(error)}`,
        filePath
      );
    }
  }

  /**
   * Parse and return root node directly.
   */
  public parseToNode(code: string, filePath: string): SyntaxNode {
    return this.parse(code, filePath).rootNode;
  }

  /**
   * Detect language from file path.
   */
  public detectLanguage(filePath: string): SupportedLanguage {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'tsx';
      case 'js':
        return 'javascript';
      case 'jsx':
        return 'jsx';
      default:
        return 'typescript';
    }
  }

  /**
   * Check if file is supported.
   */
  public isSupported(filePath: string): boolean {
    return isTypeScript(filePath) || isJavaScript(filePath);
  }

  /**
   * Get TypeScript ScriptKind from our language type.
   */
  private getScriptKind(language: SupportedLanguage): ts.ScriptKind {
    switch (language) {
      case 'typescript':
        return ts.ScriptKind.TS;
      case 'tsx':
        return ts.ScriptKind.TSX;
      case 'javascript':
        return ts.ScriptKind.JS;
      case 'jsx':
        return ts.ScriptKind.JSX;
      default:
        return ts.ScriptKind.TS;
    }
  }

}

export const sharedParser = new CodeParser();

import * as fs from 'fs';
import * as path from 'path';
import { BaseAnalyzer, AnalysisContext, AnalyzerResult } from './BaseAnalyzer';
import { IssueSeverity, IssueCategory, Issue, ImportInfo, ImportSpecifier } from '../../types';
import { SyntaxNode } from '../Parser';

export class ImportAnalyzer extends BaseAnalyzer {
  public readonly name = 'import';
  public readonly category = IssueCategory.IMPORT;

  public async analyze(context: AnalysisContext): Promise<AnalyzerResult> {
    const issues: Issue[] = [];
    const imports = this.extractImports(context);

    issues.push(...this.checkMissingLocalImports(context, imports));
    issues.push(...this.checkDuplicateImports(context, imports));

    return { issues };
  }

  private extractImports(context: AnalysisContext): Array<ImportInfo & { node: SyntaxNode }> {
    const imports: Array<ImportInfo & { node: SyntaxNode }> = [];
    const importNodes = this.findNodes(context.rootNode, 'import_statement');

    for (const node of importNodes) {
      const sourceNode = node.childForFieldName('source');
      if (!sourceNode) continue;

      const source = this.extractStringLiteral(sourceNode);
      if (!source) continue;

      const specifiers: ImportSpecifier[] = [];

      // Check for default import: import foo from './bar'
      const defaultImport = node.children.find(child =>
        child.type === 'identifier' && child.parent?.type === 'import_statement'
      );
      if (defaultImport) {
        specifiers.push({
          imported: 'default',
          local: defaultImport.text,
          type: 'default'
        });
      }

      // Check for namespace import: import * as foo from './bar'
      const namespaceImport = node.children.find(child => child.type === 'namespace_import');
      if (namespaceImport) {
        const nameNode = namespaceImport.childForFieldName('name');
        if (nameNode) {
          specifiers.push({
            imported: '*',
            local: nameNode.text,
            type: 'namespace'
          });
        }
      }

      // Check for named imports: import { foo, bar as baz } from './qux'
      this.traverse(node, (child) => {
        if (child.type === 'import_specifier') {
          const nameNode = child.childForFieldName('name');
          const aliasNode = child.childForFieldName('alias');

          if (nameNode) {
            specifiers.push({
              imported: nameNode.text,
              local: aliasNode?.text || nameNode.text,
              type: 'named'
            });
          }
        }
      });

      const resolvedPath = this.resolveImportPath(context.filePath, source);

      imports.push({
        source,
        specifiers,
        resolvedPath: resolvedPath || undefined,
        location: this.nodeToLocation(node, context.filePath),
        style: 'esm',
        node
      });
    }

    return imports;
  }

  private checkMissingLocalImports(
    context: AnalysisContext,
    imports: Array<ImportInfo & { node: SyntaxNode }>
  ): Issue[] {
    const issues: Issue[] = [];

    for (const imp of imports) {
      if (!imp.source.startsWith('.')) continue;

      if (!imp.resolvedPath) {
        issues.push(
          this.createIssue(
            IssueSeverity.ERROR,
            `Module not found: "${imp.source}"`,
            `The imported module "${imp.source}" could not be found.`,
            imp.location
          )
        );
      }
    }

    return issues;
  }

  private resolveImportPath(fromFile: string, importPath: string): string | null {
    const dir = path.dirname(fromFile);
    const basePath = path.resolve(dir, importPath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', ''];

    for (const ext of extensions) {
      const fullPath = basePath + ext;
      try {
        if (fs.existsSync(fullPath)) return fullPath;
      } catch {
        /* ignore */
      }
    }

    return null;
  }

  private checkDuplicateImports(
    context: AnalysisContext,
    imports: Array<ImportInfo & { node: SyntaxNode }>
  ): Issue[] {
    const issues: Issue[] = [];
    const seenSources = new Map<string, ImportInfo & { node: SyntaxNode }>();

    for (const imp of imports) {
      if (seenSources.has(imp.source)) {
        issues.push(
          this.createIssue(
            IssueSeverity.WARNING,
            `Duplicate import from "${imp.source}"`,
            'This module is imported multiple times. Consider combining imports.',
            imp.location
          )
        );
      } else {
        seenSources.set(imp.source, imp);
      }
    }

    return issues;
  }

  /**
   * Public method to get imports for use by other components
   */
  public getImports(context: AnalysisContext): ImportInfo[] {
    return this.extractImports(context).map(({ node, ...importInfo }) => importInfo);
  }
}

import { BaseAnalyzer, AnalysisContext, AnalyzerResult } from './BaseAnalyzer';
import { IssueSeverity, IssueCategory, Issue } from '../../types';
import { SchemaFetcher } from '../../integrations/supabase/SchemaFetcher';
import { QueryInfo, QueryOperation } from '../../integrations/supabase/types';
import { SyntaxNode } from '../Parser';

export class SupabaseAnalyzer extends BaseAnalyzer {
  public readonly name = 'supabase';
  public readonly category = IssueCategory.DATABASE;
  private schemaFetcher: SchemaFetcher | null = null;
  private initialized = false;

  public async initialize(workspaceRoot: string): Promise<void> {
    this.schemaFetcher = new SchemaFetcher();
    await this.schemaFetcher.fetchSchema(workspaceRoot);
    this.initialized = true;
  }

  public shouldAnalyze(context: AnalysisContext): boolean {
    if (!this.initialized) return false;
    return context.content.includes('supabase') || context.content.includes('.from(');
  }

  public async analyze(context: AnalysisContext): Promise<AnalyzerResult> {
    const issues: Issue[] = [];
    if (!this.schemaFetcher) return { issues };

    const queries = this.extractQueries(context);
    for (const query of queries) {
      issues.push(...this.validateQuery(context, query));
    }

    return { issues };
  }

  private extractQueries(context: AnalysisContext): QueryInfo[] {
    const queries: QueryInfo[] = [];
    const callNodes = this.findNodes(context.rootNode, 'call_expression');

    for (const node of callNodes) {
      const fnNode = node.childForFieldName('function');
      if (fnNode?.type === 'member_expression') {
        const property = fnNode.childForFieldName('property');
        if (property?.text === 'from') {
          const query = this.parseFromCall(node, context);
          if (query) queries.push(query);
        }
      }
    }

    return queries;
  }

  private parseFromCall(node: SyntaxNode, _context: AnalysisContext): QueryInfo | null {
    const args = node.childForFieldName('arguments');
    if (!args) return null;

    const firstArg = args.children.find((c) => c.type === 'string');
    if (!firstArg) return null;

    const tableName = this.extractStringLiteral(firstArg);
    if (!tableName) return null;

    const { operation, columns, filters } = this.parseQueryChain(node);

    return {
      table: tableName,
      operation,
      columns,
      filters,
      location: { line: node.startPosition.row, column: node.startPosition.column }
    };
  }

  private parseQueryChain(fromNode: SyntaxNode): {
    operation: QueryOperation;
    columns: string[];
    filters: string[];
  } {
    let operation: QueryOperation = 'select';
    const columns: string[] = [];
    const filters: string[] = [];
    let current = fromNode.parent;

    while (current) {
      if (current.type === 'call_expression') {
        const fn = current.childForFieldName('function');
        if (fn?.type === 'member_expression') {
          const method = fn.childForFieldName('property')?.text;
          const args = current.childForFieldName('arguments');

          if (method === 'select' && args) {
            operation = 'select';
            const selectArg = args.children.find((c) => c.type === 'string');
            if (selectArg) {
              const cols = this.extractStringLiteral(selectArg);
              if (cols) columns.push(...cols.split(',').map((c) => c.trim()));
            }
          } else if (method === 'insert') operation = 'insert';
          else if (method === 'update') operation = 'update';
          else if (method === 'delete') operation = 'delete';
          else if (['eq', 'neq', 'gt', 'lt', 'like'].includes(method || '') && args) {
            const filterCol = args.children.find((c) => c.type === 'string');
            if (filterCol) {
              const col = this.extractStringLiteral(filterCol);
              if (col) filters.push(col);
            }
          }
        }
      }
      current = current.parent;
    }

    return { operation, columns, filters };
  }

  private validateQuery(context: AnalysisContext, query: QueryInfo): Issue[] {
    const issues: Issue[] = [];
    if (!this.schemaFetcher) return issues;

    const tableInfo = this.schemaFetcher.getTable(query.table);
    if (!tableInfo) {
      issues.push(
        this.createIssue(
          IssueSeverity.ERROR,
          `Table "${query.table}" not found`,
          `The table "${query.table}" does not exist in the database schema.`,
          {
            file: context.filePath,
            startLine: query.location.line,
            startColumn: query.location.column,
            endLine: query.location.line,
            endColumn: query.location.column + query.table.length
          }
        )
      );
      return issues;
    }

    const tableColumns = new Set(tableInfo.columns.map((c) => c.name));

    for (const col of query.columns) {
      if (col === '*' || col.includes('(')) continue;
      const baseName = col.split('(')[0].trim();
      if (!tableColumns.has(baseName) && baseName !== '*') {
        issues.push(
          this.createIssue(
            IssueSeverity.ERROR,
            `Column "${baseName}" not found in "${query.table}"`,
            `Available columns: ${Array.from(tableColumns).join(', ')}`,
            {
              file: context.filePath,
              startLine: query.location.line,
              startColumn: query.location.column,
              endLine: query.location.line,
              endColumn: query.location.column + 50
            }
          )
        );
      }
    }

    for (const filterCol of query.filters) {
      if (!tableColumns.has(filterCol)) {
        issues.push(
          this.createIssue(
            IssueSeverity.ERROR,
            `Filter column "${filterCol}" not found in "${query.table}"`,
            `Column "${filterCol}" used in filter does not exist.`,
            {
              file: context.filePath,
              startLine: query.location.line,
              startColumn: query.location.column,
              endLine: query.location.line,
              endColumn: query.location.column + 50
            }
          )
        );
      }
    }

    return issues;
  }

  public setSchemaFetcher(fetcher: SchemaFetcher): void {
    this.schemaFetcher = fetcher;
    this.initialized = true;
  }
}

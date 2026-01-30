import * as fs from 'fs';
import * as path from 'path';
import { DatabaseSchema, TableInfo, ColumnInfo } from './types';
import { Logger } from '../../utils/logger';

export class SchemaFetcher {
  private readonly logger: Logger;
  private cachedSchema: DatabaseSchema | null = null;

  constructor() {
    this.logger = new Logger('SchemaFetcher');
  }

  public async fetchSchema(workspaceRoot: string): Promise<DatabaseSchema | null> {
    if (this.cachedSchema && Date.now() - this.cachedSchema.fetchedAt < 5 * 60 * 1000) {
      return this.cachedSchema;
    }

    const localSchema = await this.getSchemaFromLocalTypes(workspaceRoot);
    if (localSchema) {
      this.cachedSchema = localSchema;
      return localSchema;
    }

    const migrationSchema = await this.getSchemaFromMigrations(workspaceRoot);
    if (migrationSchema) {
      this.cachedSchema = migrationSchema;
      return migrationSchema;
    }

    return null;
  }

  private async getSchemaFromLocalTypes(workspaceRoot: string): Promise<DatabaseSchema | null> {
    const paths = [
      path.join(workspaceRoot, 'supabase', 'types.ts'),
      path.join(workspaceRoot, 'src', 'types', 'database.types.ts')
    ];

    for (const typesPath of paths) {
      if (fs.existsSync(typesPath)) {
        try {
          const content = fs.readFileSync(typesPath, 'utf-8');
          return this.parseSupabaseTypes(content);
        } catch (error) {
          this.logger.error('Failed to parse types file', error);
        }
      }
    }

    return null;
  }

  private parseSupabaseTypes(content: string): DatabaseSchema {
    const tables = new Map<string, TableInfo>();
    const tableRegex = /(\w+):\s*\{\s*Row:\s*\{([^}]+)\}/g;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const columnsStr = match[2];
      const columns = this.parseColumns(columnsStr);

      tables.set(tableName, { name: tableName, schema: 'public', columns });
    }

    return { tables, fetchedAt: Date.now() };
  }

  private parseColumns(columnsStr: string): ColumnInfo[] {
    const columns: ColumnInfo[] = [];
    const columnRegex = /(\w+)\s*[?]?\s*:\s*([^;\n]+)/g;
    let match;

    while ((match = columnRegex.exec(columnsStr)) !== null) {
      const name = match[1];
      const typeStr = match[2].trim();
      const nullable = typeStr.includes('| null');
      const type = this.parseColumnType(typeStr);
      columns.push({ name, type, nullable });
    }

    return columns;
  }

  private parseColumnType(tsType: string): string {
    const cleanType = tsType.replace(/\|\s*null/g, '').trim();
    const typeMap: Record<string, string> = {
      string: 'text',
      number: 'numeric',
      boolean: 'boolean',
      Date: 'timestamp'
    };
    return typeMap[cleanType] || cleanType.toLowerCase();
  }

  private async getSchemaFromMigrations(workspaceRoot: string): Promise<DatabaseSchema | null> {
    const migrationsDir = path.join(workspaceRoot, 'supabase', 'migrations');
    if (!fs.existsSync(migrationsDir)) return null;

    const tables = new Map<string, TableInfo>();
    try {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const file of files) {
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        this.parseCreateTableStatements(content, tables);
      }
      if (tables.size === 0) return null;
      return { tables, fetchedAt: Date.now() };
    } catch (error) {
      this.logger.error('Failed to parse migrations', error);
      return null;
    }
  }

  private parseCreateTableStatements(sql: string, tables: Map<string, TableInfo>): void {
    const createTableRegex =
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(([^;]+)\)/gi;
    let match;

    while ((match = createTableRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const columnsStr = match[2];
      const columns = this.parseCreateTableColumns(columnsStr);
      tables.set(tableName, { name: tableName, schema: 'public', columns });
    }
  }

  private parseCreateTableColumns(columnsStr: string): ColumnInfo[] {
    const columns: ColumnInfo[] = [];
    const lines = columnsStr.split(',');

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(?:PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)/i.test(trimmed)) continue;

      const columnMatch = trimmed.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)\s*(.*)/i);
      if (columnMatch) {
        columns.push({
          name: columnMatch[1],
          type: columnMatch[2].toLowerCase(),
          nullable: !columnMatch[3].toUpperCase().includes('NOT NULL'),
          isPrimaryKey: columnMatch[3].toUpperCase().includes('PRIMARY KEY')
        });
      }
    }

    return columns;
  }

  public getTable(tableName: string): TableInfo | undefined {
    return this.cachedSchema?.tables.get(tableName);
  }

  public hasTable(tableName: string): boolean {
    return this.cachedSchema?.tables.has(tableName) ?? false;
  }

  public getTableNames(): string[] {
    return this.cachedSchema ? Array.from(this.cachedSchema.tables.keys()) : [];
  }

  public clearCache(): void {
    this.cachedSchema = null;
  }
}

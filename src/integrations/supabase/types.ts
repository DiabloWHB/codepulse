export type ColumnType =
  | 'uuid'
  | 'text'
  | 'varchar'
  | 'integer'
  | 'bigint'
  | 'boolean'
  | 'timestamp'
  | 'timestamptz'
  | 'json'
  | 'jsonb'
  | string;

export interface ColumnInfo {
  name: string;
  type: ColumnType;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
  foreignKey?: string;
}

export interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  primaryKey?: string[];
}

export interface DatabaseSchema {
  tables: Map<string, TableInfo>;
  views?: Map<string, TableInfo>;
  fetchedAt: number;
  projectUrl?: string;
}

export type QueryOperation = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

export interface QueryInfo {
  table: string;
  operation: QueryOperation;
  columns: string[];
  filters: string[];
  location: { line: number; column: number };
}

import { SourceLocation } from '../types';

/**
 * Type of code symbol.
 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'variable'
  | 'constant'
  | 'component'
  | 'hook'
  | 'method'
  | 'property';

/**
 * A symbol in the codebase (function, class, variable, etc.).
 */
export interface SymbolInfo {
  /** Unique ID: file:line:name */
  id: string;

  /** Symbol name */
  name: string;

  /** Kind of symbol */
  kind: SymbolKind;

  /** File path */
  file: string;

  /** Location in file */
  location: SourceLocation;

  /** Function signature or type definition */
  signature?: string;

  /** JSDoc documentation */
  documentation?: string;

  /** Scope: exported or local */
  scope: 'export' | 'local';

  /** Container name (class/namespace it belongs to) */
  containerName?: string;

  /** Container kind */
  containerKind?: SymbolKind;

  /** Modifiers (async, static, readonly, etc.) */
  modifiers?: string[];

  /** Dependencies (what this symbol imports/uses) */
  dependencies?: SymbolDependency[];

  /** Usages (where this symbol is used) */
  usages?: SymbolUsage[];

  /** Last modified timestamp */
  lastModified: number;
}

/**
 * A dependency of a symbol.
 */
export interface SymbolDependency {
  /** Type of dependency */
  type: 'import' | 'call' | 'type-reference' | 'extends' | 'implements';

  /** Name of the dependency */
  name: string;

  /** Source module/file */
  source?: string;

  /** Location where dependency is used */
  location: SourceLocation;

  /** Is external (npm package) */
  isExternal: boolean;
}

/**
 * A usage of a symbol.
 */
export interface SymbolUsage {
  /** Type of usage */
  type: 'call' | 'reference' | 'type-usage';

  /** File where symbol is used */
  file: string;

  /** Location of usage */
  location: SourceLocation;

  /** Context (surrounding code) */
  context?: string;
}

/**
 * File metadata in the index.
 */
export interface FileMetadata {
  /** File path */
  path: string;

  /** Symbols in this file */
  symbols: string[]; // Symbol IDs

  /** Imports in this file */
  imports: ImportInfo[];

  /** Exports from this file */
  exports: ExportInfo[];

  /** Last analyzed timestamp */
  lastAnalyzed: number;

  /** File hash (for change detection) */
  hash: string;

  /** File size */
  size: number;
}

/**
 * Import statement information.
 */
export interface ImportInfo {
  /** Imported names */
  names: string[];

  /** Source module */
  source: string;

  /** Is default import */
  isDefault: boolean;

  /** Is namespace import */
  isNamespace: boolean;

  /** Import type (value, type, both) */
  importType: 'value' | 'type' | 'both';

  /** Location in file */
  location: SourceLocation;
}

/**
 * Export statement information.
 */
export interface ExportInfo {
  /** Exported name */
  name: string;

  /** Symbol ID being exported */
  symbolId?: string;

  /** Is default export */
  isDefault: boolean;

  /** Is re-export from another module */
  isReExport: boolean;

  /** Source module (if re-export) */
  source?: string;

  /** Location in file */
  location: SourceLocation;
}

/**
 * Complete code index for workspace.
 */
export interface CodeIndex {
  /** All symbols indexed by ID */
  symbols: Map<string, SymbolInfo>;

  /** Index: symbol name -> symbol IDs */
  nameIndex: Map<string, string[]>;

  /** Index: file path -> file metadata */
  fileIndex: Map<string, FileMetadata>;

  /** Index: kind -> symbol IDs */
  kindIndex: Map<SymbolKind, string[]>;

  /** Index: container name -> symbol IDs */
  containerIndex: Map<string, string[]>;

  /** When the index was built */
  builtAt: number;

  /** Statistics */
  stats: IndexStats;
}

/**
 * Index statistics.
 */
export interface IndexStats {
  /** Total number of symbols */
  totalSymbols: number;

  /** Total number of files */
  totalFiles: number;

  /** Symbols by kind */
  byKind: Record<SymbolKind, number>;

  /** Exported symbols count */
  exportedCount: number;

  /** Local symbols count */
  localCount: number;

  /** Average symbols per file */
  avgSymbolsPerFile: number;
}

/**
 * Query options for symbol search.
 */
export interface SymbolQuery {
  /** Search terms (symbol name) */
  terms?: string[];

  /** Exact name match */
  exactName?: string;

  /** Kind filter */
  kinds?: SymbolKind[];

  /** File filter (path pattern) */
  file?: string;

  /** Container filter */
  container?: string;

  /** Scope filter */
  scope?: 'export' | 'local';

  /** Include dependencies */
  includeDependencies?: boolean;

  /** Include usages */
  includeUsages?: boolean;

  /** Maximum results */
  limit?: number;

  /** Fuzzy matching threshold (0-1) */
  fuzzyThreshold?: number;
}

/**
 * Search result for a symbol.
 */
export interface SymbolSearchResult {
  /** The symbol */
  symbol: SymbolInfo;

  /** Match score (0-1, higher is better) */
  score: number;

  /** Why this symbol matched */
  matchReason: string[];

  /** Highlighted matches in name */
  highlights?: Array<{ start: number; end: number }>;
}

/**
 * AI context generated from index.
 */
export interface AIContext {
  /** Primary symbol(s) relevant to query */
  primary: SymbolInfo[];

  /** Related symbols (dependencies, usages) */
  related: SymbolInfo[];

  /** Relevant file paths */
  files: string[];

  /** Suggested code to read */
  codeSnippets: CodeSnippet[];

  /** Summary for AI */
  summary: string;

  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Code snippet for AI context.
 */
export interface CodeSnippet {
  /** File path */
  file: string;

  /** Start line */
  startLine: number;

  /** End line */
  endLine: number;

  /** The code */
  code: string;

  /** Why this snippet is relevant */
  relevance: string;

  /** Symbol ID this snippet belongs to */
  symbolId?: string;
}

/**
 * Index update operation.
 */
export interface IndexUpdate {
  /** Type of update */
  type: 'add' | 'update' | 'delete';

  /** File path */
  file: string;

  /** Symbols affected (IDs) */
  symbolIds: string[];

  /** Timestamp */
  timestamp: number;
}

/**
 * Index build progress.
 */
export interface IndexProgress {
  /** Total files to index */
  total: number;

  /** Files indexed so far */
  current: number;

  /** Current file being indexed */
  currentFile?: string;

  /** Percentage complete (0-100) */
  percentage: number;

  /** Estimated time remaining (ms) */
  estimatedTimeRemaining?: number;
}

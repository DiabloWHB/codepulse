import { IssueSeverity, IssueCategory } from './health';

/**
 * Location in source code.
 */
export interface SourceLocation {
  /** Absolute file path */
  file: string;
  /** 0-indexed start line */
  startLine: number;
  /** 0-indexed start column */
  startColumn: number;
  /** 0-indexed end line */
  endLine: number;
  /** 0-indexed end column */
  endColumn: number;
}

/**
 * Suggested fix for an issue.
 */
export interface IssueFix {
  /** Description of the fix */
  description: string;
  /** Automatic fix (if possible) */
  autoFix?: {
    replacement: string;
    range: SourceLocation;
  };
}

/**
 * Represents a single issue found during analysis.
 */
export interface Issue {
  /** Unique identifier: {analyzer}-{category}-{hash} */
  id: string;
  /** Severity of the issue */
  severity: IssueSeverity;
  /** Category for grouping */
  category: IssueCategory;
  /** Short, user-friendly message (max 80 chars) */
  message: string;
  /** Detailed description with context */
  description: string;
  /** Location in source code */
  location: SourceLocation;
  /** Which analyzer found this issue */
  source: string;
  /** Suggested fix (if available) */
  fix?: IssueFix;
  /** Related issues (for cascading problems) */
  relatedIssues?: string[];
  /** Documentation link */
  documentationUrl?: string;
  /** Timestamp when issue was detected */
  detectedAt: number;
}

/**
 * Result of analyzing a single file.
 */
export interface FileAnalysisResult {
  /** Absolute file path */
  file: string;
  /** File content hash (for cache invalidation) */
  contentHash: string;
  /** All functions found in this file */
  functions: import('./function').FunctionInfo[];
  /** File-level issues (not tied to specific function) */
  fileIssues: Issue[];
  /** Imports in this file */
  imports: ImportInfo[];
  /** Exports from this file */
  exports: ExportInfo[];
  /** Analysis duration in milliseconds */
  analysisDurationMs: number;
  /** Analysis timestamp */
  analyzedAt: number;
  /** Analysis errors (if any) */
  errors?: Array<{
    message: string;
    stack?: string;
  }>;
}

/**
 * Import specifier (individual imported item).
 */
export interface ImportSpecifier {
  /** Original name in the source module */
  imported: string;
  /** Local name used in this file (after aliasing) */
  local: string;
  /** Type of import */
  type: 'named' | 'default' | 'namespace';
}

/**
 * Import information for dependency tracking.
 */
export interface ImportInfo {
  /** Import source (module path) */
  source: string;
  /** Imported specifiers with aliasing support */
  specifiers: ImportSpecifier[];
  /** Resolved absolute path (for local imports) */
  resolvedPath?: string;
  /** Location in source */
  location: SourceLocation;
  /** Import style: 'esm' (import) or 'cjs' (require) */
  style: 'esm' | 'cjs';
}

/**
 * Export information for dependency tracking.
 */
export interface ExportInfo {
  /** Exported name */
  name: string;
  /** Is default export */
  isDefault: boolean;
  /** Type of export (function, class, variable, etc.) */
  type: string;
  /** Location in source */
  location: SourceLocation;
}

/**
 * Summary statistics for workspace analysis.
 */
export interface AnalysisSummary {
  totalFiles: number;
  totalFunctions: number;
  healthyCount: number;
  warningCount: number;
  errorCount: number;
  unknownCount: number;
}

/**
 * Result of analyzing entire workspace.
 */
export interface WorkspaceAnalysisResult {
  /** All file results */
  files: Map<string, FileAnalysisResult>;
  /** Summary statistics */
  summary: AnalysisSummary;
  /** Overall health percentage (0-100) */
  healthPercentage: number;
  /** Total analysis duration */
  totalDurationMs: number;
}

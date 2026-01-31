/**
 * Types for MCP server (cached index structure).
 */

import { SymbolKind, IndexStats } from '../index/types';

/**
 * Cached index structure (serialized from CodeIndex).
 */
export interface CachedIndex {
  symbols: Array<[string, CachedSymbol]>;
  nameIndex: Array<[string, string[]]>;
  fileIndex: Array<[string, CachedFileMetadata]>;
  kindIndex: Array<[string, string[]]>;
  containerIndex: Array<[string, string[]]>;
  stats: IndexStats;
  builtAt: number;
  // 🆕 Impact analysis data for each symbol
  impactData?: Record<string, ImpactData>;
}

/**
 * Impact analysis data for a symbol.
 */
export interface ImpactData {
  callers: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  directCallersCount: number;
  indirectCallersCount: number;
  affectedFiles: string[];
  directCallers: Array<{
    name: string;
    file: string;
    line: number;
  }>;
}

/**
 * Cached symbol information.
 */
export interface CachedSymbol {
  id: string;
  name: string;
  kind: SymbolKind;
  file: string;
  location: {
    file: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  signature?: string;
  documentation?: string;
  scope: 'export' | 'local';
  containerName?: string;
  containerKind?: SymbolKind;
  lastModified: number;
}

/**
 * Cached file metadata.
 */
export interface CachedFileMetadata {
  path: string;
  symbols: string[];
  imports: any[];
  exports: any[];
  lastAnalyzed: number;
  hash: string;
  size: number;
}

/**
 * MCP tool response structure.
 */
export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

/**
 * Search result for MCP.
 */
export interface MCPSearchResult {
  symbol: CachedSymbol;
  score: number;
  matchReason: string[];
}

/**
 * AI context for MCP.
 */
export interface MCPAIContext {
  primary: CachedSymbol[];
  related: CachedSymbol[];
  files: string[];
  codeSnippets: Array<{
    file: string;
    startLine: number;
    endLine: number;
    code: string;
    relevance: string;
  }>;
  confidence: number;
}

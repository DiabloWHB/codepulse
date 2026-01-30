import { HealthStatus } from './health';
import { Issue, SourceLocation, ImportInfo } from './analysis';

/**
 * Types of code elements we analyze.
 */
export enum CodeElementType {
  FUNCTION = 'function',
  ARROW_FUNCTION = 'arrow_function',
  METHOD = 'method',
  REACT_COMPONENT = 'react_component',
  HOOK = 'hook',
  CLASS = 'class'
}

/**
 * Reference to another function (for dependency tracking).
 */
export interface FunctionReference {
  /** Function ID being referenced */
  functionId: string;
  /** File containing the function */
  file: string;
  /** Function name */
  name: string;
  /** Line where the call/reference occurs */
  line: number;
  /** Column where the call/reference occurs */
  column: number;
}

/**
 * Information about a function or code element.
 */
export interface FunctionInfo {
  /** Unique identifier: {file}:{name}:{startLine} */
  id: string;
  /** Function name */
  name: string;
  /** Type of code element */
  type: CodeElementType;
  /** File containing this function */
  file: string;
  /** Location in source */
  location: SourceLocation;
  /** Current health status */
  health: HealthStatus;
  /** Issues affecting this function */
  issues: Issue[];

  // ═══════════════════════════════════════════════════════════
  // DEPENDENCY TRACKING - הליבה של CodePulse!
  // ═══════════════════════════════════════════════════════════

  /** Functions this function CALLS (outgoing edges) */
  calls: FunctionReference[];

  /** Functions that CALL this function (incoming edges) */
  calledBy: FunctionReference[];

  /** External modules this function imports/uses */
  imports: ImportInfo[];

  // ═══════════════════════════════════════════════════════════
  // EXTERNAL DEPENDENCIES
  // ═══════════════════════════════════════════════════════════

  /** Database tables accessed */
  databaseTables: string[];
  /** API endpoints called */
  apiEndpoints: string[];
  /** Environment variables used */
  envVariables: string[];

  // ═══════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════

  /** Is this an async function? */
  isAsync: boolean;
  /** Is this exported? */
  isExported: boolean;
  /** JSDoc/TSDoc description */
  documentation?: string;
  /** Function signature for display */
  signature?: string;
  /** Last analysis timestamp */
  lastAnalyzedAt: number;
}

/**
 * Create a function ID from components.
 */
export function createFunctionId(file: string, name: string, line: number): string {
  return `${file}:${name}:${line}`;
}

/**
 * Parse a function ID into components.
 */
export function parseFunctionId(id: string): { file: string; name: string; line: number } | null {
  const parts = id.split(':');
  if (parts.length < 3) return null;

  const line = parseInt(parts[parts.length - 1], 10);
  const name = parts[parts.length - 2];
  const file = parts.slice(0, -2).join(':');

  if (isNaN(line)) return null;

  return { file, name, line };
}

/**
 * Create a function reference.
 */
export function createFunctionReference(
  functionId: string,
  file: string,
  name: string,
  line: number,
  column: number
): FunctionReference {
  return { functionId, file, name, line, column };
}

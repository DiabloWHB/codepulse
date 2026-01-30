import { SourceLocation } from '../../types';

/**
 * Reference to a function call.
 */
export interface FunctionReference {
  /** ID of the referenced function */
  functionId: string;
  /** File containing the reference */
  file: string;
  /** Function name */
  name: string;
  /** Location of the call */
  location: SourceLocation;
}

/**
 * External dependency (not a local function).
 */
export interface ExternalDependency {
  /** Type of dependency */
  type: 'npm' | 'builtin' | 'supabase' | 'api' | 'env';
  /** Name/identifier */
  name: string;
  /** Additional details */
  details?: {
    /** For supabase: table name */
    table?: string;
    /** For supabase: columns accessed */
    columns?: string[];
    /** For API: endpoint URL */
    endpoint?: string;
    /** For env: variable name */
    envVar?: string;
  };
}

/**
 * Node in the dependency graph.
 */
export interface DependencyNode {
  /** Function ID */
  functionId: string;
  /** File path */
  file: string;
  /** Function name */
  name: string;
  /** Line number */
  line: number;

  /** Functions that call this function */
  calledBy: FunctionReference[];

  /** Functions this function calls */
  calls: FunctionReference[];

  /** External dependencies */
  externalDeps: ExternalDependency[];

  /** Depth in dependency tree (for impact calculation) */
  depth?: number;
}

/**
 * Impact analysis result.
 */
export interface ImpactAnalysis {
  /** The function being analyzed */
  source: DependencyNode;

  /** Direct impact - functions that directly call this one */
  directImpact: DependencyNode[];

  /** Indirect impact - functions affected through chain */
  indirectImpact: DependencyNode[];

  /** Total number of affected functions */
  totalAffected: number;

  /** Files that would need review */
  affectedFiles: string[];

  /** Risk level based on impact */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  /** Human-readable summary */
  summary: string;
}

/**
 * Complete dependency graph for workspace.
 */
export interface DependencyGraph {
  /** All nodes indexed by function ID */
  nodes: Map<string, DependencyNode>;

  /** Index: file -> function IDs in that file */
  fileIndex: Map<string, string[]>;

  /** Index: external dep -> function IDs using it */
  externalDepIndex: Map<string, string[]>;

  /** When the graph was built */
  builtAt: number;

  /** Statistics */
  stats: {
    totalFunctions: number;
    totalConnections: number;
    averageConnections: number;
    maxDepth: number;
  };
}

/**
 * Calculate risk level from impact count.
 */
export function calculateRiskLevel(
  directCount: number,
  indirectCount: number
): ImpactAnalysis['riskLevel'] {
  const total = directCount + indirectCount;

  if (total === 0) return 'low';
  if (total <= 3) return 'low';
  if (total <= 10) return 'medium';
  if (total <= 25) return 'high';
  return 'critical';
}

/**
 * Format impact summary for display.
 */
export function formatImpactSummary(impact: ImpactAnalysis): string {
  const { directImpact, indirectImpact, affectedFiles, riskLevel } = impact;

  const riskEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴'
  };

  return `${riskEmoji[riskLevel]} Impact: ${directImpact.length} direct, ${indirectImpact.length} indirect (${affectedFiles.length} files)`;
}

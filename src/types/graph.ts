import { HealthStatus } from './health';

/**
 * Node in the dependency graph representing a function.
 */
export interface GraphNode {
  /** Function ID */
  id: string;
  /** Function name */
  name: string;
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Health status */
  health: HealthStatus;
  /** Number of issues */
  issueCount: number;
  /** Is exported */
  isExported: boolean;
  /** Function type */
  type: string;
}

/**
 * Edge in the dependency graph representing a call relationship.
 */
export interface GraphEdge {
  /** Source function ID (caller) */
  from: string;
  /** Target function ID (callee) */
  to: string;
  /** Line where the call occurs */
  line: number;
  /** Type of relationship */
  type: 'calls' | 'imports' | 'extends' | 'implements';
}

/**
 * Complete dependency graph for the workspace.
 */
export interface DependencyGraph {
  /** All nodes (functions) */
  nodes: Map<string, GraphNode>;
  /** All edges (calls) */
  edges: GraphEdge[];
  /** Adjacency list: function -> functions it calls */
  outgoing: Map<string, Set<string>>;
  /** Reverse adjacency: function -> functions that call it */
  incoming: Map<string, Set<string>>;
  /** Last build timestamp */
  builtAt: number;
}

/**
 * Result of impact analysis.
 */
export interface ImpactAnalysisResult {
  /** The function being analyzed */
  source: GraphNode;
  /** Functions that will be directly affected (depth 1) */
  directImpact: ImpactedFunction[];
  /** Functions that will be indirectly affected (depth 2+) */
  indirectImpact: ImpactedFunction[];
  /** Total number of affected functions */
  totalAffected: number;
  /** Files that contain affected functions */
  affectedFiles: string[];
  /** Summary for AI/display */
  summary: string;
}

/**
 * A function affected by a change.
 */
export interface ImpactedFunction {
  /** Function info */
  node: GraphNode;
  /** How many steps away from the source */
  depth: number;
  /** The path of calls from source to this function */
  path: string[];
  /** Why this function is affected */
  reason: string;
}

/**
 * Result of dependency analysis (what a function depends on).
 */
export interface DependencyAnalysisResult {
  /** The function being analyzed */
  source: GraphNode;
  /** Functions this function directly calls */
  directDependencies: GraphNode[];
  /** Functions this function indirectly depends on */
  indirectDependencies: GraphNode[];
  /** External dependencies */
  external: {
    tables: string[];
    envVars: string[];
    apiEndpoints: string[];
    modules: string[];
  };
  /** Summary for AI/display */
  summary: string;
}

/**
 * Options for impact analysis.
 */
export interface ImpactAnalysisOptions {
  /** Maximum depth to traverse (default: 5) */
  maxDepth?: number;
  /** Include indirect impacts (default: true) */
  includeIndirect?: boolean;
  /** Only include functions with issues */
  onlyWithIssues?: boolean;
}

/**
 * Statistics about the dependency graph.
 */
export interface GraphStats {
  /** Total number of functions */
  totalNodes: number;
  /** Total number of call relationships */
  totalEdges: number;
  /** Functions with most callers (most impactful if changed) */
  mostCalled: Array<{ node: GraphNode; callerCount: number }>;
  /** Functions with most dependencies (most fragile) */
  mostDependencies: Array<{ node: GraphNode; dependencyCount: number }>;
  /** Isolated functions (no callers or callees) */
  isolatedCount: number;
  /** Circular dependencies detected */
  circularDependencies: Array<string[]>;
}

import {
  DependencyGraph,
  DependencyNode,
  FunctionReference,
  ExternalDependency
} from './types';
import { FileAnalysisResult, FunctionInfo } from '../../types';
import { Logger } from '../../utils/logger';

/**
 * Builds a dependency graph from analyzed files.
 * This is the core of CodePulse - understanding how code connects.
 */
export class DependencyGraphBuilder {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('DependencyGraphBuilder');
  }

  /**
   * Build complete dependency graph from all analyzed files.
   */
  public build(files: Map<string, FileAnalysisResult>): DependencyGraph {
    const startTime = Date.now();
    this.logger.info('Building dependency graph...');

    // Step 1: Create nodes for all functions
    const nodes = this.createNodes(files);

    // Step 2: Resolve call references (link callers to callees)
    this.resolveReferences(nodes, files);

    // Step 3: Build indices for fast lookup
    const fileIndex = this.buildFileIndex(nodes);
    const externalDepIndex = this.buildExternalDepIndex(nodes);

    // Step 4: Calculate statistics
    const stats = this.calculateStats(nodes);

    const graph: DependencyGraph = {
      nodes,
      fileIndex,
      externalDepIndex,
      builtAt: Date.now(),
      stats
    };

    this.logger.info(`Dependency graph built in ${Date.now() - startTime}ms`, {
      functions: stats.totalFunctions,
      connections: stats.totalConnections
    });

    return graph;
  }

  /**
   * Create dependency nodes for all functions.
   */
  private createNodes(files: Map<string, FileAnalysisResult>): Map<string, DependencyNode> {
    const nodes = new Map<string, DependencyNode>();

    for (const [filePath, result] of files) {
      for (const fn of result.functions) {
        const node: DependencyNode = {
          functionId: fn.id,
          file: filePath,
          name: fn.name,
          line: fn.location.startLine,
          calledBy: [],
          calls: [],
          externalDeps: this.extractExternalDeps(fn)
        };

        nodes.set(fn.id, node);
      }
    }

    return nodes;
  }

  /**
   * Extract external dependencies from function info.
   */
  private extractExternalDeps(fn: FunctionInfo): ExternalDependency[] {
    const deps: ExternalDependency[] = [];

    // Database tables
    for (const table of fn.databaseTables) {
      deps.push({
        type: 'supabase',
        name: `supabase:${table}`,
        details: { table }
      });
    }

    // Environment variables
    for (const envVar of fn.envVariables) {
      deps.push({
        type: 'env',
        name: `env:${envVar}`,
        details: { envVar }
      });
    }

    // API endpoints
    for (const endpoint of fn.apiEndpoints) {
      deps.push({
        type: 'api',
        name: `api:${endpoint}`,
        details: { endpoint }
      });
    }

    return deps;
  }

  /**
   * Resolve function call references to actual function IDs.
   * This links "calls" to "calledBy".
   */
  private resolveReferences(
    nodes: Map<string, DependencyNode>,
    files: Map<string, FileAnalysisResult>
  ): void {
    // Build lookup: function name -> possible function IDs
    const nameLookup = new Map<string, string[]>();

    for (const [id, node] of nodes) {
      const existing = nameLookup.get(node.name) || [];
      existing.push(id);
      nameLookup.set(node.name, existing);
    }

    // For each function, resolve its calls
    for (const [filePath, result] of files) {
      for (const fn of result.functions) {
        const callerNode = nodes.get(fn.id);
        if (!callerNode) continue;

        for (const call of fn.calls) {
          // Try to find the called function
          const calleeIds = this.resolveCallTarget(call.name, filePath, nameLookup, nodes);

          for (const calleeId of calleeIds) {
            const calleeNode = nodes.get(calleeId);
            if (!calleeNode) continue;

            // Add to caller's "calls" list
            const callRef: FunctionReference = {
              functionId: calleeId,
              file: calleeNode.file,
              name: calleeNode.name,
              location: {
                file: calleeNode.file,
                startLine: calleeNode.line,
                startColumn: 0,
                endLine: calleeNode.line,
                endColumn: 0
              }
            };
            callerNode.calls.push(callRef);

            // Add to callee's "calledBy" list
            const callerRef: FunctionReference = {
              functionId: fn.id,
              file: filePath,
              name: fn.name,
              location: fn.location
            };
            calleeNode.calledBy.push(callerRef);
          }
        }
      }
    }
  }

  /**
   * Resolve a call name to function ID(s).
   */
  private resolveCallTarget(
    callName: string,
    callerFile: string,
    nameLookup: Map<string, string[]>,
    nodes: Map<string, DependencyNode>
  ): string[] {
    // Handle method calls like "utils.format" -> "format"
    const simpleName = callName.includes('.') ? callName.split('.').pop()! : callName;

    const candidates = nameLookup.get(simpleName) || [];

    if (candidates.length === 0) {
      return []; // External or built-in function
    }

    if (candidates.length === 1) {
      return candidates; // Unambiguous
    }

    // Multiple candidates - prefer same file, then same directory
    const callerDir = callerFile.substring(0, callerFile.lastIndexOf('/'));

    // Sort by proximity
    const sorted = candidates.sort((a, b) => {
      const nodeA = nodes.get(a)!;
      const nodeB = nodes.get(b)!;

      // Same file wins
      if (nodeA.file === callerFile) return -1;
      if (nodeB.file === callerFile) return 1;

      // Same directory wins
      const dirA = nodeA.file.substring(0, nodeA.file.lastIndexOf('/'));
      const dirB = nodeB.file.substring(0, nodeB.file.lastIndexOf('/'));

      if (dirA === callerDir) return -1;
      if (dirB === callerDir) return 1;

      return 0;
    });

    // Return best match only to avoid false positives
    return [sorted[0]];
  }

  /**
   * Build file -> functions index.
   */
  private buildFileIndex(nodes: Map<string, DependencyNode>): Map<string, string[]> {
    const index = new Map<string, string[]>();

    for (const [id, node] of nodes) {
      const existing = index.get(node.file) || [];
      existing.push(id);
      index.set(node.file, existing);
    }

    return index;
  }

  /**
   * Build external dependency -> functions index.
   */
  private buildExternalDepIndex(nodes: Map<string, DependencyNode>): Map<string, string[]> {
    const index = new Map<string, string[]>();

    for (const [id, node] of nodes) {
      for (const dep of node.externalDeps) {
        const existing = index.get(dep.name) || [];
        existing.push(id);
        index.set(dep.name, existing);
      }
    }

    return index;
  }

  /**
   * Calculate graph statistics.
   */
  private calculateStats(nodes: Map<string, DependencyNode>): DependencyGraph['stats'] {
    let totalConnections = 0;
    let maxDepth = 0;

    for (const node of nodes.values()) {
      totalConnections += node.calls.length;
    }

    // Calculate max depth using BFS
    for (const node of nodes.values()) {
      if (node.calledBy.length === 0) {
        // This is a root node (entry point)
        const depth = this.calculateDepth(node.functionId, nodes, new Set());
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return {
      totalFunctions: nodes.size,
      totalConnections,
      averageConnections: nodes.size > 0 ? totalConnections / nodes.size : 0,
      maxDepth
    };
  }

  /**
   * Calculate depth of call tree from a node.
   */
  private calculateDepth(
    nodeId: string,
    nodes: Map<string, DependencyNode>,
    visited: Set<string>
  ): number {
    if (visited.has(nodeId)) return 0; // Cycle detection
    visited.add(nodeId);

    const node = nodes.get(nodeId);
    if (!node || node.calls.length === 0) return 1;

    let maxChildDepth = 0;
    for (const call of node.calls) {
      const childDepth = this.calculateDepth(call.functionId, nodes, visited);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return 1 + maxChildDepth;
  }
}

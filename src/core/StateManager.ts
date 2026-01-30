import { TypedEventBus } from './EventBus';
import {
  FileAnalysisResult,
  FunctionInfo,
  HealthStatus,
  AnalysisSummary,
  DependencyGraph,
  GraphNode,
  GraphEdge,
  ImpactAnalysisResult
} from '../types';
import { Logger } from '../utils/logger';

/**
 * Central state manager for CodePulse.
 * Single source of truth for all analysis data.
 */
export class StateManager {
  public readonly events: TypedEventBus;

  private readonly logger: Logger;
  private readonly fileResults = new Map<string, FileAnalysisResult>();
  private readonly analyzingFiles = new Set<string>();

  // Dependency Graph - will be populated by DependencyGraphBuilder (Stage 3B)
  private dependencyGraph: DependencyGraph | null = null;

  constructor() {
    this.events = new TypedEventBus();
    this.logger = new Logger('StateManager');
  }

  // ═══════════════════════════════════════════════════════════
  // FILE RESULTS
  // ═══════════════════════════════════════════════════════════

  /**
   * Set analysis result for a file.
   */
  public setFileResult(filePath: string, result: FileAnalysisResult): void {
    const previous = this.fileResults.get(filePath);
    this.fileResults.set(filePath, result);

    // Check for health changes
    if (previous) {
      this.checkHealthChanges(previous, result);
    }

    // Emit event
    this.events.emit('analysis:completed', { file: filePath, result });

    // Update workspace summary
    this.emitWorkspaceUpdate();

    // Rebuild dependency graph
    this.rebuildGraph();
  }

  /**
   * Get analysis result for a file.
   */
  public getFileResult(filePath: string): FileAnalysisResult | undefined {
    return this.fileResults.get(filePath);
  }

  /**
   * Check if we have results for a file.
   */
  public hasFileResult(filePath: string): boolean {
    return this.fileResults.has(filePath);
  }

  /**
   * Clear results for a file.
   */
  public clearFile(filePath: string): void {
    this.fileResults.delete(filePath);
    this.emitWorkspaceUpdate();
    this.rebuildGraph();
  }

  /**
   * Get all analyzed file paths.
   */
  public getAnalyzedFiles(): string[] {
    return Array.from(this.fileResults.keys());
  }

  // ═══════════════════════════════════════════════════════════
  // FUNCTION QUERIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Get all functions across all files.
   */
  public getAllFunctions(): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    for (const result of this.fileResults.values()) {
      functions.push(...result.functions);
    }
    return functions;
  }

  /**
   * Get functions by file path.
   */
  public getFunctionsByFile(filePath: string): FunctionInfo[] {
    return this.fileResults.get(filePath)?.functions ?? [];
  }

  /**
   * Get functions by health status.
   */
  public getFunctionsByHealth(health: HealthStatus): FunctionInfo[] {
    return this.getAllFunctions().filter((fn) => fn.health === health);
  }

  /**
   * Get a specific function by ID.
   */
  public getFunctionById(functionId: string): FunctionInfo | undefined {
    for (const result of this.fileResults.values()) {
      const fn = result.functions.find((f) => f.id === functionId);
      if (fn) return fn;
    }
    return undefined;
  }

  // ═══════════════════════════════════════════════════════════
  // DEPENDENCY GRAPH - הפיצ'ר החשוב!
  // ═══════════════════════════════════════════════════════════

  /**
   * Rebuild the dependency graph from current file results.
   * Will be enhanced in Stage 3B with DependencyGraphBuilder.
   */
  private rebuildGraph(): void {
    if (this.fileResults.size === 0) {
      this.dependencyGraph = null;
      return;
    }

    // Build a basic graph from current file results
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const outgoing = new Map<string, Set<string>>();
    const incoming = new Map<string, Set<string>>();

    // Add all functions as nodes
    for (const result of this.fileResults.values()) {
      for (const fn of result.functions) {
        nodes.set(fn.id, {
          id: fn.id,
          name: fn.name,
          file: fn.file,
          line: fn.location.startLine,
          health: fn.health,
          issueCount: fn.issues.length,
          isExported: fn.isExported,
          type: fn.type
        });

        outgoing.set(fn.id, new Set());
        incoming.set(fn.id, new Set());
      }
    }

    // Build name lookup for resolving function calls
    const nameLookup = new Map<string, string[]>();
    for (const [id, node] of nodes) {
      const existing = nameLookup.get(node.name) || [];
      existing.push(id);
      nameLookup.set(node.name, existing);
    }

    // Build import map: (file, localName) -> resolvedPath
    // This helps resolve calls to imported functions
    const importMap = new Map<string, Map<string, string>>();
    for (const result of this.fileResults.values()) {
      const fileImports = new Map<string, string>();
      for (const imp of result.imports) {
        if (imp.resolvedPath) {
          for (const spec of imp.specifiers) {
            // Map local name to the source file
            fileImports.set(spec.local, imp.resolvedPath);
          }
        }
      }
      importMap.set(result.file, fileImports);
    }

    this.logger.debug(`Available function names: ${Array.from(nameLookup.keys()).slice(0, 10).join(', ')}...`);
    this.logger.debug(`Import map built for ${importMap.size} files`);

    // Build edges from calls - resolve by name since FunctionExtractor doesn't set functionId
    let totalCallsFound = 0;
    let totalCallsResolved = 0;

    for (const result of this.fileResults.values()) {
      for (const fn of result.functions) {
        if (fn.calls.length > 0) {
          this.logger.debug(`Function ${fn.name} calls: ${fn.calls.map(c => c.name).join(', ')}`);
        }

        for (const call of fn.calls) {
          totalCallsFound++;
          // Resolve call target using imports when possible
          const calleeIds = this.resolveCallTarget(call.name, fn.file, nameLookup, nodes, importMap);

          if (calleeIds.length > 0) {
            totalCallsResolved++;
          }

          for (const calleeId of calleeIds) {
            // Skip if already added (avoid duplicates)
            if (outgoing.get(fn.id)?.has(calleeId)) continue;

            edges.push({
              from: fn.id,
              to: calleeId,
              line: call.line,
              type: 'calls'
            });

            outgoing.get(fn.id)?.add(calleeId);
            incoming.get(calleeId)?.add(fn.id);
          }
        }
      }
    }

    this.dependencyGraph = {
      nodes,
      edges,
      outgoing,
      incoming,
      builtAt: Date.now()
    };

    this.events.emit('graph:built', {
      stats: {
        totalFunctions: nodes.size,
        totalConnections: edges.length
      }
    });

    this.logger.info('Dependency graph rebuilt', {
      totalFunctions: nodes.size,
      totalConnections: edges.length,
      avgConnections: nodes.size > 0 ? (edges.length / nodes.size).toFixed(2) : 0,
      callsFound: totalCallsFound,
      callsResolved: totalCallsResolved,
      resolutionRate: totalCallsFound > 0 ? `${((totalCallsResolved / totalCallsFound) * 100).toFixed(1)}%` : '0%'
    });

    // Log some examples of what was found
    if (edges.length > 0) {
      const firstEdges = edges.slice(0, 3).map(e => {
        const from = nodes.get(e.from);
        const to = nodes.get(e.to);
        return `${from?.name} -> ${to?.name}`;
      });
      this.logger.debug('Sample edges: ' + firstEdges.join(', '));
    } else {
      this.logger.warn('No edges found in dependency graph! Calls may not be extracted properly.');
    }
  }

  /**
   * Resolve a function call by name to actual function ID(s).
   * NEW: Uses import statements to resolve calls accurately!
   */
  private resolveCallTarget(
    callName: string,
    callerFile: string,
    nameLookup: Map<string, string[]>,
    nodes: Map<string, GraphNode>,
    importMap: Map<string, Map<string, string>>
  ): string[] {
    // Handle method calls like "utils.format" -> "format"
    const simpleName = callName.includes('.') ? callName.split('.').pop()! : callName;

    // STEP 1: Check if this function is imported
    const fileImports = importMap.get(callerFile);
    if (fileImports && fileImports.has(simpleName)) {
      const sourceFile = fileImports.get(simpleName)!;

      // Find functions in the source file with matching name
      const candidates = nameLookup.get(simpleName) || [];
      const imported = candidates.filter(id => {
        const node = nodes.get(id);
        return node && node.file === sourceFile;
      });

      if (imported.length > 0) {
        this.logger.debug(`Resolved ${simpleName} via import from ${sourceFile}`);
        return imported;
      }
    }

    // STEP 2: Fallback to name-based resolution
    const candidates = nameLookup.get(simpleName) || [];

    if (candidates.length === 0) {
      return []; // External or built-in function
    }

    if (candidates.length === 1) {
      return candidates; // Unambiguous
    }

    // Multiple candidates - prefer same file, then same directory
    const callerDir = callerFile.substring(0, callerFile.lastIndexOf('\\') >= 0
      ? callerFile.lastIndexOf('\\')
      : callerFile.lastIndexOf('/'));

    // Sort by proximity
    const sorted = candidates.sort((a, b) => {
      const nodeA = nodes.get(a)!;
      const nodeB = nodes.get(b)!;

      // Same file wins
      if (nodeA.file === callerFile) return -1;
      if (nodeB.file === callerFile) return 1;

      // Same directory wins
      const dirA = nodeA.file.substring(0, nodeA.file.lastIndexOf('\\') >= 0
        ? nodeA.file.lastIndexOf('\\')
        : nodeA.file.lastIndexOf('/'));
      const dirB = nodeB.file.substring(0, nodeB.file.lastIndexOf('\\') >= 0
        ? nodeB.file.lastIndexOf('\\')
        : nodeB.file.lastIndexOf('/'));

      if (dirA === callerDir) return -1;
      if (dirB === callerDir) return 1;

      return 0;
    });

    // Return best match only to avoid false positives
    return [sorted[0]];
  }

  /**
   * Get the current dependency graph.
   */
  public getGraph(): DependencyGraph | null {
    return this.dependencyGraph;
  }

  /**
   * Get impact analysis for a function.
   * Returns what will break if you change this function!
   */
  public getImpact(functionId: string): ImpactAnalysisResult | null {
    if (!this.dependencyGraph) return null;

    const node = this.dependencyGraph.nodes.get(functionId);
    if (!node) return null;

    const directImpact: ImpactAnalysisResult['directImpact'] = [];
    const indirectImpact: ImpactAnalysisResult['indirectImpact'] = [];
    const affectedFiles = new Set<string>();

    // Get direct callers (depth 1)
    const directCallers = this.dependencyGraph.incoming.get(functionId) ?? new Set();
    for (const callerId of directCallers) {
      const callerNode = this.dependencyGraph.nodes.get(callerId);
      if (callerNode) {
        directImpact.push({
          node: callerNode,
          depth: 1,
          path: [functionId, callerId],
          reason: `Directly calls ${node.name}`
        });
        affectedFiles.add(callerNode.file);
      }
    }

    // Get indirect callers (depth 2+) - with limits to prevent OOM
    const visited = new Set<string>([functionId, ...directCallers]);
    const queue = [...directCallers];
    const MAX_DEPTH = 5;
    const MAX_AFFECTED = 100; // Limit to prevent runaway calculations
    let currentDepth = 1;

    while (queue.length > 0 && currentDepth < MAX_DEPTH && visited.size < MAX_AFFECTED) {
      const batchSize = queue.length;

      for (let i = 0; i < batchSize; i++) {
        const currentId = queue.shift()!;
        const callers = this.dependencyGraph.incoming.get(currentId) ?? new Set();

        for (const callerId of callers) {
          if (!visited.has(callerId)) {
            visited.add(callerId);
            const callerNode = this.dependencyGraph.nodes.get(callerId);
            if (callerNode) {
              indirectImpact.push({
                node: callerNode,
                depth: currentDepth + 1,
                path: [functionId, currentId, callerId],
                reason: `Indirectly affected through call chain`
              });
              affectedFiles.add(callerNode.file);

              // Only continue traversing if we haven't hit limits
              if (visited.size < MAX_AFFECTED) {
                queue.push(callerId);
              }
            }
          }
        }
      }

      currentDepth++;
    }

    const totalAffected = directImpact.length + indirectImpact.length;

    const impact: ImpactAnalysisResult = {
      source: node,
      directImpact,
      indirectImpact,
      totalAffected,
      affectedFiles: Array.from(affectedFiles),
      summary: `Changing ${node.name} affects ${totalAffected} function(s) in ${affectedFiles.size} file(s)`
    };

    this.events.emit('impact:calculated', {
      functionId,
      affected: totalAffected
    });

    return impact;
  }

  /**
   * Get functions that call a specific function.
   */
  public getCallers(functionId: string): FunctionInfo[] {
    if (!this.dependencyGraph) return [];

    const callerIds = this.dependencyGraph.incoming.get(functionId) ?? new Set();
    return Array.from(callerIds)
      .map((id) => this.getFunctionById(id))
      .filter((fn): fn is FunctionInfo => fn !== undefined);
  }

  /**
   * Get functions that a specific function calls.
   */
  public getCallees(functionId: string): FunctionInfo[] {
    if (!this.dependencyGraph) return [];

    const calleeIds = this.dependencyGraph.outgoing.get(functionId) ?? new Set();
    return Array.from(calleeIds)
      .map((id) => this.getFunctionById(id))
      .filter((fn): fn is FunctionInfo => fn !== undefined);
  }

  // ═══════════════════════════════════════════════════════════
  // SUMMARIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Get summary statistics.
   */
  public getSummary(): AnalysisSummary {
    const functions = this.getAllFunctions();

    return {
      totalFiles: this.fileResults.size,
      totalFunctions: functions.length,
      healthyCount: functions.filter((f) => f.health === HealthStatus.HEALTHY).length,
      warningCount: functions.filter((f) => f.health === HealthStatus.WARNING).length,
      errorCount: functions.filter((f) => f.health === HealthStatus.ERROR).length,
      unknownCount: functions.filter((f) => f.health === HealthStatus.UNKNOWN).length
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ANALYZING STATE
  // ═══════════════════════════════════════════════════════════

  /**
   * Mark a file as currently being analyzed.
   */
  public setAnalyzing(filePath: string, analyzing: boolean): void {
    if (analyzing) {
      this.analyzingFiles.add(filePath);
      this.events.emit('analysis:started', { file: filePath });
    } else {
      this.analyzingFiles.delete(filePath);
    }
  }

  /**
   * Check if a file is currently being analyzed.
   */
  public isAnalyzing(filePath: string): boolean {
    return this.analyzingFiles.has(filePath);
  }

  /**
   * Check if any file is currently being analyzed.
   */
  public isAnyAnalyzing(): boolean {
    return this.analyzingFiles.size > 0;
  }

  /**
   * Report an analysis error.
   */
  public reportAnalysisError(filePath: string, error: Error): void {
    this.analyzingFiles.delete(filePath);
    this.events.emit('analysis:error', { file: filePath, error });
    this.logger.error(`Analysis error for ${filePath}`, error);
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Check for health changes and emit events.
   */
  private checkHealthChanges(previous: FileAnalysisResult, current: FileAnalysisResult): void {
    for (const currentFn of current.functions) {
      const previousFn = previous.functions.find((f) => f.name === currentFn.name);

      if (previousFn && previousFn.health !== currentFn.health) {
        this.events.emit('health:changed', {
          functionId: currentFn.id,
          oldHealth: previousFn.health,
          newHealth: currentFn.health
        });
      }
    }
  }

  /**
   * Emit workspace updated event.
   */
  private emitWorkspaceUpdate(): void {
    this.events.emit('workspace:updated', { summary: this.getSummary() });
  }

  /**
   * Clear all state.
   */
  public clear(): void {
    this.fileResults.clear();
    this.analyzingFiles.clear();
    this.dependencyGraph = null;
    this.emitWorkspaceUpdate();
  }
}

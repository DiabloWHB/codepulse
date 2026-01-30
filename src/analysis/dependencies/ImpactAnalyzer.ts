import {
  DependencyGraph,
  DependencyNode,
  ImpactAnalysis,
  calculateRiskLevel,
  formatImpactSummary
} from './types';
import { Logger } from '../../utils/logger';

/**
 * Analyzes the impact of changes to functions.
 * Core feature: "If I change this, what breaks?"
 */
export class ImpactAnalyzer {
  private readonly logger: Logger;
  private graph: DependencyGraph | null = null;

  constructor() {
    this.logger = new Logger('ImpactAnalyzer');
  }

  /**
   * Set the dependency graph to analyze.
   */
  public setGraph(graph: DependencyGraph): void {
    this.graph = graph;
  }

  /**
   * Analyze impact of changing a specific function.
   */
  public analyzeFunction(functionId: string): ImpactAnalysis | null {
    if (!this.graph) {
      this.logger.warn('No dependency graph available');
      return null;
    }

    const sourceNode = this.graph.nodes.get(functionId);
    if (!sourceNode) {
      this.logger.warn(`Function not found: ${functionId}`);
      return null;
    }

    // Find all affected functions
    const { direct, indirect } = this.findAffected(functionId);

    // Get unique affected files
    const affectedFiles = new Set<string>();
    affectedFiles.add(sourceNode.file);

    for (const node of [...direct, ...indirect]) {
      affectedFiles.add(node.file);
    }

    const impact: ImpactAnalysis = {
      source: sourceNode,
      directImpact: direct,
      indirectImpact: indirect,
      totalAffected: direct.length + indirect.length,
      affectedFiles: Array.from(affectedFiles),
      riskLevel: calculateRiskLevel(direct.length, indirect.length),
      summary: ''
    };

    impact.summary = formatImpactSummary(impact);

    this.logger.debug(`Impact analysis for ${sourceNode.name}`, {
      direct: direct.length,
      indirect: indirect.length,
      risk: impact.riskLevel
    });

    return impact;
  }

  /**
   * Find all functions affected by a change (direct and indirect).
   */
  private findAffected(functionId: string): {
    direct: DependencyNode[];
    indirect: DependencyNode[];
  } {
    const direct: DependencyNode[] = [];
    const indirect: DependencyNode[] = [];
    const visited = new Set<string>();

    if (!this.graph) {
      return { direct, indirect };
    }

    const sourceNode = this.graph.nodes.get(functionId);
    if (!sourceNode) {
      return { direct, indirect };
    }

    // BFS to find all callers
    const queue: Array<{ id: string; depth: number }> = [];

    // Start with direct callers
    for (const caller of sourceNode.calledBy) {
      queue.push({ id: caller.functionId, depth: 1 });
    }

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);

      const node = this.graph.nodes.get(id);
      if (!node) continue;

      // Categorize as direct or indirect
      if (depth === 1) {
        direct.push(node);
      } else {
        indirect.push(node);
      }

      // Add this node's callers to queue
      for (const caller of node.calledBy) {
        if (!visited.has(caller.functionId)) {
          queue.push({ id: caller.functionId, depth: depth + 1 });
        }
      }
    }

    return { direct, indirect };
  }

  /**
   * Analyze impact of changing a file.
   */
  public analyzeFile(filePath: string): ImpactAnalysis[] {
    if (!this.graph) return [];

    const functionIds = this.graph.fileIndex.get(filePath) || [];
    const results: ImpactAnalysis[] = [];

    for (const functionId of functionIds) {
      const impact = this.analyzeFunction(functionId);
      if (impact && impact.totalAffected > 0) {
        results.push(impact);
      }
    }

    // Sort by risk level
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    results.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

    return results;
  }

  /**
   * Analyze impact of changing a database table.
   */
  public analyzeTable(tableName: string): ImpactAnalysis | null {
    if (!this.graph) return null;

    const depKey = `supabase:${tableName}`;
    const functionIds = this.graph.externalDepIndex.get(depKey) || [];

    if (functionIds.length === 0) {
      return null;
    }

    // Create a virtual "table" node for the analysis
    const virtualNode: DependencyNode = {
      functionId: depKey,
      file: 'database',
      name: `Table: ${tableName}`,
      line: 0,
      calledBy: [],
      calls: [],
      externalDeps: []
    };

    // All functions using this table are directly impacted
    const direct: DependencyNode[] = [];
    const indirect: DependencyNode[] = [];
    const visited = new Set<string>();

    for (const functionId of functionIds) {
      const node = this.graph.nodes.get(functionId);
      if (node) {
        direct.push(node);
        visited.add(functionId);

        // Find indirect through callers
        const { indirect: fnIndirect } = this.findAffected(functionId);
        for (const indirectNode of fnIndirect) {
          if (!visited.has(indirectNode.functionId)) {
            indirect.push(indirectNode);
            visited.add(indirectNode.functionId);
          }
        }
      }
    }

    const affectedFiles = new Set<string>();
    for (const node of [...direct, ...indirect]) {
      affectedFiles.add(node.file);
    }

    return {
      source: virtualNode,
      directImpact: direct,
      indirectImpact: indirect,
      totalAffected: direct.length + indirect.length,
      affectedFiles: Array.from(affectedFiles),
      riskLevel: calculateRiskLevel(direct.length, indirect.length),
      summary: `Changing table "${tableName}" affects ${direct.length + indirect.length} functions`
    };
  }

  /**
   * Get functions with highest impact (most callers).
   */
  public getHighImpactFunctions(limit: number = 10): DependencyNode[] {
    if (!this.graph) return [];

    const nodes = Array.from(this.graph.nodes.values());

    // Sort by number of callers (direct + indirect potential)
    nodes.sort((a, b) => {
      const impactA = this.analyzeFunction(a.functionId);
      const impactB = this.analyzeFunction(b.functionId);

      const totalA = impactA?.totalAffected ?? 0;
      const totalB = impactB?.totalAffected ?? 0;

      return totalB - totalA;
    });

    return nodes.slice(0, limit);
  }

  /**
   * Generate a summary report for the entire codebase.
   */
  public generateReport(): {
    totalFunctions: number;
    highRiskFunctions: number;
    criticalPaths: DependencyNode[];
    isolatedFunctions: number;
    summary: string;
  } {
    if (!this.graph) {
      return {
        totalFunctions: 0,
        highRiskFunctions: 0,
        criticalPaths: [],
        isolatedFunctions: 0,
        summary: 'No dependency graph available'
      };
    }

    let highRiskCount = 0;
    let isolatedCount = 0;
    const criticalPaths: DependencyNode[] = [];

    for (const node of this.graph.nodes.values()) {
      const impact = this.analyzeFunction(node.functionId);

      if (impact) {
        if (impact.riskLevel === 'high' || impact.riskLevel === 'critical') {
          highRiskCount++;
          criticalPaths.push(node);
        }
      }

      // Isolated = no callers and no callees
      if (node.calledBy.length === 0 && node.calls.length === 0) {
        isolatedCount++;
      }
    }

    // Sort critical paths by impact
    criticalPaths.sort((a, b) => {
      const impactA = this.analyzeFunction(a.functionId)?.totalAffected ?? 0;
      const impactB = this.analyzeFunction(b.functionId)?.totalAffected ?? 0;
      return impactB - impactA;
    });

    return {
      totalFunctions: this.graph.stats.totalFunctions,
      highRiskFunctions: highRiskCount,
      criticalPaths: criticalPaths.slice(0, 10),
      isolatedFunctions: isolatedCount,
      summary: `${this.graph.stats.totalFunctions} functions, ${highRiskCount} high-risk, ${isolatedCount} isolated`
    };
  }
}

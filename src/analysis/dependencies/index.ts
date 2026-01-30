// Types
export type {
  FunctionReference,
  ExternalDependency,
  DependencyNode,
  ImpactAnalysis,
  DependencyGraph
} from './types';

export { calculateRiskLevel, formatImpactSummary } from './types';

// Builder
export { DependencyGraphBuilder } from './DependencyGraphBuilder';

// Analyzer
export { ImpactAnalyzer } from './ImpactAnalyzer';

export { CodeParser, sharedParser } from './Parser';
export type { SupportedLanguage } from './Parser';
export { FunctionExtractor } from './FunctionExtractor';
export { AnalysisEngine } from './AnalysisEngine';
export { BaseAnalyzer, StaticAnalyzer, ImportAnalyzer, EnvAnalyzer } from './analyzers';
export type { AnalysisContext, AnalyzerResult } from './analyzers';

// Dependencies
export {
  DependencyGraphBuilder,
  ImpactAnalyzer,
  calculateRiskLevel,
  formatImpactSummary
} from './dependencies';

export type {
  FunctionReference,
  ExternalDependency,
  DependencyNode,
  ImpactAnalysis,
  DependencyGraph
} from './dependencies';

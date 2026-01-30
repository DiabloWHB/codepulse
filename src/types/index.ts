// Health types
export {
  HealthStatus,
  IssueSeverity,
  IssueCategory,
  getHealthIcon,
  getHealthDisplayName
} from './health';

// Analysis types
export type {
  SourceLocation,
  IssueFix,
  Issue,
  FileAnalysisResult,
  ImportInfo,
  ImportSpecifier,
  ExportInfo,
  AnalysisSummary,
  WorkspaceAnalysisResult
} from './analysis';

// Function types
export {
  CodeElementType,
  createFunctionId,
  parseFunctionId,
  createFunctionReference
} from './function';
export type { FunctionInfo, FunctionReference } from './function';

// Graph types (NEW!)
export type {
  GraphNode,
  GraphEdge,
  DependencyGraph,
  ImpactAnalysisResult,
  ImpactedFunction,
  DependencyAnalysisResult,
  ImpactAnalysisOptions,
  GraphStats
} from './graph';

// Config types
export { DEFAULT_CONFIG } from './config';
export type {
  SupabaseConfig,
  GraphConfig,
  UIConfig,
  AnalysisConfig,
  LoggingConfig,
  CodePulseConfig
} from './config';

// Error types
export {
  CodePulseError,
  ParseError,
  ConfigError,
  IntegrationError,
  TimeoutError,
  FileNotFoundError,
  GraphError,
  isCodePulseError,
  toError
} from './errors';

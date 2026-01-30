/**
 * Supabase configuration options.
 */
export interface SupabaseConfig {
  /** Enable Supabase integration */
  enabled: boolean;
  /** Path to Supabase config (relative to workspace) */
  configPath: string;
  /** Auto-fetch schema on startup */
  autoFetchSchema: boolean;
}

/**
 * Dependency graph configuration options.
 */
export interface GraphConfig {
  /** Enable dependency graph building */
  enabled: boolean;
  /** Maximum depth for impact analysis */
  maxDepth: number;
  /** Rebuild graph on every change (vs. on-demand) */
  autoRebuild: boolean;
  /** Include node_modules in graph */
  includeNodeModules: boolean;
}

/**
 * UI configuration options.
 */
export interface UIConfig {
  /** Show inline decorations */
  showDecorations: boolean;
  /** Show status bar item */
  showStatusBar: boolean;
  /** Show in Problems panel */
  showDiagnostics: boolean;
  /** Decoration style */
  decorationStyle: 'icon' | 'background' | 'both';
  /** Show impact indicators */
  showImpactIndicators: boolean;
}

/**
 * Analysis configuration options.
 */
export interface AnalysisConfig {
  /** Enable static analysis */
  staticAnalysis: boolean;
  /** Enable import analysis */
  importAnalysis: boolean;
  /** Enable environment variable analysis */
  envAnalysis: boolean;
  /** Maximum file size to analyze (bytes) */
  maxFileSize: number;
  /** Analysis timeout per file (ms) */
  timeout: number;
}

/**
 * Logging configuration options.
 */
export interface LoggingConfig {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Log to output channel */
  outputChannel: boolean;
}

/**
 * User-configurable extension settings.
 */
export interface CodePulseConfig {
  /** Enable/disable the extension */
  enabled: boolean;
  /** Debounce delay for file changes (ms) */
  debounceDelay: number;
  /** File patterns to include */
  includePatterns: string[];
  /** File patterns to exclude */
  excludePatterns: string[];
  /** Supabase configuration */
  supabase: SupabaseConfig;
  /** Dependency graph configuration */
  graph: GraphConfig;
  /** UI configuration */
  ui: UIConfig;
  /** Analysis configuration */
  analysis: AnalysisConfig;
  /** Logging configuration */
  logging: LoggingConfig;
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: CodePulseConfig = {
  enabled: true,
  debounceDelay: 300,
  includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  supabase: {
    enabled: true,
    configPath: 'supabase/config.toml',
    autoFetchSchema: true
  },
  graph: {
    enabled: true,
    maxDepth: 5,
    autoRebuild: true,
    includeNodeModules: false
  },
  ui: {
    showDecorations: true,
    showStatusBar: true,
    showDiagnostics: true,
    decorationStyle: 'icon',
    showImpactIndicators: true
  },
  analysis: {
    staticAnalysis: true,
    importAnalysis: true,
    envAnalysis: true,
    maxFileSize: 1048576, // 1MB
    timeout: 5000
  },
  logging: {
    level: 'info',
    outputChannel: true
  }
};

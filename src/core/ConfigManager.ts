import * as vscode from 'vscode';
import { CodePulseConfig, DEFAULT_CONFIG } from '../types';
import { Logger } from '../utils/logger';
import { matchesPatterns } from '../utils/paths';

/**
 * Manages extension configuration.
 */
export class ConfigManager {
  private readonly logger: Logger;
  private config: CodePulseConfig;
  private disposable: vscode.Disposable;

  constructor() {
    this.logger = new Logger('ConfigManager');
    this.config = this.loadConfig();

    // Watch for configuration changes
    this.disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('codepulse')) {
        this.config = this.loadConfig();
        this.logger.info('Configuration reloaded');
      }
    });
  }

  /**
   * Load configuration from VS Code settings.
   */
  private loadConfig(): CodePulseConfig {
    const vsConfig = vscode.workspace.getConfiguration('codepulse');

    return {
      enabled: vsConfig.get('enabled', DEFAULT_CONFIG.enabled),
      debounceDelay: vsConfig.get('debounceDelay', DEFAULT_CONFIG.debounceDelay),
      includePatterns: vsConfig.get('includePatterns', DEFAULT_CONFIG.includePatterns),
      excludePatterns: vsConfig.get('excludePatterns', DEFAULT_CONFIG.excludePatterns),
      supabase: {
        enabled: vsConfig.get('supabase.enabled', DEFAULT_CONFIG.supabase.enabled),
        configPath: vsConfig.get('supabase.configPath', DEFAULT_CONFIG.supabase.configPath),
        autoFetchSchema: vsConfig.get(
          'supabase.autoFetchSchema',
          DEFAULT_CONFIG.supabase.autoFetchSchema
        )
      },
      graph: {
        enabled: vsConfig.get('graph.enabled', DEFAULT_CONFIG.graph.enabled),
        maxDepth: vsConfig.get('graph.maxDepth', DEFAULT_CONFIG.graph.maxDepth),
        autoRebuild: vsConfig.get('graph.autoRebuild', DEFAULT_CONFIG.graph.autoRebuild),
        includeNodeModules: vsConfig.get(
          'graph.includeNodeModules',
          DEFAULT_CONFIG.graph.includeNodeModules
        )
      },
      ui: {
        showDecorations: vsConfig.get('ui.showDecorations', DEFAULT_CONFIG.ui.showDecorations),
        showStatusBar: vsConfig.get('ui.showStatusBar', DEFAULT_CONFIG.ui.showStatusBar),
        showDiagnostics: vsConfig.get('ui.showDiagnostics', DEFAULT_CONFIG.ui.showDiagnostics),
        decorationStyle: vsConfig.get('ui.decorationStyle', DEFAULT_CONFIG.ui.decorationStyle),
        showImpactIndicators: vsConfig.get(
          'ui.showImpactIndicators',
          DEFAULT_CONFIG.ui.showImpactIndicators
        )
      },
      analysis: {
        staticAnalysis: vsConfig.get(
          'analysis.staticAnalysis',
          DEFAULT_CONFIG.analysis.staticAnalysis
        ),
        importAnalysis: vsConfig.get(
          'analysis.importAnalysis',
          DEFAULT_CONFIG.analysis.importAnalysis
        ),
        envAnalysis: vsConfig.get('analysis.envAnalysis', DEFAULT_CONFIG.analysis.envAnalysis),
        maxFileSize: vsConfig.get('analysis.maxFileSize', DEFAULT_CONFIG.analysis.maxFileSize),
        timeout: vsConfig.get('analysis.timeout', DEFAULT_CONFIG.analysis.timeout)
      },
      logging: {
        level: vsConfig.get('logging.level', DEFAULT_CONFIG.logging.level),
        outputChannel: vsConfig.get('logging.outputChannel', DEFAULT_CONFIG.logging.outputChannel)
      }
    };
  }

  /**
   * Get current configuration.
   */
  public getConfig(): CodePulseConfig {
    return this.config;
  }

  /**
   * Check if extension is enabled.
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if a file should be analyzed.
   */
  public shouldAnalyzeFile(filePath: string): boolean {
    if (!this.config.enabled) return false;

    // Check exclude patterns first
    if (matchesPatterns(filePath, this.config.excludePatterns)) {
      return false;
    }

    // Check include patterns
    return matchesPatterns(filePath, this.config.includePatterns);
  }

  /**
   * Dispose resources.
   */
  public dispose(): void {
    this.disposable.dispose();
  }
}

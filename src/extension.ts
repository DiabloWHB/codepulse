import * as vscode from 'vscode';
import { StateManager } from './core/StateManager';
import { ConfigManager } from './core/ConfigManager';
import { CacheManager } from './core/CacheManager';
import { AnalysisEngine } from './analysis/AnalysisEngine';
import { SupabaseAnalyzer } from './analysis/analyzers/SupabaseAnalyzer';
import { ProductionReadinessAnalyzer } from './analysis/analyzers/ProductionReadinessAnalyzer';
import { ProjectReportGenerator } from './reports/ProjectReport';
import { DecorationManager } from './ui/DecorationManager';
import { DiagnosticManager } from './ui/DiagnosticManager';
import { StatusBarManager } from './ui/StatusBarManager';
import { registerTreeView } from './ui/TreeViewProvider';
import { registerQuickAccessView } from './ui/QuickAccessView';
import { registerDetailsWebviewView } from './ui/DetailsWebviewView';
import { registerImpactCodeLens } from './ui/ImpactCodeLensProvider';
import { SymbolIndexManager } from './index/SymbolIndexManager';
import { AIContextProvider } from './index/AIContextProvider';
import { IndexWatcher } from './index/IndexWatcher';
import { Logger } from './utils/logger';
import { debounce } from './utils/debounce';
import { isSupportedFile } from './utils/paths';
import { FileAnalysisResult } from './types';
import * as path from 'path';
import * as fs from 'fs';

let stateManager: StateManager;
let configManager: ConfigManager;
let cacheManager: CacheManager<FileAnalysisResult>;
let analysisEngine: AnalysisEngine;
let decorationManager: DecorationManager;
let diagnosticManager: DiagnosticManager;
let statusBarManager: StatusBarManager;
let symbolIndexManager: SymbolIndexManager;
let aiContextProvider: AIContextProvider;
let indexWatcher: IndexWatcher;
let logger: Logger;

/**
 * Setup MCP server configuration automatically in the workspace.
 * Creates .mcp.json that registers the CodePulse MCP server.
 */
async function setupMCPConfig(
  context: vscode.ExtensionContext,
  workspaceRoot: string
): Promise<void> {
  try {
    const mcpConfigPath = path.join(workspaceRoot, '.mcp.json');

    // Check if .mcp.json already exists
    const mcpExists = await fs.promises
      .access(mcpConfigPath)
      .then(() => true)
      .catch(() => false);

    // Path to the MCP server executable (in extension dist folder)
    const mcpServerPath = path.join(context.extensionPath, 'dist', 'mcp', 'index.js');

    // CodePulse MCP server configuration
    const codepulseServer = {
      type: 'stdio',
      command: 'node',
      args: [mcpServerPath],
      env: {
        WORKSPACE_PATH: workspaceRoot,
        INDEX_CACHE_PATH: path.join(workspaceRoot, '.codepulse', 'index.cache.json')
      },
      metadata: {
        name: 'CodePulse Symbol Index',
        description: 'Provides fast, token-efficient access to the CodePulse symbol index. Use this instead of Grep/Read for finding code!',
        autoStart: true
      }
    };

    let mcpConfig: any;

    if (mcpExists) {
      // Read existing config and update/add CodePulse to it
      try {
        mcpConfig = JSON.parse(await fs.promises.readFile(mcpConfigPath, 'utf-8'));

        // Add or update CodePulse server
        if (!mcpConfig.mcpServers) {
          mcpConfig.mcpServers = {};
        }

        const isUpdate = !!mcpConfig.mcpServers.codepulse;
        mcpConfig.mcpServers.codepulse = codepulseServer;

        logger?.info(isUpdate ? 'Updating CodePulse in MCP config' : 'Adding CodePulse to existing MCP config', {
          existingServers: Object.keys(mcpConfig.mcpServers).filter(k => k !== 'codepulse')
        });
      } catch (error) {
        logger?.warn('Failed to parse existing .mcp.json, creating new config', { error: String(error) });
        // If parsing failed, create fresh config
        mcpConfig = {
          mcpServers: {
            codepulse: codepulseServer
          }
        };
      }
    } else {
      // Create new config
      mcpConfig = {
        mcpServers: {
          codepulse: codepulseServer
        }
      };
    }

    // Write .mcp.json
    await fs.promises.writeFile(
      mcpConfigPath,
      JSON.stringify(mcpConfig, null, 2),
      'utf-8'
    );

    logger?.info('MCP configuration created', { location: mcpConfigPath });

    // Show notification
    vscode.window.showInformationMessage(
      '🚀 CodePulse: MCP server configured! Restart Claude Code to use fast index queries.',
      'Learn More'
    ).then((selection) => {
      if (selection === 'Learn More') {
        vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/DiabloWHB/codepulse#mcp-integration')
        );
      }
    });
  } catch (error) {
    logger?.error('Failed to setup MCP config', { error: String(error) });
    // Don't throw - MCP setup failure shouldn't prevent extension activation
  }
}

/**
 * Setup Claude Code skills automatically in the workspace.
 * Copies skill templates from extension to .claude/skills/ directory.
 */
async function setupClaudeSkills(
  context: vscode.ExtensionContext,
  workspaceRoot: string
): Promise<void> {
  try {
    const skillsDir = path.join(workspaceRoot, '.claude', 'skills', 'codepulse-index');
    const templatesDir = path.join(context.extensionPath, 'src', 'skills', 'templates');

    // Check if skills already exist
    const skillExists = await fs.promises
      .access(path.join(skillsDir, 'SKILL.md'))
      .then(() => true)
      .catch(() => false);

    if (skillExists) {
      logger?.debug('Claude skills already exist, skipping setup');
      return;
    }

    // Create skills directory
    await fs.promises.mkdir(skillsDir, { recursive: true });

    // Copy SKILL.md
    const skillFile = path.join(templatesDir, 'SKILL.md');
    const skillDest = path.join(skillsDir, 'SKILL.md');
    await fs.promises.copyFile(skillFile, skillDest);

    // Copy examples directory
    const examplesDir = path.join(templatesDir, 'examples');
    const examplesDest = path.join(skillsDir, 'examples');
    await fs.promises.mkdir(examplesDest, { recursive: true });

    // Copy example files
    const exampleFiles = ['good.md', 'bad.md'];
    for (const file of exampleFiles) {
      const src = path.join(examplesDir, file);
      const dest = path.join(examplesDest, file);
      await fs.promises.copyFile(src, dest);
    }

    logger?.info('Claude skills setup completed', {
      location: skillsDir
    });

    // Show notification
    vscode.window.showInformationMessage(
      '💡 CodePulse: Claude Code skills configured for this workspace',
      'Learn More'
    ).then((selection) => {
      if (selection === 'Learn More') {
        vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/DiabloWHB/codepulse#claude-code-integration')
        );
      }
    });
  } catch (error) {
    logger?.error('Failed to setup Claude skills', { error: String(error) });
    // Don't throw - skill setup failure shouldn't prevent extension activation
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  Logger.initialize('info');
  logger = new Logger('Extension');
  logger.info('CodePulse activating...');

  try {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      logger.warn('No workspace folder found');
      return;
    }

    // Setup Claude Code skills automatically
    await setupClaudeSkills(context, workspaceRoot);

    // Setup MCP configuration automatically
    await setupMCPConfig(context, workspaceRoot);

    // Initialize core
    stateManager = new StateManager();
    configManager = new ConfigManager();
    cacheManager = new CacheManager<FileAnalysisResult>();
    analysisEngine = new AnalysisEngine(workspaceRoot, cacheManager);

    // Initialize Supabase
    const supabaseAnalyzer = new SupabaseAnalyzer();
    await supabaseAnalyzer.initialize(workspaceRoot);
    analysisEngine.registerAnalyzer(supabaseAnalyzer);

    // Initialize Production Readiness Analyzer
    const productionReadinessAnalyzer = new ProductionReadinessAnalyzer();
    analysisEngine.registerAnalyzer(productionReadinessAnalyzer);

    // Initialize Symbol Index System
    symbolIndexManager = new SymbolIndexManager();
    aiContextProvider = new AIContextProvider(symbolIndexManager);
    indexWatcher = new IndexWatcher(symbolIndexManager);

    logger.info('Initializing symbol index...');

    // Build index in background with progress
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'CodePulse: Building Symbol Index',
        cancellable: false
      },
      async (progress) => {
        symbolIndexManager.onProgress((indexProgress) => {
          progress.report({
            increment: (1 / indexProgress.total) * 100,
            message: `${indexProgress.current}/${indexProgress.total} files (${indexProgress.percentage}%)`
          });
        });

        await symbolIndexManager.buildIndex(workspaceRoot);

        // Export cache for MCP server
        const cachePath = path.join(workspaceRoot, '.codepulse', 'index.cache.json');
        await symbolIndexManager.exportCache(cachePath);

        const stats = symbolIndexManager.getStats();
        logger.info('Symbol index built', {
          totalSymbols: stats.totalSymbols,
          totalFiles: stats.totalFiles
        });

        vscode.window.showInformationMessage(
          `CodePulse: Indexed ${stats.totalSymbols} symbols in ${stats.totalFiles} files`
        );
      }
    );

    // Start watching for file changes
    const cachePath = path.join(workspaceRoot, '.codepulse', 'index.cache.json');
    indexWatcher.start(context, cachePath);

    // Register AI context command (MANDATORY for AI usage)
    aiContextProvider.registerAICommand(context);

    // Initialize UI
    decorationManager = new DecorationManager(stateManager);
    diagnosticManager = new DiagnosticManager(stateManager);
    statusBarManager = new StatusBarManager(stateManager);
    registerQuickAccessView(context, stateManager);
    registerTreeView(context, stateManager);
    registerDetailsWebviewView(context, stateManager);
    registerImpactCodeLens(context, stateManager);

    // Register commands
    registerCommands(context, workspaceRoot);
    registerFileWatchers(context, workspaceRoot);

    // Analyze open files
    await analyzeOpenFiles(workspaceRoot);

    logger.info('CodePulse activated');
  } catch (error) {
    logger.error('Activation failed', error);
    vscode.window.showErrorMessage('CodePulse failed to activate');
  }
}

function registerCommands(context: vscode.ExtensionContext, workspaceRoot: string): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('codepulse.analyzeFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isSupportedFile(editor.document.uri.fsPath)) return;
      await analyzeFile(editor.document.uri.fsPath, workspaceRoot);
    }),

    vscode.commands.registerCommand('codepulse.analyzeWorkspace', async () => {
      await analyzeWorkspace(workspaceRoot);
    }),

    vscode.commands.registerCommand('codepulse.showDashboard', () => {
      const summary = stateManager.getSummary();
      const graph = stateManager.getGraph();

      if (summary.totalFunctions === 0) {
        vscode.window.showInformationMessage('No functions analyzed yet. Open a TypeScript/JavaScript file to start!');
        return;
      }

      const healthPercentage = Math.round((summary.healthyCount / summary.totalFunctions) * 100);

      const items = [
        {
          label: '$(pulse) Health Overview',
          description: `${healthPercentage}% healthy`,
          detail: `🟢 ${summary.healthyCount} healthy | 🟡 ${summary.warningCount} warnings | 🔴 ${summary.errorCount} errors`
        },
        {
          label: '$(graph) Dependency Graph',
          description: graph ? `${graph.nodes.size} functions, ${graph.edges.length} connections` : 'Not built yet',
          detail: 'Click to view impact analysis'
        },
        {
          label: '$(file) Analyzed Files',
          description: `${stateManager.getAnalyzedFiles().length} files`,
          detail: 'Total functions: ' + summary.totalFunctions
        },
        {
          label: '$(refresh) Refresh Analysis',
          description: 'Re-analyze all open files',
          action: 'refresh'
        },
        {
          label: '$(folder-opened) Analyze Workspace',
          description: 'Analyze all TypeScript/JavaScript files',
          action: 'analyzeWorkspace'
        }
      ];

      vscode.window.showQuickPick(items, {
        placeHolder: 'CodePulse Dashboard',
        title: `CodePulse - ${summary.totalFunctions} functions analyzed`
      }).then((selected) => {
        if (!selected) return;

        if ((selected as any).action === 'refresh') {
          vscode.commands.executeCommand('codepulse.refresh');
        } else if ((selected as any).action === 'analyzeWorkspace') {
          vscode.commands.executeCommand('codepulse.analyzeWorkspace');
        }
      });
    }),

    vscode.commands.registerCommand('codepulse.showImpact', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const functions = stateManager.getFunctionsByFile(editor.document.uri.fsPath);
      const impacts = functions
        .map((fn) => stateManager.getImpact(fn.id))
        .filter((i) => i !== null && i.totalAffected > 0);

      if (impacts.length === 0) {
        vscode.window.showInformationMessage('No impact data for this file');
        return;
      }

      const items = impacts.map((i) => ({
        label: `${i!.source.name}`,
        description: `${i!.totalAffected} affected`,
        detail: i!.summary
      }));

      vscode.window.showQuickPick(items, { placeHolder: 'Impact Analysis' });
    }),

    vscode.commands.registerCommand('codepulse.showDependencies', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const functions = stateManager.getFunctionsByFile(editor.document.uri.fsPath);

      if (functions.length === 0) {
        vscode.window.showInformationMessage('No functions found in this file');
        return;
      }

      const items = functions.map((fn) => {
        const callsCount = fn.calls?.length || 0;
        const calledByCount = fn.calledBy?.length || 0;
        const impact = stateManager.getImpact(fn.id);

        return {
          label: `${fn.name}`,
          description: `Calls: ${callsCount} | Called by: ${calledByCount}`,
          detail: impact ? `Impact: ${impact.totalAffected} affected` : 'No impact data',
          fn
        };
      });

      vscode.window.showQuickPick(items, {
        placeHolder: 'Function Dependencies',
        onDidSelectItem: (item: any) => {
          if (item?.fn) {
            const fn = item.fn;
            const calls = fn.calls || [];
            const calledBy = fn.calledBy || [];

            const details = [
              `Function: ${fn.name}`,
              ``,
              `Calls (${calls.length}):`,
              ...calls.map((c: any) => `  → ${c.name || c.id}`),
              ``,
              `Called by (${calledBy.length}):`,
              ...calledBy.map((c: any) => `  ← ${c.name || c.id}`)
            ];

            console.log(details.join('\n'));
          }
        }
      }).then((selected) => {
        if (selected?.fn) {
          const pos = new vscode.Position(selected.fn.location.startLine, 0);
          if (editor) {
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          }
        }
      });
    }),

    vscode.commands.registerCommand(
      'codepulse.goToFunction',
      async (info: { file: string; location: { startLine: number } }) => {
        if (!info) return;
        const doc = await vscode.workspace.openTextDocument(info.file);
        const editor = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(info.location.startLine, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    ),

    vscode.commands.registerCommand('codepulse.refresh', async () => {
      cacheManager.clear();
      stateManager.clear();
      await analyzeOpenFiles(workspaceRoot);
      vscode.window.showInformationMessage('CodePulse refreshed');
    }),

    vscode.commands.registerCommand('codepulse.showProjectReport', async () => {
      // First, analyze workspace if needed
      const analyzedFiles = stateManager.getAnalyzedFiles();
      if (analyzedFiles.length === 0) {
        const answer = await vscode.window.showInformationMessage(
          'No files analyzed yet. Analyze workspace now?',
          'Yes', 'No'
        );

        if (answer === 'Yes') {
          await analyzeWorkspace(workspaceRoot);
        } else {
          return;
        }
      }

      // Generate report
      const reportGenerator = new ProjectReportGenerator(stateManager);
      const reportData = reportGenerator.generate();
      const markdownReport = reportGenerator.generateMarkdownReport(reportData);

      // Show report in new document
      const doc = await vscode.workspace.openTextDocument({
        content: markdownReport,
        language: 'markdown'
      });

      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false
      });

      vscode.window.showInformationMessage(
        `Project Report: ${reportData.summary.healthPercentage}% healthy, ${reportData.summary.errorCount} errors, ${reportData.summary.warningCount} warnings`
      );
    }),

    // ===== SYMBOL INDEX COMMANDS =====

    vscode.commands.registerCommand('codepulse.searchSymbol', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search for a symbol (function, class, variable, etc.)',
        placeHolder: 'e.g., sendReport, ClientPage, handleSubmit'
      });

      if (!query) return;

      const results = symbolIndexManager.search({
        terms: query.split(/\s+/),
        fuzzyThreshold: 0.5,
        limit: 20
      });

      if (results.length === 0) {
        vscode.window.showInformationMessage(`No symbols found for: ${query}`);
        return;
      }

      const items = results.map((result) => ({
        label: `$(symbol-${result.symbol.kind}) ${result.symbol.name}`,
        description: `${result.symbol.kind} · ${result.symbol.scope}`,
        detail: `${result.symbol.file}:${result.symbol.location.startLine} (Score: ${Math.round(result.score * 100)}%)`,
        symbol: result.symbol
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Found ${results.length} symbols`,
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (selected) {
        const doc = await vscode.workspace.openTextDocument(selected.symbol.file);
        const editor = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(selected.symbol.location.startLine, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    }),

    vscode.commands.registerCommand('codepulse.rebuildIndex', async () => {
      const answer = await vscode.window.showWarningMessage(
        'Rebuild the entire symbol index? This may take a few moments.',
        'Yes', 'No'
      );

      if (answer !== 'Yes') return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'CodePulse: Rebuilding Symbol Index',
          cancellable: false
        },
        async (progress) => {
          symbolIndexManager.onProgress((indexProgress) => {
            progress.report({
              increment: (1 / indexProgress.total) * 100,
              message: `${indexProgress.current}/${indexProgress.total} files`
            });
          });

          await symbolIndexManager.buildIndex(workspaceRoot);

          // Export cache for MCP server
          const cachePath = path.join(workspaceRoot, '.codepulse', 'index.cache.json');
          await symbolIndexManager.exportCache(cachePath);

          const stats = symbolIndexManager.getStats();
          vscode.window.showInformationMessage(
            `Index rebuilt: ${stats.totalSymbols} symbols in ${stats.totalFiles} files`
          );
        }
      );
    }),

    vscode.commands.registerCommand('codepulse.showIndexStats', () => {
      const stats = symbolIndexManager.getStats();
      const aiStats = aiContextProvider.getStats();
      const watcherStats = indexWatcher.getStats();

      const message = [
        '# Symbol Index Statistics',
        '',
        `**Total Symbols:** ${stats.totalSymbols}`,
        `**Total Files:** ${stats.totalFiles}`,
        `**Exported:** ${stats.exportedCount}`,
        `**Local:** ${stats.localCount}`,
        '',
        '## By Kind',
        ...Object.entries(stats.byKind).map(([kind, count]) => `- ${kind}: ${count}`),
        '',
        '## AI Context Provider',
        `**Total Queries:** ${aiStats.totalQueries}`,
        `**Cache Hits:** ${aiStats.cacheHits} (${Math.round(aiStats.cacheHitRate * 100)}%)`,
        '',
        '## Index Watcher',
        `**Queue Size:** ${watcherStats.queueSize}`,
        `**Processing:** ${watcherStats.isProcessing ? 'Yes' : 'No'}`
      ].join('\n');

      vscode.window.showInformationMessage('Symbol Index Stats', 'View Details').then((action) => {
        if (action === 'View Details') {
          vscode.workspace.openTextDocument({
            content: message,
            language: 'markdown'
          }).then((doc) => {
            vscode.window.showTextDocument(doc, { preview: true });
          });
        }
      });
    }),

    vscode.commands.registerCommand('codepulse.getSymbolContext', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const position = editor.selection.active;
      const symbols = symbolIndexManager.getSymbolsInFile(editor.document.uri.fsPath);

      // Find symbol at cursor position
      const symbolAtCursor = symbols.find(
        (s) =>
          s.location.startLine <= position.line &&
          s.location.endLine >= position.line
      );

      if (!symbolAtCursor) {
        vscode.window.showInformationMessage('No symbol found at cursor');
        return;
      }

      const context = await aiContextProvider.getContextForSymbol(symbolAtCursor.id);
      const formatted = aiContextProvider.formatContextForAI(context);

      // Show in new document
      const doc = await vscode.workspace.openTextDocument({
        content: formatted,
        language: 'markdown'
      });

      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: true
      });
    })
  );
}

function registerFileWatchers(context: vscode.ExtensionContext, workspaceRoot: string): void {
  const debouncedAnalyze = debounce(
    (filePath: string) => analyzeFile(filePath, workspaceRoot),
    configManager.getConfig().debounceDelay
  );

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx}');

  watcher.onDidChange((uri) => {
    if (configManager.shouldAnalyzeFile(uri.fsPath)) debouncedAnalyze(uri.fsPath);
  });

  watcher.onDidCreate((uri) => {
    if (configManager.shouldAnalyzeFile(uri.fsPath)) debouncedAnalyze(uri.fsPath);
  });

  watcher.onDidDelete((uri) => {
    stateManager.clearFile(uri.fsPath);
    diagnosticManager.clearFile(uri.fsPath);
  });

  context.subscriptions.push(watcher);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (configManager.shouldAnalyzeFile(doc.uri.fsPath)) debouncedAnalyze(doc.uri.fsPath);
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && configManager.shouldAnalyzeFile(editor.document.uri.fsPath)) {
        if (!stateManager.hasFileResult(editor.document.uri.fsPath)) {
          debouncedAnalyze(editor.document.uri.fsPath);
        }
      }
    })
  );
}

async function analyzeFile(filePath: string, _workspaceRoot: string): Promise<void> {
  try {
    stateManager.setAnalyzing(filePath, true);
    const result = await analysisEngine.analyzeFile(filePath);
    stateManager.setFileResult(filePath, result);
  } catch (error) {
    logger.error(`Analysis failed: ${filePath}`, error);
    stateManager.reportAnalysisError(
      filePath,
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    stateManager.setAnalyzing(filePath, false);
  }
}

async function analyzeOpenFiles(workspaceRoot: string): Promise<void> {
  for (const editor of vscode.window.visibleTextEditors) {
    if (configManager.shouldAnalyzeFile(editor.document.uri.fsPath)) {
      await analyzeFile(editor.document.uri.fsPath, workspaceRoot);
    }
  }
}

async function analyzeWorkspace(workspaceRoot: string): Promise<void> {
  const config = configManager.getConfig();

  // Add additional common exclusions beyond the config
  const extraExcludes = [
    '**/.next/**',
    '**/.turbo/**',
    '**/build/**',
    '**/out/**',
    '**/.cache/**',
    '**/coverage/**',
    '**/.vscode-test/**',
    '**/vendor/**'
  ];

  const allExcludes = [...config.excludePatterns, ...extraExcludes];

  const files = await vscode.workspace.findFiles(
    `{${config.includePatterns.join(',')}}`,
    `{${allExcludes.join(',')}}`
  );

  logger.info(`Found ${files.length} files to analyze`);

  // Warn if too many files
  if (files.length > 5000) {
    const answer = await vscode.window.showWarningMessage(
      `Found ${files.length} files to analyze. This may take a while. Continue?`,
      'Yes', 'No'
    );
    if (answer !== 'Yes') return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'CodePulse: Analyzing',
      cancellable: true
    },
    async (progress, token) => {
      let done = 0;
      const updateInterval = Math.max(1, Math.floor(files.length / 100)); // Update max 100 times

      for (const file of files) {
        if (token.isCancellationRequested) {
          logger.info(`Analysis cancelled at ${done}/${files.length} files`);
          break;
        }

        await analyzeFile(file.fsPath, workspaceRoot);
        done++;

        // Update progress less frequently for large file sets
        if (done % updateInterval === 0 || done === files.length) {
          const percentage = (done / files.length) * 100;
          progress.report({
            increment: (updateInterval / files.length) * 100,
            message: `${done}/${files.length} (${percentage.toFixed(1)}%)`
          });
        }
      }
    }
  );

  vscode.window.showInformationMessage(`Analyzed ${files.length} files`);
}

/**
 * Setup MCP server configuration automatically in the workspace.
 * Creates .mcp.json that registers the CodePulse MCP server.
 */
export function deactivate(): void {
  logger?.info('CodePulse deactivating');

  // Clean up index system
  indexWatcher?.stop();
  symbolIndexManager?.clear();
  aiContextProvider?.clearCache();

  // Clean up UI
  decorationManager?.dispose();
  diagnosticManager?.dispose();
  statusBarManager?.dispose();

  // Clean up core
  configManager?.dispose();
  stateManager?.clear();
  cacheManager?.clear();

  Logger.dispose();
}

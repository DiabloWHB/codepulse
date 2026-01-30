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
import { Logger } from './utils/logger';
import { debounce } from './utils/debounce';
import { isSupportedFile } from './utils/paths';
import { FileAnalysisResult } from './types';

let stateManager: StateManager;
let configManager: ConfigManager;
let cacheManager: CacheManager<FileAnalysisResult>;
let analysisEngine: AnalysisEngine;
let decorationManager: DecorationManager;
let diagnosticManager: DiagnosticManager;
let statusBarManager: StatusBarManager;
let logger: Logger;

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

export function deactivate(): void {
  logger?.info('CodePulse deactivating');
  decorationManager?.dispose();
  diagnosticManager?.dispose();
  statusBarManager?.dispose();
  configManager?.dispose();
  stateManager?.clear();
  cacheManager?.clear();
  Logger.dispose();
}

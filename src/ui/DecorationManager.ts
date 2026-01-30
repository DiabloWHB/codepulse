import * as vscode from 'vscode';
import { StateManager } from '../core/StateManager';
import { HealthStatus, getHealthIcon, FunctionInfo } from '../types';

/**
 * Get relative path from workspace root for better AI readability.
 */
function getRelativePath(absolutePath: string): string {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return absolutePath.split(/[\\/]/).pop() || absolutePath;
  }
  const workspaceRoot = workspaceFolder.uri.fsPath;
  if (absolutePath.startsWith(workspaceRoot)) {
    return absolutePath.substring(workspaceRoot.length + 1).replace(/\\/g, '/');
  }
  return absolutePath;
}

export class DecorationManager {
  private readonly stateManager: StateManager;
  private readonly decorationTypes: Map<HealthStatus, vscode.TextEditorDecorationType>;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.decorationTypes = this.createDecorationTypes();
    this.setupEventListeners();
  }

  private createDecorationTypes(): Map<HealthStatus, vscode.TextEditorDecorationType> {
    const types = new Map<HealthStatus, vscode.TextEditorDecorationType>();

    types.set(
      HealthStatus.HEALTHY,
      vscode.window.createTextEditorDecorationType({
        gutterIconSize: 'contain',
        after: { contentText: ' 🟢', margin: '0 0 0 1em' },
        isWholeLine: true
      })
    );

    types.set(
      HealthStatus.WARNING,
      vscode.window.createTextEditorDecorationType({
        gutterIconSize: 'contain',
        after: { contentText: ' 🟡', margin: '0 0 0 1em' },
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        isWholeLine: true
      })
    );

    types.set(
      HealthStatus.ERROR,
      vscode.window.createTextEditorDecorationType({
        gutterIconSize: 'contain',
        after: { contentText: ' 🔴', margin: '0 0 0 1em' },
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        isWholeLine: true
      })
    );

    return types;
  }

  private setupEventListeners(): void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.updateDecorations(editor);
      })
    );

    this.stateManager.events.on('analysis:completed', ({ file }) => {
      const editor = vscode.window.visibleTextEditors.find(
        (e) => e.document.uri.fsPath === file
      );
      if (editor) this.updateDecorations(editor);
    });
  }

  public updateDecorations(editor: vscode.TextEditor): void {
    const filePath = editor.document.uri.fsPath;
    const functions = this.stateManager.getFunctionsByFile(filePath);

    for (const type of this.decorationTypes.values()) {
      editor.setDecorations(type, []);
    }

    const byHealth = new Map<HealthStatus, vscode.DecorationOptions[]>();
    for (const status of [HealthStatus.HEALTHY, HealthStatus.WARNING, HealthStatus.ERROR]) {
      byHealth.set(status, []);
    }

    for (const fn of functions) {
      const decorations = byHealth.get(fn.health);
      if (!decorations) continue;

      const range = new vscode.Range(fn.location.startLine, 0, fn.location.startLine, 0);
      const hoverMessage = this.createHoverMessage(fn);
      decorations.push({ range, hoverMessage });
    }

    for (const [status, decorations] of byHealth) {
      const type = this.decorationTypes.get(status);
      if (type) editor.setDecorations(type, decorations);
    }
  }

  private createHoverMessage(fn: FunctionInfo): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;

    md.appendMarkdown(`### ${getHealthIcon(fn.health)} \`${fn.name}\`\n\n`);

    // Add AI-specific warning if there are issues
    if (fn.issues.length > 0) {
      md.appendMarkdown(`> ⚠️ **AI Alert**: This function has ${fn.issues.length} issue(s) that should be addressed before modification.\n\n`);

      md.appendMarkdown(`**Issues:**\n`);
      for (const issue of fn.issues.slice(0, 5)) {
        const icon = issue.severity === 0 ? '🔴' : issue.severity === 1 ? '🟡' : 'ℹ️';
        md.appendMarkdown(`- ${icon} ${issue.message}\n`);
        if (issue.fix?.description) {
          md.appendMarkdown(`  *Fix: ${issue.fix.description}*\n`);
        }
      }
      if (fn.issues.length > 5) {
        md.appendMarkdown(`- _...and ${fn.issues.length - 5} more issues_\n`);
      }
    }

    // Impact Analysis - the core feature!
    const impact = this.stateManager.getImpact(fn.id);
    if (impact && impact.totalAffected > 0) {
      md.appendMarkdown(`\n---\n`);
      md.appendMarkdown(`**⚡ Impact Analysis:**\n`);
      md.appendMarkdown(`- **${impact.directImpact.length}** functions call this directly\n`);
      md.appendMarkdown(`- **${impact.totalAffected}** total affected if changed\n`);

      if (impact.directImpact.length > 0) {
        md.appendMarkdown(`\n**Direct Callers:**\n`);
        for (const caller of impact.directImpact.slice(0, 3)) {
          const relativePath = getRelativePath(caller.node.file);
          md.appendMarkdown(`- \`${caller.node.name}\` in \`${relativePath}:${caller.node.line}\`\n`);
        }
        if (impact.directImpact.length > 3) {
          md.appendMarkdown(`- _...and ${impact.directImpact.length - 3} more callers_\n`);
        }

        md.appendMarkdown(`\n*💡 Click the CodeLens above to see full impact report for AI*\n`);
      }
    } else if (fn.health === HealthStatus.HEALTHY) {
      md.appendMarkdown(`\n✅ **Safe to modify** - No other functions depend on this.\n`);
    }

    return md;
  }

  public dispose(): void {
    for (const type of this.decorationTypes.values()) type.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

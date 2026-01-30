import * as vscode from 'vscode';
import { StateManager } from '../core/StateManager';

/**
 * Get relative path from workspace root for better AI readability.
 * Examples: "src/app/suppliers/[id]/page.tsx" instead of just "page.tsx"
 */
function getRelativePath(absolutePath: string): string {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    // Fallback to filename if no workspace
    return absolutePath.split(/[\\/]/).pop() || absolutePath;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  if (absolutePath.startsWith(workspaceRoot)) {
    return absolutePath.substring(workspaceRoot.length + 1).replace(/\\/g, '/');
  }

  return absolutePath;
}

/**
 * Provides CodeLens hints above functions showing their impact/dependencies.
 * This helps AI understand what will break when changing code!
 */
export class ImpactCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor(private readonly stateManager: StateManager) {
    // Refresh CodeLens when graph is rebuilt
    stateManager.events.on('graph:built', () => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const filePath = document.uri.fsPath;

    // Get functions in this file
    const functions = this.stateManager.getFunctionsByFile(filePath);
    if (functions.length === 0) {
      return codeLenses;
    }

    for (const fn of functions) {
      const impact = this.stateManager.getImpact(fn.id);

      // Create a range at the start of the function
      const range = new vscode.Range(
        fn.location.startLine,
        0,
        fn.location.startLine,
        0
      );

      if (impact && impact.totalAffected > 0) {
        // Function has dependencies - show warning
        const riskLevel = this.calculateRiskLevel(impact.totalAffected);
        const icon = this.getRiskIcon(riskLevel);

        const title = `${icon} ${impact.totalAffected} caller${impact.totalAffected > 1 ? 's' : ''} | ${riskLevel} Risk`;

        codeLenses.push(
          new vscode.CodeLens(range, {
            title,
            tooltip: `This function is called by ${impact.totalAffected} other functions. Changes here will affect them!`,
            command: 'codepulse.showImpactDetails',
            arguments: [fn.id]
          })
        );
      } else {
        // No dependencies - safe to modify
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: '✅ No callers | Safe to modify',
            tooltip: 'This function is not called by any other functions in the codebase.',
            command: ''
          })
        );
      }
    }

    return codeLenses;
  }

  private calculateRiskLevel(affectedCount: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (affectedCount > 25) return 'Critical';
    if (affectedCount > 10) return 'High';
    if (affectedCount > 3) return 'Medium';
    return 'Low';
  }

  private getRiskIcon(level: 'Low' | 'Medium' | 'High' | 'Critical'): string {
    switch (level) {
      case 'Low': return '🟢';
      case 'Medium': return '🟡';
      case 'High': return '🟠';
      case 'Critical': return '🔴';
    }
  }
}

/**
 * Register the Impact CodeLens provider
 */
export function registerImpactCodeLens(
  context: vscode.ExtensionContext,
  stateManager: StateManager
): void {
  const provider = new ImpactCodeLensProvider(stateManager);

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'javascriptreact' }
      ],
      provider
    )
  );

  // Command to show detailed impact analysis
  context.subscriptions.push(
    vscode.commands.registerCommand('codepulse.showImpactDetails', async (functionId: string) => {
      const fn = stateManager.getFunctionById(functionId);
      if (!fn) return;

      const impact = stateManager.getImpact(functionId);
      if (!impact) return;

      // Build detailed markdown report
      const report = buildImpactReport(fn.name, impact);

      // Copy to clipboard for AI
      await vscode.env.clipboard.writeText(report);

      // Show in new document
      const doc = await vscode.workspace.openTextDocument({
        content: report,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { preview: true });

      vscode.window.showInformationMessage(
        `Impact analysis copied to clipboard! Paste it to AI for context.`,
        'OK'
      );
    })
  );
}

/**
 * Build a detailed impact report in markdown format
 */
function buildImpactReport(functionName: string, impact: any): string {
  const riskLevel = impact.totalAffected > 25 ? 'CRITICAL'
    : impact.totalAffected > 10 ? 'HIGH'
    : impact.totalAffected > 3 ? 'MEDIUM' : 'LOW';

  let report = `# ⚠️ Impact Analysis: \`${functionName}\`\n\n`;
  report += `**Risk Level:** ${riskLevel}\n`;
  report += `**Total Affected Functions:** ${impact.totalAffected}\n\n`;

  report += `## 🚨 Important Notice for AI\n\n`;
  report += `Before modifying \`${functionName}\`, be aware that **${impact.totalAffected} other functions depend on it**.\n\n`;
  report += `Any changes to this function's signature, behavior, or return value will affect all callers listed below.\n\n`;

  if (impact.directImpact.length > 0) {
    report += `## 📞 Direct Callers (${impact.directImpact.length})\n\n`;
    report += `These functions call \`${functionName}\` directly and will break immediately if its interface changes:\n\n`;

    for (const imp of impact.directImpact.slice(0, 20)) {
      const relativePath = getRelativePath(imp.node.file);
      report += `- **\`${imp.node.name}\`** in \`${relativePath}:${imp.node.line}\`\n`;
    }

    if (impact.directImpact.length > 20) {
      report += `\n... and ${impact.directImpact.length - 20} more\n`;
    }
    report += `\n`;
  }

  if (impact.indirectImpact.length > 0) {
    report += `## 🔗 Indirect Impact (${impact.indirectImpact.length})\n\n`;
    report += `These functions are affected through the call chain:\n\n`;

    for (const imp of impact.indirectImpact.slice(0, 15)) {
      const relativePath = getRelativePath(imp.node.file);
      report += `- **\`${imp.node.name}\`** in \`${relativePath}:${imp.node.line}\` (depth: ${imp.depth})\n`;
    }

    if (impact.indirectImpact.length > 15) {
      report += `\n... and ${impact.indirectImpact.length - 15} more\n`;
    }
    report += `\n`;
  }

  report += `## ✅ Recommended Actions\n\n`;
  report += `1. **Review all callers** before making changes\n`;
  report += `2. **Maintain backward compatibility** if possible\n`;
  report += `3. **Update all affected functions** if breaking changes are necessary\n`;
  report += `4. **Add tests** to ensure nothing breaks\n\n`;

  report += `---\n\n`;
  report += `*Generated by CodePulse - AI-Aware Dependency Tracker*\n`;

  return report;
}

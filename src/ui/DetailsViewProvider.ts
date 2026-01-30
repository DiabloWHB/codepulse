import * as vscode from 'vscode';
import { StateManager } from '../core/StateManager';
import { FunctionInfo } from '../types';

interface DetailsItem {
  type: 'header' | 'issue' | 'dependency' | 'action' | 'function-ref';
  label: string;
  description?: string;
  tooltip?: string;
  command?: { command: string; title: string; arguments?: any[] };
  iconPath?: vscode.ThemeIcon;
  // For tracking which section this belongs to
  parentSection?: string;
}

/**
 * Details View - Shows information about the SELECTED function ONLY
 * IMPORTANT: Only loads data when explicitly requested via showFunctionDetails()
 */
export class DetailsViewProvider implements vscode.TreeDataProvider<DetailsItem> {
  private readonly stateManager: StateManager;
  private _onDidChangeTreeData = new vscode.EventEmitter<DetailsItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // The CURRENTLY SELECTED function - starts as null
  private currentFunction: FunctionInfo | null = null;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Show details for a specific function - THIS IS THE ENTRY POINT
   */
  public showFunctionDetails(functionId: string): void {
    const fn = this.stateManager.getFunctionById(functionId);
    if (fn) {
      this.currentFunction = fn;
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  /**
   * Clear the details view
   */
  public clear(): void {
    this.currentFunction = null;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: DetailsItem): vscode.TreeItem {
    let collapsibleState = vscode.TreeItemCollapsibleState.None;

    // Make headers and dependencies expandable
    if (element.type === 'header' || element.type === 'dependency') {
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }

    const item = new vscode.TreeItem(element.label, collapsibleState);

    item.description = element.description;
    item.tooltip = element.tooltip;
    item.command = element.command;
    item.iconPath = element.iconPath;

    // Store the element type for later use
    item.contextValue = element.type;

    return item;
  }

  getParent(_element: DetailsItem): DetailsItem | undefined {
    // For reveal() to work, we need to implement getParent
    // Since our tree is mostly flat, we return undefined for simplicity
    return undefined;
  }

  getChildren(element?: DetailsItem): DetailsItem[] {
    // If no function is selected, show "No selection"
    if (!this.currentFunction) {
      return [
        {
          type: 'header',
          label: 'No function selected',
          description: 'Click on a function in Health Status or Impact Analysis',
          iconPath: new vscode.ThemeIcon('info')
        }
      ];
    }

    // Root level - show sections for the CURRENT function only
    if (!element) {
      const items: DetailsItem[] = [];

      // Function info
      const fileName = this.currentFunction.file.split(/[\\\\/]/).pop() || '';
      items.push({
        type: 'header',
        label: `📋 ${this.currentFunction.name}`,
        description: `${fileName}:${this.currentFunction.location.startLine}`,
        tooltip: this.currentFunction.file
      });

      // Issues section
      if (this.currentFunction.issues.length > 0) {
        items.push({
          type: 'header',
          label: `🔴 Issues (${this.currentFunction.issues.length})`,
          description: 'Click to expand'
        });
      }

      // Impact section - NOT calculated until clicked
      items.push({
        type: 'header',
        label: `⚡ Impact Analysis`,
        description: 'Click to calculate'
      });

      // Actions
      items.push({
        type: 'header',
        label: '🛠️ Actions',
        description: 'Quick actions'
      });

      return items;
    }

    // Expanding Issues section
    if (element.label.startsWith('🔴 Issues')) {
      if (!this.currentFunction) return [];

      return this.currentFunction.issues.slice(0, 20).map((issue) => {
        const severityName = ['ERROR', 'WARNING', 'INFO', 'HINT'][issue.severity] || 'INFO';
        const iconName = issue.severity === 0 ? 'error' : issue.severity === 1 ? 'warning' : 'info';

        return {
          type: 'issue' as const,
          label: issue.message.substring(0, 80),
          description: severityName,
          tooltip: `${issue.category}: ${issue.message}\n\nLine ${issue.location.startLine}`,
          iconPath: new vscode.ThemeIcon(iconName),
          command: {
            command: 'codepulse.goToFunction',
            title: 'Go to issue',
            arguments: [{ file: this.currentFunction!.file, location: issue.location }]
          }
        };
      });
    }

    // Expanding Impact section - Calculate ONLY when clicked
    if (element.label.startsWith('⚡ Impact')) {
      if (!this.currentFunction) return [];

      const impact = this.stateManager.getImpact(this.currentFunction.id);
      if (!impact || impact.totalAffected === 0) {
        return [{
          type: 'header',
          label: '✅ No Dependencies',
          description: 'Safe to modify',
          tooltip: 'This function is not called by other functions - changes have minimal risk'
        }];
      }

      const items: DetailsItem[] = [];

      // Calculate risk level based on total affected
      const total = impact.totalAffected;
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (total > 25) riskLevel = 'critical';
      else if (total > 10) riskLevel = 'high';
      else if (total > 3) riskLevel = 'medium';

      const riskEmoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
      const riskLabels = {
        low: 'Low Risk',
        medium: 'Medium Risk',
        high: 'High Risk',
        critical: 'Critical Risk'
      };

      items.push({
        type: 'header',
        label: `${riskEmoji[riskLevel]} ${riskLabels[riskLevel]}`,
        description: `${impact.totalAffected} functions will be affected`,
        tooltip: impact.summary
      });

      // Direct impact - show actual functions
      if (impact.directImpact.length > 0) {
        items.push({
          type: 'dependency',
          label: `📞 Direct Callers (${impact.directImpact.length})`,
          description: 'Click to see list',
          tooltip: 'Functions that directly call this function',
          parentSection: 'direct'
        });
      }

      // Indirect impact - show actual functions
      if (impact.indirectImpact.length > 0) {
        items.push({
          type: 'dependency',
          label: `🔗 Indirect Impact (${impact.indirectImpact.length})`,
          description: 'Click to see list',
          tooltip: 'Functions affected through the call chain',
          parentSection: 'indirect'
        });
      }

      return items;
    }

    // Expanding Direct Impact list
    if (element.parentSection === 'direct') {
      if (!this.currentFunction) return [];

      const impact = this.stateManager.getImpact(this.currentFunction.id);
      if (!impact) return [];

      return impact.directImpact.slice(0, 50).map((impactedFn) => {
        const fileName = impactedFn.node.file.split(/[\\\\/]/).pop() || '';
        return {
          type: 'function-ref' as const,
          label: `→ ${impactedFn.node.name}`,
          description: `${fileName}:${impactedFn.node.line}`,
          tooltip: `Jump to ${impactedFn.node.name} in ${impactedFn.node.file}`,
          iconPath: new vscode.ThemeIcon('symbol-method'),
          command: {
            command: 'codepulse.goToFunction',
            title: 'Go',
            arguments: [{ file: impactedFn.node.file, location: { startLine: impactedFn.node.line } }]
          }
        };
      });
    }

    // Expanding Indirect Impact list
    if (element.parentSection === 'indirect') {
      if (!this.currentFunction) return [];

      const impact = this.stateManager.getImpact(this.currentFunction.id);
      if (!impact) return [];

      return impact.indirectImpact.slice(0, 50).map((impactedFn) => {
        const fileName = impactedFn.node.file.split(/[\\\\/]/).pop() || '';
        return {
          type: 'function-ref' as const,
          label: `⟿ ${impactedFn.node.name}`,
          description: `${fileName}:${impactedFn.node.line}`,
          tooltip: `Jump to ${impactedFn.node.name} in ${impactedFn.node.file}`,
          iconPath: new vscode.ThemeIcon('symbol-method'),
          command: {
            command: 'codepulse.goToFunction',
            title: 'Go',
            arguments: [{ file: impactedFn.node.file, location: { startLine: impactedFn.node.line } }]
          }
        };
      });
    }

    // Expanding Actions section
    if (element.label.startsWith('🛠️ Actions')) {
      if (!this.currentFunction) return [];

      const items: DetailsItem[] = [];

      // Go to function
      items.push({
        type: 'action',
        label: '📍 Go to Source Code',
        description: 'Jump to function definition',
        iconPath: new vscode.ThemeIcon('go-to-file'),
        command: {
          command: 'codepulse.goToFunction',
          title: 'Go',
          arguments: [this.currentFunction]
        }
      });

      // Fix with AI - only if there are issues
      if (this.currentFunction.issues.length > 0) {
        items.push({
          type: 'action',
          label: '🤖 Fix with AI Assistant',
          description: 'Open AI chat with full context',
          iconPath: new vscode.ThemeIcon('sparkle'),
          command: {
            command: 'codepulse.fixWithAI',
            title: 'Fix with AI',
            arguments: [this.currentFunction]
          }
        });
      }

      // Ignore button
      if (this.currentFunction.issues.length > 0) {
        items.push({
          type: 'action',
          label: '🙈 Ignore Issues',
          description: 'Add to ignore list',
          iconPath: new vscode.ThemeIcon('eye-closed'),
          command: {
            command: 'codepulse.ignoreIssue',
            title: 'Ignore',
            arguments: [this.currentFunction]
          }
        });
      }

      return items;
    }

    return [];
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

export function registerDetailsView(
  context: vscode.ExtensionContext,
  stateManager: StateManager
): DetailsViewProvider {
  const provider = new DetailsViewProvider(stateManager);

  const treeView = vscode.window.createTreeView('codepulse.detailsView', {
    treeDataProvider: provider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);

  // Command to show function details - THIS IS CALLED FROM OTHER VIEWS
  context.subscriptions.push(
    vscode.commands.registerCommand('codepulse.showDetails', (functionId: string) => {
      provider.showFunctionDetails(functionId);
      // Just refresh the view - no need to reveal since the view updates automatically
    })
  );

  // Fix with AI command
  context.subscriptions.push(
    vscode.commands.registerCommand('codepulse.fixWithAI', async (fn: FunctionInfo) => {
      // Build context for AI
      const impact = stateManager.getImpact(fn.id);
      const issueText = fn.issues.map(i => `- ${i.category}: ${i.message}`).join('\n');

      // Calculate risk level
      const total = impact?.totalAffected || 0;
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (total > 25) riskLevel = 'CRITICAL';
      else if (total > 10) riskLevel = 'HIGH';
      else if (total > 3) riskLevel = 'MEDIUM';

      // Build list of affected functions
      let affectedFunctionsList = '';
      if (impact && impact.totalAffected > 0) {
        affectedFunctionsList += '\n**⚠️ AFFECTED FUNCTIONS - MUST NOT BE BROKEN:**\n\n';

        if (impact.directImpact.length > 0) {
          affectedFunctionsList += '**Direct Callers (will break immediately if this function changes):**\n';
          impact.directImpact.slice(0, 10).forEach((impacted) => {
            const file = impacted.node.file.split(/[\\\\/]/).pop() || impacted.node.file;
            affectedFunctionsList += `- \`${impacted.node.name}\` in ${file}:${impacted.node.line}\n`;
          });
          if (impact.directImpact.length > 10) {
            affectedFunctionsList += `- ... and ${impact.directImpact.length - 10} more\n`;
          }
          affectedFunctionsList += '\n';
        }

        if (impact.indirectImpact.length > 0) {
          affectedFunctionsList += '**Indirect Impact (affected through call chain):**\n';
          impact.indirectImpact.slice(0, 10).forEach((impacted) => {
            const file = impacted.node.file.split(/[\\\\/]/).pop() || impacted.node.file;
            affectedFunctionsList += `- \`${impacted.node.name}\` in ${file}:${impacted.node.line}\n`;
          });
          if (impact.indirectImpact.length > 10) {
            affectedFunctionsList += `- ... and ${impact.indirectImpact.length - 10} more\n`;
          }
          affectedFunctionsList += '\n';
        }

        // List affected files
        if (impact.affectedFiles.length > 0) {
          affectedFunctionsList += '**Files that will need review after changes:**\n';
          impact.affectedFiles.slice(0, 15).forEach((file) => {
            const fileName = file.split(/[\\\\/]/).pop() || file;
            affectedFunctionsList += `- ${fileName}\n`;
          });
          if (impact.affectedFiles.length > 15) {
            affectedFunctionsList += `- ... and ${impact.affectedFiles.length - 15} more files\n`;
          }
        }
      }

      // Create a detailed prompt for the AI
      const prompt = `I need help fixing issues in my code:

**File:** ${fn.file}
**Function:** ${fn.name} (line ${fn.location.startLine})

**Issues Found:**
${issueText}

**Impact Analysis:**
- Total affected functions: ${impact?.totalAffected || 0}
- Direct callers: ${impact?.directImpact.length || 0}
- Indirect impact: ${impact?.indirectImpact.length || 0}
- Risk Level: **${riskLevel}**
${affectedFunctionsList}

**IMPORTANT INSTRUCTIONS FOR AI:**
1. Fix the issues listed above
2. Ensure that any changes maintain backward compatibility with the affected functions
3. If you need to change the function signature or behavior, provide migration instructions
4. Test your solution mentally against the direct callers to ensure nothing breaks
5. If breaking changes are unavoidable, clearly mark them and explain why

Please help me fix these issues while being mindful of the dependencies.`;

      // Copy to clipboard and show message
      await vscode.env.clipboard.writeText(prompt);
      const result = await vscode.window.showInformationMessage(
        'AI context copied to clipboard! Paste it into your AI assistant (Claude, Copilot, etc.)',
        'Open File'
      );

      if (result === 'Open File') {
        const doc = await vscode.workspace.openTextDocument(fn.file);
        const editor = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(fn.location.startLine - 1, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    })
  );

  // Ignore issue command
  context.subscriptions.push(
    vscode.commands.registerCommand('codepulse.ignoreIssue', async (fn: FunctionInfo) => {
      const result = await vscode.window.showInformationMessage(
        `Ignore ${fn.issues.length} issue(s) in ${fn.name}?`,
        'Yes', 'No'
      );

      if (result === 'Yes') {
        vscode.window.showInformationMessage('Issue ignore functionality coming soon! Will add to .codepulseignore file.');
        // TODO: Add to ignore list in configuration
      }
    })
  );

  return provider;
}

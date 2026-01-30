import * as vscode from 'vscode';
import { StateManager } from '../core/StateManager';
import { FunctionInfo, Issue } from '../types';

interface DetailsItem {
  type: 'header' | 'issue' | 'dependency' | 'action';
  label: string;
  description?: string;
  tooltip?: string;
  command?: { command: string; title: string; arguments?: any[] };
  iconPath?: vscode.ThemeIcon;
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
    const item = new vscode.TreeItem(
      element.label,
      element.type === 'header' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    item.description = element.description;
    item.tooltip = element.tooltip;
    item.command = element.command;
    item.iconPath = element.iconPath;

    return item;
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
      const fileName = this.currentFunction.file.split(/[\\/]/).pop() || '';
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
            arguments: [{ file: this.currentFunction.file, location: issue.location }]
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
          label: 'No dependencies found',
          description: 'This function is not called by others'
        }];
      }

      const items: DetailsItem[] = [];

      // Direct impact - limited to 10
      if (impact.directImpact.length > 0) {
        items.push({
          type: 'dependency',
          label: `Direct: ${Math.min(impact.directImpact.length, 10)} functions`,
          description: 'Functions that directly call this'
        });
      }

      // Indirect impact - limited to 10
      if (impact.indirectImpact.length > 0) {
        items.push({
          type: 'dependency',
          label: `Indirect: ${Math.min(impact.indirectImpact.length, 10)} functions`,
          description: 'Functions affected through call chain'
        });
      }

      return items;
    }

    // Expanding Actions section
    if (element.label.startsWith('🛠️ Actions')) {
      if (!this.currentFunction) return [];

      const items: DetailsItem[] = [];

      // Go to function
      items.push({
        type: 'action',
        label: '📍 Go to Function',
        description: 'Jump to source code',
        iconPath: new vscode.ThemeIcon('go-to-file'),
        command: {
          command: 'codepulse.goToFunction',
          title: 'Go',
          arguments: [this.currentFunction]
        }
      });

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
      treeView.reveal(provider as any, { select: true, focus: true });
    })
  );

  return provider;
}

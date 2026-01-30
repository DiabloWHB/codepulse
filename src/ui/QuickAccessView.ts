import * as vscode from 'vscode';
import { StateManager } from '../core/StateManager';

type QuickAccessItem = {
  type: 'command';
  id: string;
  label: string;
  icon: string;
  description: string;
  command: string;
};

/**
 * Quick Access View - Shows all available commands as clickable items
 */
export class QuickAccessProvider implements vscode.TreeDataProvider<QuickAccessItem> {
  private readonly stateManager: StateManager;
  private _onDidChangeTreeData = new vscode.EventEmitter<QuickAccessItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  getTreeItem(element: QuickAccessItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = element.description;
    item.iconPath = new vscode.ThemeIcon(element.icon);
    item.command = {
      command: element.command,
      title: element.label
    };
    item.tooltip = `Click to ${element.description.toLowerCase()}`;
    return item;
  }

  getChildren(): QuickAccessItem[] {
    const summary = this.stateManager.getSummary();

    return [
      // === Symbol Index Actions ===
      {
        type: 'command',
        id: 'searchSymbol',
        label: 'Search Symbol',
        icon: 'search',
        description: 'Find functions, classes, variables',
        command: 'codepulse.searchSymbol'
      },
      {
        type: 'command',
        id: 'getSymbolContext',
        label: 'Get Symbol Context',
        icon: 'lightbulb',
        description: 'AI context for current symbol',
        command: 'codepulse.getSymbolContext'
      },
      {
        type: 'command',
        id: 'showIndexStats',
        label: 'Index Statistics',
        icon: 'graph-line',
        description: 'View symbol index stats',
        command: 'codepulse.showIndexStats'
      },

      // === Analysis Actions ===
      {
        type: 'command',
        id: 'analyzeFile',
        label: 'Analyze Current File',
        icon: 'file-code',
        description: 'Scan active file for issues',
        command: 'codepulse.analyzeFile'
      },
      {
        type: 'command',
        id: 'analyzeWorkspace',
        label: 'Analyze Workspace',
        icon: 'folder-opened',
        description: `Scan all ${summary.totalFunctions || '?'} files`,
        command: 'codepulse.analyzeWorkspace'
      },
      {
        type: 'command',
        id: 'showProjectReport',
        label: 'Project Report',
        icon: 'file-text',
        description: `Health: ${summary.totalFunctions > 0 ? Math.round((summary.healthyCount / summary.totalFunctions) * 100) : '?'}%`,
        command: 'codepulse.showProjectReport'
      },

      // === Navigation Actions ===
      {
        type: 'command',
        id: 'showDashboard',
        label: 'Dashboard',
        icon: 'dashboard',
        description: 'Quick overview',
        command: 'codepulse.showDashboard'
      },
      {
        type: 'command',
        id: 'showImpact',
        label: 'Impact Analysis',
        icon: 'graph',
        description: 'See what affects what',
        command: 'codepulse.showImpact'
      },
      {
        type: 'command',
        id: 'showDependencies',
        label: 'Dependencies',
        icon: 'references',
        description: 'View function calls',
        command: 'codepulse.showDependencies'
      },

      // === Utility Actions ===
      {
        type: 'command',
        id: 'rebuildIndex',
        label: 'Rebuild Index',
        icon: 'database',
        description: 'Rebuild symbol index',
        command: 'codepulse.rebuildIndex'
      },
      {
        type: 'command',
        id: 'refresh',
        label: 'Refresh Analysis',
        icon: 'refresh',
        description: 'Re-analyze everything',
        command: 'codepulse.refresh'
      }
    ];
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

export function registerQuickAccessView(
  context: vscode.ExtensionContext,
  stateManager: StateManager
): QuickAccessProvider {
  const provider = new QuickAccessProvider(stateManager);

  context.subscriptions.push(
    vscode.window.createTreeView('codepulse.quickAccessView', {
      treeDataProvider: provider,
      showCollapseAll: false
    })
  );

  // Refresh when workspace is updated
  stateManager.events.on('workspace:updated', () => provider.refresh());

  return provider;
}

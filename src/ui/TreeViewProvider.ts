import * as vscode from 'vscode';
import { StateManager } from '../core/StateManager';
import { HealthStatus, getHealthIcon } from '../types';
import { getShortPath } from '../utils/paths';

type TreeItem = CategoryItem | FileItem | FunctionItem;

interface CategoryItem {
  type: 'category';
  health: HealthStatus;
  count: number;
}

interface FileItem {
  type: 'file';
  filePath: string;
  health: HealthStatus;
  count: number;
}

interface FunctionItem {
  type: 'function';
  id: string;
  name: string;
  file: string;
  line: number;
  health: HealthStatus;
  issueCount: number;
  impactCount: number;
}

export class HealthTreeViewProvider implements vscode.TreeDataProvider<TreeItem> {
  private readonly stateManager: StateManager;
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.stateManager.events.on('workspace:updated', () =>
      this._onDidChangeTreeData.fire(undefined)
    );
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    switch (element.type) {
      case 'category': {
        const label = `${getHealthIcon(element.health)} ${element.health === HealthStatus.ERROR ? 'Errors' : element.health === HealthStatus.WARNING ? 'Warnings' : 'Healthy'} (${element.count})`;
        return new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
      }
      case 'file': {
        const item = new vscode.TreeItem(
          `📄 ${getShortPath(element.filePath)} (${element.count})`,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        item.resourceUri = vscode.Uri.file(element.filePath);
        return item;
      }
      case 'function': {
        let label = `${getHealthIcon(element.health)} ${element.name}`;
        if (element.impactCount > 0) label += ` ⚡${element.impactCount}`;

        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.description = `${element.issueCount} issues`;
        item.tooltip =
          element.impactCount > 0 ? `${element.impactCount} functions depend on this` : undefined;
        item.command = {
          command: 'codepulse.showDetails',
          title: 'Show Details',
          arguments: [element.id]
        };
        return item;
      }
    }
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      const summary = this.stateManager.getSummary();
      const items: CategoryItem[] = [];
      if (summary.errorCount > 0)
        items.push({ type: 'category', health: HealthStatus.ERROR, count: summary.errorCount });
      if (summary.warningCount > 0)
        items.push({ type: 'category', health: HealthStatus.WARNING, count: summary.warningCount });
      if (summary.healthyCount > 0)
        items.push({ type: 'category', health: HealthStatus.HEALTHY, count: summary.healthyCount });
      return items;
    }

    if (element.type === 'category') {
      const files = this.stateManager.getAnalyzedFiles();
      const items: FileItem[] = [];
      for (const filePath of files) {
        const fns = this.stateManager
          .getFunctionsByFile(filePath)
          .filter((f) => f.health === element.health);
        if (fns.length > 0)
          items.push({ type: 'file', filePath, health: element.health, count: fns.length });
      }
      return items;
    }

    if (element.type === 'file') {
      const fns = this.stateManager
        .getFunctionsByFile(element.filePath)
        .filter((f) => f.health === element.health);
      return fns.map((fn) => {
        const impact = this.stateManager.getImpact(fn.id);
        return {
          type: 'function' as const,
          id: fn.id,
          name: fn.name,
          file: fn.file,
          line: fn.location.startLine,
          health: fn.health,
          issueCount: fn.issues.length,
          impactCount: impact?.totalAffected ?? 0
        };
      });
    }

    return [];
  }
}

/**
 * Tree view provider for Impact Analysis.
 * Shows functions grouped by their impact level.
 */
export class ImpactTreeViewProvider implements vscode.TreeDataProvider<TreeItem> {
  private readonly stateManager: StateManager;
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.stateManager.events.on('workspace:updated', () =>
      this._onDidChangeTreeData.fire(undefined)
    );
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    switch (element.type) {
      case 'category': {
        const labels: Record<string, string> = {
          CRITICAL: '🔴 Critical Impact',
          HIGH: '🟠 High Impact',
          MEDIUM: '🟡 Medium Impact',
          LOW: '🟢 Low Impact'
        };
        const label = `${labels[element.health] || element.health} (${element.count})`;
        return new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
      }
      case 'file': {
        const item = new vscode.TreeItem(
          `📄 ${getShortPath(element.filePath)} (${element.count})`,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        item.resourceUri = vscode.Uri.file(element.filePath);
        return item;
      }
      case 'function': {
        const item = new vscode.TreeItem(
          `⚡ ${element.name}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = element.impactCount > 0
          ? `affects ${element.impactCount} function${element.impactCount !== 1 ? 's' : ''}`
          : 'no dependencies';
        item.tooltip = element.impactCount > 0
          ? `${element.impactCount} functions will be affected if this changes`
          : 'This function is not called by others';
        item.command = {
          command: 'codepulse.showDetails',
          title: 'Show Details',
          arguments: [element.id]
        };
        return item;
      }
    }
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      // Root level: show impact categories
      const allFunctions = this.stateManager.getAllFunctions();
      const categories = new Map<string, number>();

      for (const fn of allFunctions) {
        const impact = this.stateManager.getImpact(fn.id);
        if (!impact) continue;

        let level = 'LOW';
        if (impact.totalAffected >= 10) level = 'CRITICAL';
        else if (impact.totalAffected >= 5) level = 'HIGH';
        else if (impact.totalAffected >= 2) level = 'MEDIUM';

        categories.set(level, (categories.get(level) || 0) + 1);
      }

      const items: CategoryItem[] = [];
      const levels: Array<[string, number | undefined]> = [
        ['CRITICAL', categories.get('CRITICAL')],
        ['HIGH', categories.get('HIGH')],
        ['MEDIUM', categories.get('MEDIUM')],
        ['LOW', categories.get('LOW')]
      ];

      for (const [level, count] of levels) {
        if (count && count > 0) {
          items.push({
            type: 'category',
            health: level as HealthStatus,
            count
          });
        }
      }

      return items.length > 0 ? items : [];
    }

    if (element.type === 'category') {
      const allFunctions = this.stateManager.getAllFunctions();
      const fileGroups = new Map<string, number>();

      for (const fn of allFunctions) {
        const impact = this.stateManager.getImpact(fn.id);
        if (!impact) continue;

        let level = 'LOW';
        if (impact.totalAffected >= 10) level = 'CRITICAL';
        else if (impact.totalAffected >= 5) level = 'HIGH';
        else if (impact.totalAffected >= 2) level = 'MEDIUM';

        if (level === element.health) {
          fileGroups.set(fn.file, (fileGroups.get(fn.file) || 0) + 1);
        }
      }

      return Array.from(fileGroups.entries()).map(([filePath, count]) => ({
        type: 'file' as const,
        filePath,
        health: element.health,
        count
      }));
    }

    if (element.type === 'file') {
      const functions = this.stateManager.getFunctionsByFile(element.filePath);
      const items: FunctionItem[] = [];

      for (const fn of functions) {
        const impact = this.stateManager.getImpact(fn.id);
        if (!impact) continue;

        let level = 'LOW';
        if (impact.totalAffected >= 10) level = 'CRITICAL';
        else if (impact.totalAffected >= 5) level = 'HIGH';
        else if (impact.totalAffected >= 2) level = 'MEDIUM';

        if (level === element.health) {
          items.push({
            type: 'function',
            id: fn.id,
            name: fn.name,
            file: fn.file,
            line: fn.location.startLine,
            health: fn.health,
            issueCount: fn.issues.length,
            impactCount: impact.totalAffected
          });
        }
      }

      return items;
    }

    return [];
  }
}

export function registerTreeView(
  context: vscode.ExtensionContext,
  stateManager: StateManager
): void {
  const healthProvider = new HealthTreeViewProvider(stateManager);
  const impactProvider = new ImpactTreeViewProvider(stateManager);

  context.subscriptions.push(
    vscode.window.createTreeView('codepulse.healthView', {
      treeDataProvider: healthProvider,
      showCollapseAll: true
    }),
    vscode.window.createTreeView('codepulse.impactView', {
      treeDataProvider: impactProvider,
      showCollapseAll: true
    })
  );
}

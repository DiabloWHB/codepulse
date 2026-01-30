import * as vscode from 'vscode';
import { StateManager } from '../core/StateManager';

export class StatusBarManager {
  private readonly stateManager: StateManager;
  private readonly statusBarItem: vscode.StatusBarItem;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'codepulse.showDashboard';
    this.statusBarItem.show();

    this.stateManager.events.on('workspace:updated', () => this.update());
    this.stateManager.events.on('analysis:started', () => {
      this.statusBarItem.text = '$(sync~spin) CodePulse';
    });

    this.update();
  }

  public update(): void {
    const summary = this.stateManager.getSummary();
    const { healthyCount, warningCount, errorCount, totalFunctions } = summary;
    const graph = this.stateManager.getGraph();

    if (totalFunctions === 0) {
      this.statusBarItem.text = '💓 CodePulse';
      this.statusBarItem.tooltip = 'No functions analyzed';
      return;
    }

    this.statusBarItem.text = `🟢${healthyCount} 🟡${warningCount} 🔴${errorCount}`;

    const healthPercentage =
      totalFunctions > 0 ? Math.round((healthyCount / totalFunctions) * 100) : 0;

    let tooltip = `CodePulse Health: ${healthPercentage}%\n`;
    tooltip += `━━━━━━━━━━━━━━━━\n`;
    tooltip += `🟢 Healthy: ${healthyCount}\n`;
    tooltip += `🟡 Warnings: ${warningCount}\n`;
    tooltip += `🔴 Errors: ${errorCount}\n`;

    if (graph) {
      tooltip += `━━━━━━━━━━━━━━━━\n`;
      tooltip += `🔗 ${graph.edges.length} connections`;
    }

    this.statusBarItem.tooltip = tooltip;
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}

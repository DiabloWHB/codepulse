import * as vscode from 'vscode';
import { StateManager } from '../core/StateManager';
import { FunctionInfo } from '../types';

/**
 * Modern Webview-based Details panel with professional UI
 * Replaces the TreeView-based DetailsViewProvider with rich HTML/CSS interface
 */
export class DetailsWebview {
  private readonly stateManager: StateManager;
  private panel: vscode.WebviewPanel | undefined;
  private currentFunction: FunctionInfo | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    stateManager: StateManager
  ) {
    this.stateManager = stateManager;
  }

  /**
   * Show details for a specific function
   */
  public showFunctionDetails(functionId: string): void {
    const fn = this.stateManager.getFunctionById(functionId);
    if (!fn) return;

    this.currentFunction = fn;

    // Create or reveal panel
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'codepulseDetails',
        'CodePulse Details',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: []
        }
      );

      // Handle panel disposal
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.currentFunction = null;
      });

      // Handle messages from webview
      this.panel.webview.onDidReceiveMessage(
        (message) => this.handleMessage(message),
        undefined,
        this.context.subscriptions
      );
    }

    // Update webview content
    this.panel.webview.html = this.getWebviewContent(fn);
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'goToCode':
        if (this.currentFunction) {
          const doc = await vscode.workspace.openTextDocument(this.currentFunction.file);
          const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
          const pos = new vscode.Position(this.currentFunction.location.startLine - 1, 0);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }
        break;

      case 'fixWithAI':
        if (this.currentFunction) {
          await vscode.commands.executeCommand('codepulse.fixWithAI', this.currentFunction);
        }
        break;

      case 'ignoreIssues':
        if (this.currentFunction) {
          await vscode.commands.executeCommand('codepulse.ignoreIssue', this.currentFunction);
        }
        break;

      case 'goToFunction':
        const { file, line } = message.data;
        const doc = await vscode.workspace.openTextDocument(file);
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        const pos = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        break;
    }
  }

  /**
   * Generate a nonce for Content Security Policy
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Generate the webview HTML content
   */
  private getWebviewContent(fn: FunctionInfo): string {
    const impact = this.stateManager.getImpact(fn.id);

    // Calculate risk level
    const total = impact?.totalAffected || 0;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (total > 25) riskLevel = 'critical';
    else if (total > 10) riskLevel = 'high';
    else if (total > 3) riskLevel = 'medium';

    const riskColors = {
      low: '#4caf50',
      medium: '#ff9800',
      high: '#ff5722',
      critical: '#f44336'
    };

    const riskLabels = {
      low: 'Low Risk',
      medium: 'Medium Risk',
      high: 'High Risk',
      critical: 'Critical Risk'
    };

    const fileName = fn.file.split(/[\\\\/]/).pop() || '';

    // Generate nonce for Content Security Policy
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Function Details</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 20px;
      line-height: 1.6;
    }

    .header {
      background: linear-gradient(135deg, var(--vscode-button-background) 0%, var(--vscode-button-hoverBackground) 100%);
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-button-foreground);
    }

    .header .meta {
      font-size: 14px;
      opacity: 0.9;
      color: var(--vscode-button-foreground);
    }

    .section {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      transition: all 0.3s ease;
    }

    .section:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-error {
      background: #f443361a;
      color: #f44336;
      border: 1px solid #f44336;
    }

    .badge-warning {
      background: #ff98001a;
      color: #ff9800;
      border: 1px solid #ff9800;
    }

    .badge-info {
      background: #2196f31a;
      color: #2196f3;
      border: 1px solid #2196f3;
    }

    .issue-item {
      background: var(--vscode-input-background);
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 6px;
      border-left: 3px solid #f44336;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .issue-item:hover {
      background: var(--vscode-list-hoverBackground);
      transform: translateX(4px);
    }

    .issue-item.warning {
      border-left-color: #ff9800;
    }

    .issue-item.info {
      border-left-color: #2196f3;
    }

    .issue-message {
      font-size: 14px;
      margin-bottom: 4px;
    }

    .issue-meta {
      font-size: 12px;
      opacity: 0.7;
    }

    .risk-indicator {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--vscode-input-background);
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .risk-circle {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .risk-text {
      flex: 1;
      font-size: 16px;
      font-weight: 600;
    }

    .risk-count {
      font-size: 14px;
      opacity: 0.8;
    }

    .function-list {
      display: grid;
      gap: 8px;
    }

    .function-item {
      background: var(--vscode-input-background);
      padding: 10px 14px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }

    .function-item:hover {
      background: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }

    .function-icon {
      font-size: 16px;
    }

    .function-name {
      flex: 1;
      font-size: 14px;
      font-family: 'Courier New', monospace;
    }

    .function-location {
      font-size: 12px;
      opacity: 0.7;
    }

    .actions {
      display: grid;
      gap: 12px;
      margin-top: 20px;
    }

    .btn {
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .btn-ai {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-ai:hover {
      background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      opacity: 0.6;
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .collapsible {
      cursor: pointer;
      user-select: none;
    }

    .collapsible::before {
      content: '▼';
      display: inline-block;
      margin-right: 8px;
      transition: transform 0.2s;
    }

    .collapsible.collapsed::before {
      transform: rotate(-90deg);
    }

    .collapsible-content {
      max-height: 1000px;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }

    .collapsible-content.collapsed {
      max-height: 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 ${this.escapeHtml(fn.name)}</h1>
    <div class="meta">${fileName}:${fn.location.startLine}</div>
  </div>

  ${fn.issues.length > 0 ? `
    <div class="section">
      <div class="section-title collapsible" onclick="toggleSection(this)">
        🔴 Issues (${fn.issues.length})
      </div>
      <div class="collapsible-content">
        ${fn.issues.slice(0, 20).map(issue => {
          const severityClass = issue.severity === 0 ? 'error' : issue.severity === 1 ? 'warning' : 'info';
          const severityName = ['ERROR', 'WARNING', 'INFO', 'HINT'][issue.severity] || 'INFO';
          return `
            <div class="issue-item ${severityClass}" onclick='goToIssue(${JSON.stringify({ file: fn.file, line: issue.location.startLine })})'>
              <div class="issue-message">${this.escapeHtml(issue.message)}</div>
              <div class="issue-meta">
                <span class="badge badge-${severityClass}">${severityName}</span>
                <span>${issue.category} • Line ${issue.location.startLine}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : ''}

  <div class="section">
    <div class="section-title collapsible" onclick="toggleSection(this)">
      ⚡ Impact Analysis
    </div>
    <div class="collapsible-content">
      ${impact && impact.totalAffected > 0 ? `
        <div class="risk-indicator" style="border-left: 4px solid ${riskColors[riskLevel]}">
          <div class="risk-circle" style="background: ${riskColors[riskLevel]}"></div>
          <div class="risk-text">${riskLabels[riskLevel]}</div>
          <div class="risk-count">${impact.totalAffected} functions affected</div>
        </div>

        ${impact.directImpact.length > 0 ? `
          <div style="margin-bottom: 16px;">
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; opacity: 0.8;">
              📞 Direct Callers (${impact.directImpact.length})
            </h3>
            <div class="function-list">
              ${impact.directImpact.slice(0, 10).map(imp => {
                const fname = imp.node.file.split(/[\\\\/]/).pop() || imp.node.file;
                return `
                  <div class="function-item" onclick='goToFunction(${JSON.stringify({ file: imp.node.file, line: imp.node.line })})'>
                    <span class="function-icon">→</span>
                    <span class="function-name">${this.escapeHtml(imp.node.name)}</span>
                    <span class="function-location">${fname}:${imp.node.line}</span>
                  </div>
                `;
              }).join('')}
              ${impact.directImpact.length > 10 ? `
                <div style="text-align: center; opacity: 0.6; padding: 8px;">
                  ... and ${impact.directImpact.length - 10} more
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        ${impact.indirectImpact.length > 0 ? `
          <div>
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; opacity: 0.8;">
              🔗 Indirect Impact (${impact.indirectImpact.length})
            </h3>
            <div class="function-list">
              ${impact.indirectImpact.slice(0, 10).map(imp => {
                const fname = imp.node.file.split(/[\\\\/]/).pop() || imp.node.file;
                return `
                  <div class="function-item" onclick='goToFunction(${JSON.stringify({ file: imp.node.file, line: imp.node.line })})'>
                    <span class="function-icon">⟿</span>
                    <span class="function-name">${this.escapeHtml(imp.node.name)}</span>
                    <span class="function-location">${fname}:${imp.node.line}</span>
                  </div>
                `;
              }).join('')}
              ${impact.indirectImpact.length > 10 ? `
                <div style="text-align: center; opacity: 0.6; padding: 8px;">
                  ... and ${impact.indirectImpact.length - 10} more
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div>No Dependencies Found</div>
          <div style="font-size: 14px; margin-top: 8px;">This function is not called by others - changes are safe</div>
        </div>
      `}
    </div>
  </div>

  <div class="actions">
    <button class="btn btn-primary" onclick="goToCode()">
      📍 Go to Source Code
    </button>
    ${fn.issues.length > 0 ? `
      <button class="btn btn-ai" onclick="fixWithAI()">
        🤖 Fix with AI Assistant
      </button>
      <button class="btn btn-secondary" onclick="ignoreIssues()">
        🙈 Ignore Issues
      </button>
    ` : ''}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function goToCode() {
      vscode.postMessage({ command: 'goToCode' });
    }

    function fixWithAI() {
      vscode.postMessage({ command: 'fixWithAI' });
    }

    function ignoreIssues() {
      vscode.postMessage({ command: 'ignoreIssues' });
    }

    function goToFunction(data) {
      vscode.postMessage({ command: 'goToFunction', data });
    }

    function goToIssue(data) {
      vscode.postMessage({ command: 'goToFunction', data });
    }

    function toggleSection(element) {
      element.classList.toggle('collapsed');
      const content = element.nextElementSibling;
      content.classList.toggle('collapsed');
    }
  </script>
</body>
</html>`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Dispose of the webview
   */
  public dispose(): void {
    this.panel?.dispose();
  }
}

/**
 * Register the Details Webview
 */
export function registerDetailsWebview(
  context: vscode.ExtensionContext,
  stateManager: StateManager
): DetailsWebview {
  const detailsWebview = new DetailsWebview(context, stateManager);

  // Command to show function details
  context.subscriptions.push(
    vscode.commands.registerCommand('codepulse.showDetails', (functionId: string) => {
      detailsWebview.showFunctionDetails(functionId);
    })
  );

  return detailsWebview;
}

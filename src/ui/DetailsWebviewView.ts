import * as vscode from 'vscode';
import { StateManager } from '../core/StateManager';
import { FunctionInfo, HealthStatus } from '../types';

/**
 * Professional Webview embedded in the sidebar Details panel
 * Uses WebviewView API to appear directly in the CodePulse sidebar
 */
export class DetailsWebviewView implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codepulse.detailsView';

  private _view?: vscode.WebviewView;
  private currentFunction: FunctionInfo | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly stateManager: StateManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message)
    );

    // Show initial content
    this.updateView();
  }

  /**
   * Show details for a specific function
   */
  public showFunctionDetails(functionId: string): void {
    const fn = this.stateManager.getFunctionById(functionId);
    if (!fn) return;

    this.currentFunction = fn;
    this.updateView();
  }

  /**
   * Update the webview content
   */
  private updateView(): void {
    if (this._view) {
      this._view.webview.html = this.getHtmlContent();
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
   * Handle messages from the webview
   */
  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.command) {
        case 'goToCode':
          if (this.currentFunction) {
            const doc = await vscode.workspace.openTextDocument(this.currentFunction.file);
            const editor = await vscode.window.showTextDocument(doc);
            const pos = new vscode.Position(this.currentFunction.location.startLine - 1, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          }
          break;

        case 'fixWithAI':
          if (this.currentFunction) {
            console.log('[CodePulse] Fix with AI clicked for:', this.currentFunction.name);
            await vscode.commands.executeCommand('codepulse.fixWithAI', this.currentFunction);
          } else {
            console.error('[CodePulse] Fix with AI clicked but no currentFunction');
            vscode.window.showWarningMessage('No function selected. Please select a function first.');
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
          const editor = await vscode.window.showTextDocument(doc);
          const pos = new vscode.Position(line - 1, 0);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          break;
      }
    } catch (error) {
      console.error('[CodePulse] Error handling message:', error);
      vscode.window.showErrorMessage(`CodePulse: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate HTML content
   */
  private getHtmlContent(): string {
    if (!this.currentFunction) {
      return this.getEmptyStateHtml();
    }

    const fn = this.currentFunction;
    const impact = this.stateManager.getImpact(fn.id);

    // Calculate risk level
    const total = impact?.totalAffected || 0;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (total > 25) riskLevel = 'critical';
    else if (total > 10) riskLevel = 'high';
    else if (total > 3) riskLevel = 'medium';

    const riskColors = {
      low: '#4ade80',
      medium: '#fb923c',
      high: '#f97316',
      critical: '#ef4444'
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
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: transparent;
      padding: 12px;
      line-height: 1.6;
    }

    .header {
      background: linear-gradient(135deg,
        var(--vscode-button-background) 0%,
        var(--vscode-button-hoverBackground) 100%);
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .header h1 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--vscode-button-foreground);
    }

    .header .meta {
      font-size: 12px;
      opacity: 0.9;
      color: var(--vscode-button-foreground);
    }

    .section {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-title::before {
      content: '▼';
      font-size: 10px;
      transition: transform 0.2s;
    }

    .section-title.collapsed::before {
      transform: rotate(-90deg);
    }

    .section-content {
      max-height: 1000px;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }

    .section-content.collapsed {
      max-height: 0;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-error {
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
    }

    .badge-warning {
      background: var(--vscode-inputValidation-warningBackground);
      color: var(--vscode-inputValidation-warningForeground);
      border: 1px solid var(--vscode-inputValidation-warningBorder);
    }

    .badge-info {
      background: var(--vscode-inputValidation-infoBackground);
      color: var(--vscode-inputValidation-infoForeground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
    }

    .issue-item {
      background: var(--vscode-input-background);
      padding: 10px;
      margin-bottom: 6px;
      border-radius: 4px;
      border-left: 3px solid var(--vscode-inputValidation-errorBorder);
      cursor: pointer;
      transition: all 0.2s;
    }

    .issue-item:hover {
      background: var(--vscode-list-hoverBackground);
      transform: translateX(2px);
    }

    .issue-item.warning {
      border-left-color: var(--vscode-inputValidation-warningBorder);
    }

    .issue-item.info {
      border-left-color: var(--vscode-inputValidation-infoBorder);
    }

    .issue-message {
      font-size: 13px;
      margin-bottom: 4px;
    }

    .issue-meta {
      font-size: 11px;
      opacity: 0.7;
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .risk-indicator {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: var(--vscode-input-background);
      border-radius: 6px;
      margin-bottom: 12px;
      border-left: 3px solid ${riskColors[riskLevel]};
    }

    .risk-circle {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${riskColors[riskLevel]};
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .risk-text {
      flex: 1;
      font-size: 14px;
      font-weight: 600;
    }

    .risk-count {
      font-size: 12px;
      opacity: 0.8;
    }

    .function-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .function-item {
      background: var(--vscode-input-background);
      padding: 8px 10px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
      font-size: 12px;
    }

    .function-item:hover {
      background: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }

    .function-icon {
      opacity: 0.6;
    }

    .function-name {
      flex: 1;
      font-family: var(--vscode-editor-font-family);
    }

    .function-location {
      font-size: 11px;
      opacity: 0.6;
    }

    .btn {
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 8px;
    }

    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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
      padding: 40px 20px;
      opacity: 0.6;
    }

    .empty-state-icon {
      font-size: 36px;
      margin-bottom: 12px;
    }

    .subsection-title {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 6px;
      margin-top: 12px;
      opacity: 0.8;
    }

    .subsection-title:first-child {
      margin-top: 0;
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
      <div class="section-title" onclick="toggleSection(this)">
        🔴 Issues (${fn.issues.length})
      </div>
      <div class="section-content">
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
    <div class="section-title" onclick="toggleSection(this)">
      ⚡ Impact Analysis
    </div>
    <div class="section-content">
      ${impact && impact.totalAffected > 0 ? `
        <div class="risk-indicator">
          <div class="risk-circle"></div>
          <div class="risk-text">${riskLabels[riskLevel]}</div>
          <div class="risk-count">${impact.totalAffected} affected</div>
        </div>

        ${impact.directImpact.length > 0 ? `
          <div class="subsection-title">📞 Direct Callers (${impact.directImpact.length})</div>
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
              <div style="text-align: center; opacity: 0.5; padding: 6px; font-size: 11px;">
                ... and ${impact.directImpact.length - 10} more
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${impact.indirectImpact.length > 0 ? `
          <div class="subsection-title">🔗 Indirect Impact (${impact.indirectImpact.length})</div>
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
              <div style="text-align: center; opacity: 0.5; padding: 6px; font-size: 11px;">
                ... and ${impact.indirectImpact.length - 10} more
              </div>
            ` : ''}
          </div>
        ` : ''}
      ` : `
        <div style="padding: 12px; background: var(--vscode-input-background); border-radius: 6px; border-left: 3px solid #4ade80;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
            <span style="font-size: 16px;">✅</span>
            <div>
              <div style="font-weight: 600;">No Dependencies</div>
              <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">Safe to modify</div>
            </div>
          </div>
        </div>
      `}
    </div>
  </div>

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
   * Get empty state HTML
   */
  private getEmptyStateHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 20px 16px;
      text-align: center;
    }
    .icon {
      font-size: 32px;
      margin-bottom: 12px;
      opacity: 0.4;
    }
    h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      opacity: 0.8;
    }
    p {
      font-size: 13px;
      opacity: 0.6;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="icon">ℹ️</div>
  <h2>No Function Selected</h2>
  <p>Click on a function in Health Status or Impact Analysis to see details</p>
</body>
</html>`;
  }

  /**
   * Escape HTML
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
}

/**
 * Register the Details Webview View
 */
export function registerDetailsWebviewView(
  context: vscode.ExtensionContext,
  stateManager: StateManager
): DetailsWebviewView {
  const provider = new DetailsWebviewView(context.extensionUri, stateManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DetailsWebviewView.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Command to show function details
  context.subscriptions.push(
    vscode.commands.registerCommand('codepulse.showDetails', (functionId: string) => {
      provider.showFunctionDetails(functionId);
    })
  );

  // Fix with AI command
  context.subscriptions.push(
    vscode.commands.registerCommand('codepulse.fixWithAI', async (fn: FunctionInfo) => {
      try {
        console.log('[CodePulse] Executing fixWithAI command for:', fn.name);

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

        console.log('[CodePulse] Copying prompt to clipboard, length:', prompt.length);

        // Copy to clipboard and show message
        await vscode.env.clipboard.writeText(prompt);

        console.log('[CodePulse] Successfully copied to clipboard');

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
      } catch (error) {
        console.error('[CodePulse] Error in fixWithAI command:', error);
        vscode.window.showErrorMessage(`Failed to copy AI context: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        // Get the file result
        const fileResult = stateManager.getFileResult(fn.file);
        if (!fileResult) return;

        // Update the function to have no issues and HEALTHY status
        const updatedFunctions = fileResult.functions.map(f => {
          if (f.id === fn.id) {
            return {
              ...f,
              issues: [],
              health: HealthStatus.HEALTHY
            };
          }
          return f;
        });

        // Update the file result with the modified function
        const updatedFileResult = {
          ...fileResult,
          functions: updatedFunctions
        };

        // Save back to StateManager - this will trigger UI refresh
        stateManager.setFileResult(fn.file, updatedFileResult);

        vscode.window.showInformationMessage(`Ignored ${fn.issues.length} issue(s) in ${fn.name}`);
      }
    })
  );

  return provider;
}

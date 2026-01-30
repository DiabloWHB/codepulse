import * as vscode from 'vscode';
import { StateManager } from '../core/StateManager';
import { Issue, IssueSeverity } from '../types';

export class DiagnosticManager {
  private readonly stateManager: StateManager;
  private readonly diagnosticCollection: vscode.DiagnosticCollection;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('codepulse');

    this.stateManager.events.on('analysis:completed', ({ file }) => {
      this.updateDiagnostics(file);
    });
  }

  public updateDiagnostics(filePath: string): void {
    const result = this.stateManager.getFileResult(filePath);
    if (!result) {
      this.diagnosticCollection.delete(vscode.Uri.file(filePath));
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];

    for (const issue of result.fileIssues) {
      diagnostics.push(this.issueToDiagnostic(issue));
    }

    for (const fn of result.functions) {
      for (const issue of fn.issues) {
        diagnostics.push(this.issueToDiagnostic(issue));
      }
    }

    this.diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
  }

  private issueToDiagnostic(issue: Issue): vscode.Diagnostic {
    const range = new vscode.Range(
      issue.location.startLine,
      issue.location.startColumn,
      issue.location.endLine,
      issue.location.endColumn
    );

    const severity =
      issue.severity === IssueSeverity.ERROR
        ? vscode.DiagnosticSeverity.Error
        : issue.severity === IssueSeverity.WARNING
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;

    const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
    diagnostic.source = 'CodePulse';
    diagnostic.code = issue.category;
    return diagnostic;
  }

  public clearFile(filePath: string): void {
    this.diagnosticCollection.delete(vscode.Uri.file(filePath));
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}

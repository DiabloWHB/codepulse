import { StateManager } from '../core/StateManager';
import { IssueSeverity, IssueCategory } from '../types';

export interface ProjectReportData {
  summary: {
    totalFiles: number;
    totalFunctions: number;
    healthyCount: number;
    warningCount: number;
    errorCount: number;
    healthPercentage: number;
  };
  issuesByCategory: Map<IssueCategory, number>;
  issuesBySeverity: Map<IssueSeverity, number>;
  topProblematicFiles: Array<{
    file: string;
    issueCount: number;
    errorCount: number;
    warningCount: number;
  }>;
  mockDataIssues: Array<{
    file: string;
    line: number;
    message: string;
  }>;
  inactiveButtons: Array<{
    file: string;
    line: number;
    message: string;
  }>;
  criticalImpactFunctions: Array<{
    name: string;
    file: string;
    impactCount: number;
  }>;
  recommendations: string[];
}

export class ProjectReportGenerator {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  public generate(): ProjectReportData {
    const summary = this.stateManager.getSummary();
    const allFunctions = this.stateManager.getAllFunctions();
    const analyzedFiles = this.stateManager.getAnalyzedFiles();

    // Calculate health percentage
    const healthPercentage =
      summary.totalFunctions > 0
        ? Math.round((summary.healthyCount / summary.totalFunctions) * 100)
        : 0;

    // Count issues by category and severity
    const issuesByCategory = new Map<IssueCategory, number>();
    const issuesBySeverity = new Map<IssueSeverity, number>();

    for (const fn of allFunctions) {
      for (const issue of fn.issues) {
        issuesByCategory.set(issue.category, (issuesByCategory.get(issue.category) || 0) + 1);
        issuesBySeverity.set(issue.severity, (issuesBySeverity.get(issue.severity) || 0) + 1);
      }
    }

    // Find top problematic files
    const fileIssues = new Map<string, { errors: number; warnings: number; info: number }>();

    for (const fn of allFunctions) {
      if (!fileIssues.has(fn.file)) {
        fileIssues.set(fn.file, { errors: 0, warnings: 0, info: 0 });
      }

      const stats = fileIssues.get(fn.file)!;
      for (const issue of fn.issues) {
        if (issue.severity === IssueSeverity.ERROR) stats.errors++;
        else if (issue.severity === IssueSeverity.WARNING) stats.warnings++;
        else if (issue.severity === IssueSeverity.INFO) stats.info++;
      }
    }

    const topProblematicFiles = Array.from(fileIssues.entries())
      .map(([file, stats]) => ({
        file,
        issueCount: stats.errors + stats.warnings + stats.info,
        errorCount: stats.errors,
        warningCount: stats.warnings
      }))
      .filter((f) => f.issueCount > 0)
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 10);

    // Extract mock data issues
    const mockDataIssues: Array<{ file: string; line: number; message: string }> = [];
    for (const fn of allFunctions) {
      for (const issue of fn.issues) {
        if (
          issue.message.toLowerCase().includes('mock') ||
          issue.message.toLowerCase().includes('test') ||
          issue.message.toLowerCase().includes('dummy')
        ) {
          mockDataIssues.push({
            file: fn.file,
            line: issue.location.startLine,
            message: issue.message
          });
        }
      }
    }

    // Extract inactive button issues
    const inactiveButtons: Array<{ file: string; line: number; message: string }> = [];
    for (const fn of allFunctions) {
      for (const issue of fn.issues) {
        if (
          issue.message.toLowerCase().includes('button') ||
          issue.message.toLowerCase().includes('inactive') ||
          issue.message.toLowerCase().includes('onclick')
        ) {
          inactiveButtons.push({
            file: fn.file,
            line: issue.location.startLine,
            message: issue.message
          });
        }
      }
    }

    // Find critical impact functions
    const criticalImpactFunctions: Array<{
      name: string;
      file: string;
      impactCount: number;
    }> = [];

    for (const fn of allFunctions) {
      const impact = this.stateManager.getImpact(fn.id);
      if (impact && impact.totalAffected >= 10) {
        criticalImpactFunctions.push({
          name: fn.name,
          file: fn.file,
          impactCount: impact.totalAffected
        });
      }
    }

    criticalImpactFunctions.sort((a, b) => b.impactCount - a.impactCount);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      summary: { ...summary, healthPercentage },
      mockDataCount: mockDataIssues.length,
      inactiveButtonsCount: inactiveButtons.length,
      criticalFunctionsCount: criticalImpactFunctions.length,
      errorCount: issuesBySeverity.get(IssueSeverity.ERROR) || 0,
      warningCount: issuesBySeverity.get(IssueSeverity.WARNING) || 0
    });

    return {
      summary: {
        totalFiles: analyzedFiles.length,
        totalFunctions: summary.totalFunctions,
        healthyCount: summary.healthyCount,
        warningCount: summary.warningCount,
        errorCount: summary.errorCount,
        healthPercentage
      },
      issuesByCategory,
      issuesBySeverity,
      topProblematicFiles,
      mockDataIssues: mockDataIssues.slice(0, 20), // Limit to 20
      inactiveButtons: inactiveButtons.slice(0, 20),
      criticalImpactFunctions: criticalImpactFunctions.slice(0, 10),
      recommendations
    };
  }

  private generateRecommendations(data: {
    summary: { healthPercentage: number; errorCount: number; warningCount: number };
    mockDataCount: number;
    inactiveButtonsCount: number;
    criticalFunctionsCount: number;
    errorCount: number;
    warningCount: number;
  }): string[] {
    const recommendations: string[] = [];

    // Health-based recommendations
    if (data.summary.healthPercentage < 50) {
      recommendations.push(
        '🔴 CRITICAL: Less than 50% of functions are healthy. Prioritize fixing errors immediately.'
      );
    } else if (data.summary.healthPercentage < 80) {
      recommendations.push(
        '🟡 WARNING: Health is below 80%. Address warnings to improve code quality.'
      );
    } else {
      recommendations.push('🟢 GOOD: Project health is above 80%. Keep up the good work!');
    }

    // Error-based recommendations
    if (data.errorCount > 0) {
      recommendations.push(
        `🔴 Fix ${data.errorCount} critical error${data.errorCount > 1 ? 's' : ''} that will cause runtime failures.`
      );
    }

    // Mock data recommendations
    if (data.mockDataCount > 10) {
      recommendations.push(
        `🎭 Found ${data.mockDataCount} instances of mock/test data. Replace with real data before production.`
      );
    } else if (data.mockDataCount > 0) {
      recommendations.push(
        `🎭 ${data.mockDataCount} mock data instance${data.mockDataCount > 1 ? 's' : ''} detected. Verify these are intentional.`
      );
    }

    // Inactive buttons recommendations
    if (data.inactiveButtonsCount > 5) {
      recommendations.push(
        `🔘 ${data.inactiveButtonsCount} inactive or broken buttons found. Add click handlers to improve UX.`
      );
    } else if (data.inactiveButtonsCount > 0) {
      recommendations.push(
        `🔘 ${data.inactiveButtonsCount} button${data.inactiveButtonsCount > 1 ? 's need' : ' needs'} attention.`
      );
    }

    // Critical impact recommendations
    if (data.criticalFunctionsCount > 0) {
      recommendations.push(
        `⚡ ${data.criticalFunctionsCount} function${data.criticalFunctionsCount > 1 ? 's have' : ' has'} critical impact (10+ affected). Test thoroughly before changing.`
      );
    }

    // General recommendations
    if (data.warningCount > 20) {
      recommendations.push(
        '📋 High number of warnings. Consider setting up pre-commit hooks to catch issues early.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✨ No major issues found! Your code looks production-ready.');
    }

    return recommendations;
  }

  public generateMarkdownReport(data: ProjectReportData): string {
    let md = '# CodePulse Project Report\n\n';

    // Summary section
    md += '## 📊 Project Summary\n\n';
    md += `- **Total Files**: ${data.summary.totalFiles}\n`;
    md += `- **Total Functions**: ${data.summary.totalFunctions}\n`;
    md += `- **Health Score**: ${data.summary.healthPercentage}%\n`;
    md += `- 🟢 **Healthy**: ${data.summary.healthyCount}\n`;
    md += `- 🟡 **Warnings**: ${data.summary.warningCount}\n`;
    md += `- 🔴 **Errors**: ${data.summary.errorCount}\n\n`;

    // Issues by severity
    md += '## 🚨 Issues by Severity\n\n';
    md += '| Severity | Count |\n';
    md += '|----------|-------|\n';
    for (const [severity, count] of data.issuesBySeverity.entries()) {
      const icon =
        severity === IssueSeverity.ERROR ? '🔴' : severity === IssueSeverity.WARNING ? '🟡' : 'ℹ️';
      md += `| ${icon} ${severity} | ${count} |\n`;
    }
    md += '\n';

    // Top problematic files
    if (data.topProblematicFiles.length > 0) {
      md += '## 📁 Most Problematic Files\n\n';
      md += '| File | Errors | Warnings | Total |\n';
      md += '|------|--------|----------|-------|\n';
      for (const file of data.topProblematicFiles) {
        const shortPath = file.file.split(/[\\/]/).slice(-3).join('/');
        md += `| ${shortPath} | ${file.errorCount} | ${file.warningCount} | ${file.issueCount} |\n`;
      }
      md += '\n';
    }

    // Mock data issues
    if (data.mockDataIssues.length > 0) {
      md += '## 🎭 Mock/Test Data Detected\n\n';
      md += `Found ${data.mockDataIssues.length} instance(s) of mock or test data:\n\n`;
      for (const issue of data.mockDataIssues.slice(0, 5)) {
        const shortPath = issue.file.split(/[\\/]/).slice(-2).join('/');
        md += `- ${shortPath}:${issue.line} - ${issue.message}\n`;
      }
      if (data.mockDataIssues.length > 5) {
        md += `\n...and ${data.mockDataIssues.length - 5} more\n`;
      }
      md += '\n';
    }

    // Inactive buttons
    if (data.inactiveButtons.length > 0) {
      md += '## 🔘 Inactive/Broken Buttons\n\n';
      md += `Found ${data.inactiveButtons.length} button(s) needing attention:\n\n`;
      for (const issue of data.inactiveButtons.slice(0, 5)) {
        const shortPath = issue.file.split(/[\\/]/).slice(-2).join('/');
        md += `- ${shortPath}:${issue.line} - ${issue.message}\n`;
      }
      if (data.inactiveButtons.length > 5) {
        md += `\n...and ${data.inactiveButtons.length - 5} more\n`;
      }
      md += '\n';
    }

    // Critical impact functions
    if (data.criticalImpactFunctions.length > 0) {
      md += '## ⚡ Critical Impact Functions\n\n';
      md += 'These functions affect many others. Test thoroughly before modifying:\n\n';
      md += '| Function | File | Affects |\n';
      md += '|----------|------|----------|\n';
      for (const fn of data.criticalImpactFunctions) {
        const shortPath = fn.file.split(/[\\/]/).slice(-2).join('/');
        md += `| ${fn.name} | ${shortPath} | ${fn.impactCount} functions |\n`;
      }
      md += '\n';
    }

    // Recommendations
    md += '## 💡 Recommendations\n\n';
    for (const rec of data.recommendations) {
      md += `${rec}\n\n`;
    }

    md += '---\n';
    md += `*Generated by CodePulse on ${new Date().toLocaleString()}*\n`;

    return md;
  }
}

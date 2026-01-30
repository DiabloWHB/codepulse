import * as fs from 'fs';
import * as path from 'path';
import { BaseAnalyzer, AnalysisContext, AnalyzerResult } from './BaseAnalyzer';
import { IssueSeverity, IssueCategory, Issue } from '../../types';
import { SyntaxNode } from '../Parser';

export class EnvAnalyzer extends BaseAnalyzer {
  public readonly name = 'env';
  public readonly category = IssueCategory.ENVIRONMENT;
  private envFileCache: Map<string, Set<string>> = new Map();

  public async analyze(context: AnalysisContext): Promise<AnalyzerResult> {
    const issues: Issue[] = [];
    const envUsages = this.findEnvUsages(context);
    const definedVars = this.loadEnvFile(context.workspaceRoot);

    issues.push(...this.checkUndefinedVars(context, envUsages, definedVars));
    issues.push(...this.checkSensitiveVars(context, envUsages));

    return { issues };
  }

  private findEnvUsages(
    context: AnalysisContext
  ): Array<{ name: string; node: SyntaxNode }> {
    const usages: Array<{ name: string; node: SyntaxNode }> = [];
    const memberExprs = this.findNodes(context.rootNode, 'member_expression');

    for (const node of memberExprs) {
      const text = node.text;
      const processEnvMatch = text.match(/^process\.env\.([A-Z_][A-Z0-9_]*)$/);
      if (processEnvMatch) {
        usages.push({ name: processEnvMatch[1], node });
        continue;
      }
      const importMetaMatch = text.match(/^import\.meta\.env\.([A-Z_][A-Z0-9_]*)$/);
      if (importMetaMatch) {
        usages.push({ name: importMetaMatch[1], node });
      }
    }

    return usages;
  }

  private loadEnvFile(workspaceRoot: string): Set<string> {
    if (this.envFileCache.has(workspaceRoot)) {
      return this.envFileCache.get(workspaceRoot)!;
    }

    const definedVars = new Set<string>();
    const envFiles = ['.env', '.env.local', '.env.development', '.env.example'];

    for (const envFile of envFiles) {
      const envPath = path.join(workspaceRoot, envFile);
      try {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf-8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
            if (match) definedVars.add(match[1]);
          }
        }
      } catch {
        /* ignore */
      }
    }

    this.envFileCache.set(workspaceRoot, definedVars);
    return definedVars;
  }

  private checkUndefinedVars(
    context: AnalysisContext,
    usages: Array<{ name: string; node: SyntaxNode }>,
    definedVars: Set<string>
  ): Issue[] {
    const issues: Issue[] = [];
    const commonVars = new Set(['NODE_ENV', 'HOME', 'PATH', 'USER']);

    for (const { name, node } of usages) {
      if (!definedVars.has(name) && !commonVars.has(name)) {
        issues.push(
          this.createIssue(
            IssueSeverity.WARNING,
            `Undefined env var: ${name}`,
            `Environment variable "${name}" is used but not defined in .env file.`,
            this.nodeToLocation(node, context.filePath)
          )
        );
      }
    }

    return issues;
  }

  private checkSensitiveVars(
    context: AnalysisContext,
    usages: Array<{ name: string; node: SyntaxNode }>
  ): Issue[] {
    const issues: Issue[] = [];
    const sensitivePatterns = [/SECRET/i, /PASSWORD/i, /PRIVATE_KEY/i, /API_KEY/i, /TOKEN/i];
    const isClientSide =
      context.filePath.includes('/components/') ||
      context.filePath.includes('/pages/') ||
      context.filePath.endsWith('.tsx') ||
      context.filePath.endsWith('.jsx');

    if (!isClientSide) return issues;

    for (const { name, node } of usages) {
      const isSensitive = sensitivePatterns.some((p) => p.test(name));
      const isPublicVar = name.startsWith('NEXT_PUBLIC_') || name.startsWith('VITE_');

      if (isSensitive && !isPublicVar) {
        issues.push(
          this.createIssue(
            IssueSeverity.ERROR,
            `Sensitive env var in client code: ${name}`,
            `"${name}" appears sensitive but is used in client-side code.`,
            this.nodeToLocation(node, context.filePath)
          )
        );
      }
    }

    return issues;
  }
}

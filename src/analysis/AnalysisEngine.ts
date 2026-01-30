import * as fs from 'fs';
import {
  FileAnalysisResult,
  Issue,
  FunctionInfo,
  HealthStatus,
  TimeoutError,
  FileNotFoundError,
  IssueSeverity
} from '../types';
import { CodeParser } from './Parser';
import { FunctionExtractor } from './FunctionExtractor';
import { BaseAnalyzer, AnalysisContext } from './analyzers/BaseAnalyzer';
import { StaticAnalyzer } from './analyzers/StaticAnalyzer';
import { ImportAnalyzer } from './analyzers/ImportAnalyzer';
import { EnvAnalyzer } from './analyzers/EnvAnalyzer';
import { CacheManager } from '../core/CacheManager';
import { Logger } from '../utils/logger';
import { computeHash } from '../utils/hash';

interface AnalysisOptions {
  force?: boolean;
  timeout?: number;
  analyzers?: string[];
}

export class AnalysisEngine {
  private readonly parser: CodeParser;
  private readonly extractor: FunctionExtractor;
  private readonly analyzers: BaseAnalyzer[];
  private readonly cache: CacheManager<FileAnalysisResult>;
  private readonly logger: Logger;
  private readonly workspaceRoot: string;
  private readonly timeout: number;

  constructor(
    workspaceRoot: string,
    cache?: CacheManager<FileAnalysisResult>,
    options?: { timeout?: number }
  ) {
    this.workspaceRoot = workspaceRoot;
    this.parser = new CodeParser();
    this.extractor = new FunctionExtractor();
    this.cache = cache ?? new CacheManager<FileAnalysisResult>();
    this.logger = new Logger('AnalysisEngine');
    this.timeout = options?.timeout ?? 5000;

    this.analyzers = [new StaticAnalyzer(), new ImportAnalyzer(), new EnvAnalyzer()];
  }

  public async analyzeFile(
    filePath: string,
    options: AnalysisOptions = {}
  ): Promise<FileAnalysisResult> {
    const startTime = Date.now();
    this.logger.debug(`Analyzing file: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new FileNotFoundError(filePath);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const contentHash = computeHash(content);

    if (!options.force) {
      const cached = this.cache.get(filePath, content);
      if (cached) {
        this.logger.debug(`Cache hit for ${filePath}`);
        return cached;
      }
    }

    const tree = this.parser.parse(content, filePath);
    const functions = this.extractor.extract(tree.rootNode, filePath);

    const context: AnalysisContext = {
      filePath,
      content,
      rootNode: tree.rootNode,
      functions,
      workspaceRoot: this.workspaceRoot
    };

    const allIssues = await this.runAnalyzers(
      context,
      options.timeout ?? this.timeout,
      options.analyzers
    );
    const enrichedFunctions = this.enrichFunctions(functions, allIssues);

    // Extract imports using ImportAnalyzer
    const importAnalyzer = this.analyzers.find((a) => a.name === 'import');
    const imports = importAnalyzer && 'getImports' in importAnalyzer
      ? (importAnalyzer as any).getImports(context)
      : [];

    const result: FileAnalysisResult = {
      file: filePath,
      contentHash,
      functions: enrichedFunctions,
      fileIssues: allIssues.filter((issue) => !this.issueBelongsToFunction(issue, functions)),
      imports,
      exports: [], // TODO: Extract exports
      analysisDurationMs: Date.now() - startTime,
      analyzedAt: Date.now()
    };

    this.cache.set(filePath, content, result);
    this.logger.debug(`Analysis complete for ${filePath}`, {
      functions: result.functions.length,
      issues: allIssues.length
    });

    return result;
  }

  private async runAnalyzers(
    context: AnalysisContext,
    timeoutMs: number,
    analyzerNames?: string[]
  ): Promise<Issue[]> {
    const activeAnalyzers = analyzerNames
      ? this.analyzers.filter((a) => analyzerNames.includes(a.name))
      : this.analyzers;

    const promises = activeAnalyzers
      .filter((a) => a.shouldAnalyze(context))
      .map(async (a) => {
        try {
          const result = await a.analyze(context);
          return result.issues;
        } catch (error) {
          this.logger.error(`Analyzer ${a.name} failed`, error);
          return [];
        }
      });

    try {
      const results = await Promise.race([
        Promise.all(promises),
        new Promise<Issue[][]>((_, reject) =>
          setTimeout(() => reject(new TimeoutError('Analysis timed out', timeoutMs)), timeoutMs)
        )
      ]);
      return results.flat();
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.logger.warn(`Analysis timed out after ${timeoutMs}ms`);
        return [];
      }
      throw error;
    }
  }

  private enrichFunctions(functions: FunctionInfo[], issues: Issue[]): FunctionInfo[] {
    return functions.map((fn) => {
      const fnIssues = issues.filter((issue) => this.issueBelongsToFunction(issue, [fn]));
      const health = this.calculateHealth(fnIssues);
      return { ...fn, issues: fnIssues, health, lastAnalyzedAt: Date.now() };
    });
  }

  private issueBelongsToFunction(issue: Issue, functions: FunctionInfo[]): boolean {
    return functions.some(
      (fn) =>
        issue.location.file === fn.file &&
        issue.location.startLine >= fn.location.startLine &&
        issue.location.endLine <= fn.location.endLine
    );
  }

  private calculateHealth(issues: Issue[]): HealthStatus {
    if (issues.length === 0) return HealthStatus.HEALTHY;
    if (issues.some((i) => i.severity === IssueSeverity.ERROR)) return HealthStatus.ERROR;
    if (issues.some((i) => i.severity === IssueSeverity.WARNING)) return HealthStatus.WARNING;
    return HealthStatus.HEALTHY;
  }

  public registerAnalyzer(analyzer: BaseAnalyzer): void {
    this.analyzers.push(analyzer);
  }

  public getAnalyzerNames(): string[] {
    return this.analyzers.map((a) => a.name);
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats(): ReturnType<CacheManager<FileAnalysisResult>['getStats']> {
    return this.cache.getStats();
  }
}

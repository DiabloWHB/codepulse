import * as vscode from 'vscode';
import * as fs from 'fs';
import { SymbolIndexManager } from './SymbolIndexManager';
import {
  AIContext,
  SymbolInfo,
  CodeSnippet,
  SymbolSearchResult
} from './types';
import { Logger } from '../utils/logger';

/**
 * Provides AI context from the symbol index.
 * THIS IS MANDATORY - AI MUST use this to get code context.
 */
export class AIContextProvider {
  private readonly indexManager: SymbolIndexManager;
  private readonly logger: Logger;
  private usageCount = 0;
  private cacheHitCount = 0;
  private readonly contextCache = new Map<string, AIContext>();

  constructor(indexManager: SymbolIndexManager) {
    this.indexManager = indexManager;
    this.logger = new Logger('AIContextProvider');
  }

  /**
   * Get AI context for a natural language query.
   * THIS IS THE MANDATORY ENTRY POINT FOR AI.
   */
  public async getContextForQuery(query: string): Promise<AIContext> {
    this.usageCount++;
    this.logger.info(`AI Context Request #${this.usageCount}: "${query}"`);

    // Check cache first
    const cached = this.getCachedContext(query);
    if (cached) {
      this.cacheHitCount++;
      this.logger.debug(`Cache hit (${this.cacheHitCount}/${this.usageCount})`);
      return cached;
    }

    // Search the index
    const results = this.indexManager.searchByContext(query);

    if (results.length === 0) {
      this.logger.warn(`No symbols found for query: "${query}"`);
      return this.createEmptyContext(query);
    }

    // Build context from results
    const context = await this.buildContext(results, query);

    // Cache the context
    this.cacheContext(query, context);

    return context;
  }

  /**
   * Get AI context for a specific file.
   */
  public async getContextForFile(filePath: string): Promise<AIContext> {
    this.logger.info(`AI Context Request for file: ${filePath}`);

    const symbols = this.indexManager.getSymbolsInFile(filePath);

    if (symbols.length === 0) {
      return this.createEmptyContext(`File: ${filePath}`);
    }

    const results: SymbolSearchResult[] = symbols.map((symbol) => ({
      symbol,
      score: 1.0,
      matchReason: ['File match']
    }));

    return await this.buildContext(results, `File: ${filePath}`);
  }

  /**
   * Get AI context for a specific symbol.
   */
  public async getContextForSymbol(symbolId: string): Promise<AIContext> {
    this.logger.info(`AI Context Request for symbol: ${symbolId}`);

    const symbol = this.indexManager.getSymbol(symbolId);

    if (!symbol) {
      return this.createEmptyContext(`Symbol: ${symbolId}`);
    }

    const results: SymbolSearchResult[] = [
      {
        symbol,
        score: 1.0,
        matchReason: ['Direct match']
      }
    ];

    return await this.buildContext(results, `Symbol: ${symbol.name}`);
  }

  /**
   * Get context for dependencies of a symbol.
   */
  public async getContextForDependencies(symbolId: string): Promise<AIContext> {
    const symbol = this.indexManager.getSymbol(symbolId);

    if (!symbol || !symbol.dependencies) {
      return this.createEmptyContext(`Dependencies of ${symbolId}`);
    }

    const dependencySymbols: SymbolInfo[] = [];

    for (const dep of symbol.dependencies) {
      if (!dep.isExternal && dep.source) {
        // Find the symbol in the index
        const results = this.indexManager.search({
          exactName: dep.name,
          file: dep.source,
          limit: 1
        });

        if (results.length > 0) {
          dependencySymbols.push(results[0].symbol);
        }
      }
    }

    const results: SymbolSearchResult[] = dependencySymbols.map((sym) => ({
      symbol: sym,
      score: 1.0,
      matchReason: ['Dependency']
    }));

    return await this.buildContext(results, `Dependencies of ${symbol.name}`);
  }

  /**
   * Build AI context from search results.
   */
  private async buildContext(
    results: SymbolSearchResult[],
    query: string
  ): Promise<AIContext> {
    // Take top results (max 5 primary)
    const primaryResults = results.slice(0, 5);
    const primary = primaryResults.map((r) => r.symbol);

    // Get related symbols (dependencies and usages)
    const related = await this.getRelatedSymbols(primary);

    // Collect unique files
    const files = new Set<string>();
    for (const symbol of [...primary, ...related]) {
      files.add(symbol.file);
    }

    // Generate code snippets for the most relevant symbols
    const codeSnippets = await this.generateCodeSnippets(primary, query);

    // Calculate confidence score
    const confidence = this.calculateConfidence(results);

    // Generate summary
    const summary = this.generateSummary(primary, related, query);

    const context: AIContext = {
      primary,
      related,
      files: Array.from(files),
      codeSnippets,
      summary,
      confidence
    };

    this.logger.debug('AI Context generated', {
      primarySymbols: primary.length,
      relatedSymbols: related.length,
      files: files.size,
      snippets: codeSnippets.length,
      confidence
    });

    return context;
  }

  /**
   * Get related symbols (dependencies and usages).
   */
  private async getRelatedSymbols(symbols: SymbolInfo[]): Promise<SymbolInfo[]> {
    const related: SymbolInfo[] = [];
    const seen = new Set<string>();

    for (const symbol of symbols) {
      // Add symbols from dependencies
      if (symbol.dependencies) {
        for (const dep of symbol.dependencies) {
          if (!dep.isExternal && dep.source) {
            const results = this.indexManager.search({
              exactName: dep.name,
              file: dep.source,
              limit: 1
            });

            if (results.length > 0 && !seen.has(results[0].symbol.id)) {
              related.push(results[0].symbol);
              seen.add(results[0].symbol.id);
            }
          }
        }
      }

      // Add symbols that use this symbol
      if (symbol.usages) {
        for (const usage of symbol.usages.slice(0, 3)) {
          // Max 3 usages
          const fileSymbols = this.indexManager.getSymbolsInFile(usage.file);

          for (const fileSymbol of fileSymbols) {
            if (
              fileSymbol.location.startLine <= usage.location.startLine &&
              fileSymbol.location.endLine >= usage.location.endLine &&
              !seen.has(fileSymbol.id)
            ) {
              related.push(fileSymbol);
              seen.add(fileSymbol.id);
              break;
            }
          }
        }
      }
    }

    return related.slice(0, 10); // Max 10 related symbols
  }

  /**
   * Generate code snippets for symbols.
   */
  private async generateCodeSnippets(
    symbols: SymbolInfo[],
    query: string
  ): Promise<CodeSnippet[]> {
    const snippets: CodeSnippet[] = [];

    for (const symbol of symbols) {
      try {
        const content = await fs.promises.readFile(symbol.file, 'utf-8');
        const lines = content.split('\n');

        // Extract the symbol's code
        const startLine = symbol.location.startLine;
        const endLine = symbol.location.endLine;

        // Add some context lines (3 before, 3 after)
        const contextStart = Math.max(0, startLine - 3);
        const contextEnd = Math.min(lines.length - 1, endLine + 3);

        const code = lines.slice(contextStart, contextEnd + 1).join('\n');

        snippets.push({
          file: symbol.file,
          startLine: contextStart,
          endLine: contextEnd,
          code,
          relevance: this.explainRelevance(symbol, query),
          symbolId: symbol.id
        });
      } catch (error) {
        this.logger.error(`Failed to read file: ${symbol.file}`, error);
      }
    }

    return snippets;
  }

  /**
   * Explain why a symbol is relevant to the query.
   */
  private explainRelevance(symbol: SymbolInfo, _query: string): string {
    const reasons: string[] = [];

    if (symbol.scope === 'export') {
      reasons.push('Exported symbol');
    }

    if (symbol.documentation) {
      reasons.push('Has documentation');
    }

    if (symbol.kind === 'function' || symbol.kind === 'component') {
      reasons.push('Key functionality');
    }

    if (reasons.length === 0) {
      reasons.push('Matched search query');
    }

    return reasons.join(', ');
  }

  /**
   * Calculate confidence score for context.
   */
  private calculateConfidence(results: SymbolSearchResult[]): number {
    if (results.length === 0) return 0;

    // Average of top 3 scores
    const topScores = results.slice(0, 3).map((r) => r.score);
    const avgScore = topScores.reduce((sum, s) => sum + s, 0) / topScores.length;

    // Boost confidence if we have multiple good matches
    const boost = Math.min(results.length / 10, 0.2);

    return Math.min(avgScore + boost, 1.0);
  }

  /**
   * Generate human-readable summary.
   */
  private generateSummary(
    primary: SymbolInfo[],
    related: SymbolInfo[],
    query: string
  ): string {
    const parts: string[] = [];

    parts.push(`Found ${primary.length} primary symbol(s) for: "${query}"`);

    if (primary.length > 0) {
      const mainSymbol = primary[0];
      parts.push(
        `\nMain: ${mainSymbol.name} (${mainSymbol.kind}) in ${this.getFileName(mainSymbol.file)}:${mainSymbol.location.startLine}`
      );

      if (mainSymbol.documentation) {
        const firstLine = mainSymbol.documentation.split('\n')[0];
        parts.push(`  ${firstLine}`);
      }
    }

    if (primary.length > 1) {
      parts.push(`\nOther matches:`);
      for (let i = 1; i < primary.length; i++) {
        const symbol = primary[i];
        parts.push(
          `  - ${symbol.name} in ${this.getFileName(symbol.file)}:${symbol.location.startLine}`
        );
      }
    }

    if (related.length > 0) {
      parts.push(`\n${related.length} related symbol(s):`);
      const relatedNames = related.slice(0, 5).map((s) => s.name);
      parts.push(`  ${relatedNames.join(', ')}${related.length > 5 ? '...' : ''}`);
    }

    return parts.join('\n');
  }

  /**
   * Get file name from path.
   */
  private getFileName(filePath: string): string {
    return filePath.split(/[\\/]/).pop() || filePath;
  }

  /**
   * Create empty context for no results.
   */
  private createEmptyContext(query: string): AIContext {
    return {
      primary: [],
      related: [],
      files: [],
      codeSnippets: [],
      summary: `No symbols found for: "${query}".\nThe symbol index might not be built yet, or the query doesn't match any code in the workspace.`,
      confidence: 0
    };
  }

  /**
   * Get cached context.
   */
  private getCachedContext(query: string): AIContext | undefined {
    const cached = this.contextCache.get(query);
    if (!cached) return undefined;

    // Check if cache is still valid (simple TTL check)
    // In a real implementation, you'd check timestamps
    return cached;
  }

  /**
   * Cache context for query.
   */
  private cacheContext(query: string, context: AIContext): void {
    this.contextCache.set(query, context);

    // Simple cache size limit
    if (this.contextCache.size > 100) {
      // Remove oldest entry (first key)
      const firstKey = this.contextCache.keys().next().value;
      if (firstKey) {
        this.contextCache.delete(firstKey);
      }
    }
  }

  /**
   * Format context for AI consumption.
   * This creates a markdown string that AI can understand.
   */
  public formatContextForAI(context: AIContext): string {
    const parts: string[] = [];

    parts.push('# Code Context from Index\n');
    parts.push(context.summary);
    parts.push('\n');

    if (context.primary.length > 0) {
      parts.push('## Primary Symbols\n');
      for (const symbol of context.primary) {
        parts.push(`### ${symbol.name} (${symbol.kind})`);
        parts.push(`**Location:** \`${symbol.file}:${symbol.location.startLine}\``);

        if (symbol.signature) {
          parts.push(`**Signature:** \`${symbol.signature}\``);
        }

        if (symbol.documentation) {
          parts.push(`**Documentation:**\n${symbol.documentation}`);
        }

        parts.push('');
      }
    }

    if (context.related.length > 0) {
      parts.push('## Related Symbols\n');
      for (const symbol of context.related) {
        parts.push(
          `- **${symbol.name}** (${symbol.kind}) in \`${symbol.file}:${symbol.location.startLine}\``
        );
      }
      parts.push('');
    }

    if (context.codeSnippets.length > 0) {
      parts.push('## Code Snippets\n');
      for (const snippet of context.codeSnippets) {
        parts.push(`### ${this.getFileName(snippet.file)}:${snippet.startLine}-${snippet.endLine}`);
        parts.push(`*${snippet.relevance}*\n`);
        parts.push('```typescript');
        parts.push(snippet.code);
        parts.push('```\n');
      }
    }

    parts.push(`\n**Confidence:** ${Math.round(context.confidence * 100)}%`);
    parts.push(`**Files involved:** ${context.files.length}`);

    return parts.join('\n');
  }

  /**
   * Get usage statistics.
   */
  public getStats(): {
    totalQueries: number;
    cacheHits: number;
    cacheHitRate: number;
  } {
    return {
      totalQueries: this.usageCount,
      cacheHits: this.cacheHitCount,
      cacheHitRate: this.usageCount > 0 ? this.cacheHitCount / this.usageCount : 0
    };
  }

  /**
   * Clear cache.
   */
  public clearCache(): void {
    this.contextCache.clear();
    this.logger.info('Context cache cleared');
  }

  /**
   * Create a VSCode Command that AI MUST use to get context.
   */
  public registerAICommand(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand(
      'codepulse.getAIContext',
      async (query: string) => {
        if (!query || typeof query !== 'string') {
          vscode.window.showErrorMessage('Invalid query for AI context');
          return null;
        }

        const aiContext = await this.getContextForQuery(query);
        const formatted = this.formatContextForAI(aiContext);

        // Log to output channel for debugging
        const outputChannel = vscode.window.createOutputChannel('CodePulse AI Context');
        outputChannel.appendLine('='.repeat(80));
        outputChannel.appendLine(`Query: ${query}`);
        outputChannel.appendLine('='.repeat(80));
        outputChannel.appendLine(formatted);
        outputChannel.appendLine('');

        return {
          context: aiContext,
          formatted
        };
      }
    );

    context.subscriptions.push(command);

    this.logger.info('AI Context command registered: codepulse.getAIContext');
  }
}

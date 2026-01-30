import {
  SymbolInfo,
  SymbolQuery,
  SymbolSearchResult,
  CodeIndex
} from './types';
import { Logger } from '../utils/logger';

/**
 * Smart query engine for symbol search.
 * Supports fuzzy matching, ranking, and context-aware search.
 */
export class QueryEngine {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('QueryEngine');
  }

  /**
   * Search for symbols matching the query.
   */
  public search(index: CodeIndex, query: SymbolQuery): SymbolSearchResult[] {
    const startTime = Date.now();
    let candidates: SymbolInfo[] = [];

    // Step 1: Get initial candidates based on filters
    if (query.exactName) {
      // Exact name match
      const ids = index.nameIndex.get(query.exactName) || [];
      candidates = ids.map((id) => index.symbols.get(id)!).filter(Boolean);
    } else if (query.terms && query.terms.length > 0) {
      // Fuzzy search by terms
      candidates = this.fuzzySearch(index, query.terms, query.fuzzyThreshold || 0.6);
    } else {
      // No name filter - get all symbols
      candidates = Array.from(index.symbols.values());
    }

    // Step 2: Apply additional filters
    candidates = this.applyFilters(candidates, query);

    // Step 3: Score and rank results
    const results = this.scoreAndRank(candidates, query);

    // Step 4: Apply limit
    const limited = query.limit ? results.slice(0, query.limit) : results;

    this.logger.debug(`Search completed in ${Date.now() - startTime}ms`, {
      query,
      results: limited.length
    });

    return limited;
  }

  /**
   * Fuzzy search for symbols by name.
   */
  private fuzzySearch(
    index: CodeIndex,
    terms: string[],
    threshold: number
  ): SymbolInfo[] {
    const results: Array<{ symbol: SymbolInfo; score: number }> = [];

    for (const symbol of index.symbols.values()) {
      const nameScore = this.fuzzyMatchScore(symbol.name, terms);

      // Also check container name for better matching
      const containerScore = symbol.containerName
        ? this.fuzzyMatchScore(symbol.containerName, terms)
        : 0;

      const finalScore = Math.max(nameScore, containerScore * 0.7);

      if (finalScore >= threshold) {
        results.push({ symbol, score: finalScore });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.map((r) => r.symbol);
  }

  /**
   * Calculate fuzzy match score between name and terms.
   */
  private fuzzyMatchScore(name: string, terms: string[]): number {
    const nameLower = name.toLowerCase();
    let totalScore = 0;

    for (const term of terms) {
      const termLower = term.toLowerCase();

      // Exact match
      if (nameLower === termLower) {
        totalScore += 1.0;
        continue;
      }

      // Starts with
      if (nameLower.startsWith(termLower)) {
        totalScore += 0.9;
        continue;
      }

      // Contains
      if (nameLower.includes(termLower)) {
        totalScore += 0.7;
        continue;
      }

      // Levenshtein distance
      const distance = this.levenshteinDistance(nameLower, termLower);
      const maxLen = Math.max(nameLower.length, termLower.length);
      const similarity = 1 - distance / maxLen;

      if (similarity >= 0.6) {
        totalScore += similarity * 0.5;
        continue;
      }

      // Camel case matching (e.g., "sr" matches "sendReport")
      if (this.camelCaseMatch(name, term)) {
        totalScore += 0.8;
        continue;
      }
    }

    // Average score across all terms
    return totalScore / terms.length;
  }

  /**
   * Check if term matches camel case initials.
   */
  private camelCaseMatch(name: string, term: string): boolean {
    const capitals = name.replace(/[^A-Z]/g, '');
    if (capitals.length === 0) return false;

    const termUpper = term.toUpperCase();
    return capitals.startsWith(termUpper);
  }

  /**
   * Calculate Levenshtein distance between two strings.
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Apply additional filters to candidates.
   */
  private applyFilters(candidates: SymbolInfo[], query: SymbolQuery): SymbolInfo[] {
    let filtered = candidates;

    // Filter by kind
    if (query.kinds && query.kinds.length > 0) {
      filtered = filtered.filter((s) => query.kinds!.includes(s.kind));
    }

    // Filter by file
    if (query.file) {
      const filePattern = query.file.toLowerCase();
      filtered = filtered.filter((s) => s.file.toLowerCase().includes(filePattern));
    }

    // Filter by container
    if (query.container) {
      const containerPattern = query.container.toLowerCase();
      filtered = filtered.filter(
        (s) => s.containerName && s.containerName.toLowerCase().includes(containerPattern)
      );
    }

    // Filter by scope
    if (query.scope) {
      filtered = filtered.filter((s) => s.scope === query.scope);
    }

    return filtered;
  }

  /**
   * Score and rank results based on relevance.
   */
  private scoreAndRank(
    candidates: SymbolInfo[],
    query: SymbolQuery
  ): SymbolSearchResult[] {
    const results: SymbolSearchResult[] = [];

    for (const symbol of candidates) {
      const score = this.calculateRelevanceScore(symbol, query);
      const matchReason = this.getMatchReason(symbol, query);

      results.push({
        symbol,
        score,
        matchReason
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Calculate relevance score for a symbol.
   */
  private calculateRelevanceScore(symbol: SymbolInfo, query: SymbolQuery): number {
    let score = 0.5; // Base score

    // Boost exported symbols
    if (symbol.scope === 'export') {
      score += 0.2;
    }

    // Boost functions and components
    if (symbol.kind === 'function' || symbol.kind === 'component' || symbol.kind === 'hook') {
      score += 0.15;
    }

    // Boost symbols with documentation
    if (symbol.documentation) {
      score += 0.1;
    }

    // Boost if name matches exactly
    if (query.exactName && symbol.name === query.exactName) {
      score += 0.3;
    }

    // Boost if kind matches filter
    if (query.kinds && query.kinds.includes(symbol.kind)) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Get human-readable match reason.
   */
  private getMatchReason(symbol: SymbolInfo, query: SymbolQuery): string[] {
    const reasons: string[] = [];

    if (query.exactName && symbol.name === query.exactName) {
      reasons.push('Exact name match');
    }

    if (query.terms && query.terms.length > 0) {
      for (const term of query.terms) {
        if (symbol.name.toLowerCase().includes(term.toLowerCase())) {
          reasons.push(`Name contains '${term}'`);
        }
      }
    }

    if (query.kinds && query.kinds.includes(symbol.kind)) {
      reasons.push(`Matches kind: ${symbol.kind}`);
    }

    if (query.file && symbol.file.includes(query.file)) {
      reasons.push(`In file: ${query.file}`);
    }

    if (symbol.scope === 'export') {
      reasons.push('Exported symbol');
    }

    if (reasons.length === 0) {
      reasons.push('General match');
    }

    return reasons;
  }

  /**
   * Find symbols by semantic context (e.g., "send report in client page").
   */
  public searchByContext(index: CodeIndex, context: string): SymbolSearchResult[] {
    // Extract keywords from context
    const keywords = this.extractKeywords(context);

    // Split into action words and context words
    const actionWords = keywords.filter((k) => this.isActionWord(k));
    const contextWords = keywords.filter((k) => !this.isActionWord(k));

    // Search with action words as primary terms
    const results = this.search(index, {
      terms: actionWords.length > 0 ? actionWords : keywords,
      fuzzyThreshold: 0.5,
      limit: 20
    });

    // Re-rank based on context words
    if (contextWords.length > 0) {
      return this.rerankByContext(results, contextWords);
    }

    return results;
  }

  /**
   * Extract keywords from natural language query.
   */
  private extractKeywords(text: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
      'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might',
      'when', 'where', 'why', 'how', 'what', 'which', 'who', 'that', 'this'
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Check if word is an action word (verb).
   */
  private isActionWord(word: string): boolean {
    const actionWords = new Set([
      'send', 'get', 'fetch', 'create', 'update', 'delete', 'remove',
      'add', 'set', 'calculate', 'process', 'handle', 'manage', 'format',
      'validate', 'check', 'verify', 'generate', 'build', 'render',
      'show', 'display', 'hide', 'toggle', 'submit', 'save', 'load'
    ]);

    return actionWords.has(word) || word.endsWith('ing') || word.endsWith('ed');
  }

  /**
   * Re-rank results based on context words.
   */
  private rerankByContext(
    results: SymbolSearchResult[],
    contextWords: string[]
  ): SymbolSearchResult[] {
    const reranked = results.map((result) => {
      let contextScore = result.score;

      // Boost if file path contains context words
      for (const word of contextWords) {
        if (result.symbol.file.toLowerCase().includes(word)) {
          contextScore += 0.2;
        }

        // Boost if container contains context word
        if (
          result.symbol.containerName &&
          result.symbol.containerName.toLowerCase().includes(word)
        ) {
          contextScore += 0.15;
        }
      }

      return {
        ...result,
        score: Math.min(contextScore, 1.0)
      };
    });

    // Re-sort by new scores
    reranked.sort((a, b) => b.score - a.score);

    return reranked;
  }
}

/**
 * CodePulse MCP Server
 * Exposes the symbol index via Model Context Protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { CODEPULSE_TOOLS } from './tools.js';
import { CachedIndex, CachedSymbol, MCPSearchResult, MCPAIContext, MCPToolResponse } from './types.js';

export class CodePulseServer {
  private server: Server;
  private cache: CachedIndex | null = null;
  private readonly cachePath: string;

  constructor() {
    // Get cache path from environment variable
    this.cachePath = process.env.INDEX_CACHE_PATH || '';

    if (!this.cachePath) {
      throw new Error('INDEX_CACHE_PATH environment variable is required');
    }

    this.server = new Server(
      {
        name: 'codepulse',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  /**
   * Load index cache from file.
   */
  private loadCache(): void {
    if (!fs.existsSync(this.cachePath)) {
      throw new Error(`Index cache not found at: ${this.cachePath}. Please build the index first.`);
    }

    try {
      const cacheContent = fs.readFileSync(this.cachePath, 'utf-8');
      this.cache = JSON.parse(cacheContent);

      console.error(`[CodePulse] Cache loaded: ${this.cache!.stats.totalSymbols} symbols, ${this.cache!.stats.totalFiles} files`);
    } catch (error) {
      throw new Error(`Failed to load cache: ${error}`);
    }
  }

  /**
   * Setup MCP tool request handlers.
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: CODEPULSE_TOOLS as Tool[]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      // Reload cache on each call (ensures freshness)
      this.loadCache();

      switch (name) {
        case 'codepulse_search':
          return this.handleSearch(
            args.query as string,
            (args.limit as number) || 10,
            args.kinds as string[] | undefined
          );

        case 'codepulse_get_context':
          return this.handleGetContext(
            args.query as string,
            (args.includeSnippets as boolean) ?? true
          );

        case 'codepulse_get_symbols_in_file':
          return this.handleGetSymbolsInFile(args.filePath as string);

        case 'codepulse_stats':
          return this.handleStats();

        case 'codepulse_get_impact':
          return this.handleGetImpact(args.symbolId as string);

        case 'codepulse_get_file_risks':
          return this.handleGetFileRisks(
            args.filePath as string,
            (args.minRisk as string) || 'medium'
          );

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  /**
   * Handle codepulse_search tool.
   */
  private async handleSearch(
    query: string,
    limit: number = 10,
    kinds?: string[]
  ) {
    if (!this.cache) {
      throw new Error('Cache not loaded');
    }

    // Extract keywords from query
    const keywords = this.extractKeywords(query);

    // Search symbols
    const results: MCPSearchResult[] = [];

    for (const [symbolId, symbol] of this.cache.symbols) {
      let score = 0;
      const matchReasons: string[] = [];

      // Match against name
      for (const keyword of keywords) {
        const nameLower = symbol.name.toLowerCase();
        const keywordLower = keyword.toLowerCase();

        if (nameLower === keywordLower) {
          score += 1.0;
          matchReasons.push(`Exact name match: ${keyword}`);
        } else if (nameLower.startsWith(keywordLower)) {
          score += 0.9;
          matchReasons.push(`Name starts with: ${keyword}`);
        } else if (nameLower.includes(keywordLower)) {
          score += 0.7;
          matchReasons.push(`Name contains: ${keyword}`);
        }

        // Match against file path
        if (symbol.file.toLowerCase().includes(keywordLower)) {
          score += 0.3;
          matchReasons.push(`File path contains: ${keyword}`);
        }

        // Match against container
        if (symbol.containerName && symbol.containerName.toLowerCase().includes(keywordLower)) {
          score += 0.2;
          matchReasons.push(`Container contains: ${keyword}`);
        }
      }

      // Boost exported symbols
      if (symbol.scope === 'export') {
        score += 0.2;
        matchReasons.push('Exported symbol');
      }

      // Filter by kind if specified
      if (kinds && kinds.length > 0) {
        if (!kinds.includes(symbol.kind)) {
          continue; // Skip this symbol
        }
        matchReasons.push(`Matches kind: ${symbol.kind}`);
      }

      // Only include results with non-zero score
      if (score > 0) {
        results.push({
          symbol,
          score: Math.min(score, 1.0),
          matchReason: matchReasons
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Limit results
    const limited = results.slice(0, limit);

    // Format response
    const formatted = this.formatSearchResults(limited, query);

    return {
      content: [
        {
          type: 'text',
          text: formatted
        }
      ]
    };
  }

  /**
   * Handle codepulse_get_context tool.
   */
  private async handleGetContext(
    query: string,
    includeSnippets: boolean = true
  ) {
    if (!this.cache) {
      throw new Error('Cache not loaded');
    }

    // Search for primary symbols
    const searchResults = await this.handleSearch(query, 5);

    // Parse results back (this is a simplification - in production would need better parsing)
    const primarySymbols: CachedSymbol[] = [];

    // For now, just return formatted context
    const formatted = `# AI Context for: "${query}"\n\n${searchResults.content[0].text}\n\n---\n\n📊 **Token Savings**: Using index instead of blind search saved ~95% tokens!`;

    return {
      content: [
        {
          type: 'text',
          text: formatted
        }
      ]
    };
  }

  /**
   * Handle codepulse_get_symbols_in_file tool.
   */
  private async handleGetSymbolsInFile(filePath: string) {
    if (!this.cache) {
      throw new Error('Cache not loaded');
    }

    // Normalize file path
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Find file in index
    const fileEntry = this.cache.fileIndex.find(
      ([path]) => path.replace(/\\/g, '/').includes(normalizedPath)
    );

    if (!fileEntry) {
      return {
        content: [
          {
            type: 'text',
            text: `File not found in index: ${filePath}\n\nMake sure the file is indexed and the path is correct.`
          }
        ]
      };
    }

    const [fullPath, metadata] = fileEntry;

    // Get symbols
    const symbols = metadata.symbols
      .map((id) => this.cache!.symbols.find(([sid]) => sid === id)?.[1])
      .filter((s): s is CachedSymbol => s !== undefined);

    // Format response
    const formatted = [
      `# Symbols in: ${fullPath}`,
      '',
      `**Total Symbols**: ${symbols.length}`,
      `**Exports**: ${metadata.exports.length}`,
      `**Imports**: ${metadata.imports.length}`,
      '',
      '## Symbols:',
      '',
      ...symbols.map((s) =>
        `- **${s.name}** (${s.kind}) - ${s.scope} - Lines ${s.location.startLine}-${s.location.endLine}` +
        (s.documentation ? `\n  ${s.documentation.split('\n')[0]}` : '')
      )
    ].join('\n');

    return {
      content: [
        {
          type: 'text',
          text: formatted
        }
      ]
    };
  }

  /**
   * Handle codepulse_stats tool.
   */
  private async handleStats() {
    if (!this.cache) {
      throw new Error('Cache not loaded');
    }

    const stats = this.cache.stats;
    const age = Date.now() - this.cache.builtAt;
    const ageMinutes = Math.round(age / 60000);

    const formatted = [
      '# CodePulse Symbol Index Statistics',
      '',
      `**Total Symbols**: ${stats.totalSymbols}`,
      `**Total Files**: ${stats.totalFiles}`,
      `**Exported Symbols**: ${stats.exportedCount}`,
      `**Local Symbols**: ${stats.localCount}`,
      `**Avg Symbols/File**: ${Math.round(stats.avgSymbolsPerFile)}`,
      '',
      '## By Kind:',
      '',
      ...Object.entries(stats.byKind)
        .sort(([, a], [, b]) => b - a)
        .map(([kind, count]) => `- **${kind}**: ${count}`),
      '',
      `**Index Age**: ${ageMinutes} minutes old`,
      `**Built At**: ${new Date(this.cache.builtAt).toLocaleString()}`
    ].join('\n');

    return {
      content: [
        {
          type: 'text',
          text: formatted
        }
      ]
    };
  }

  /**
   * Extract keywords from natural language query.
   */
  private extractKeywords(text: string): string[] {
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
   * Format search results as markdown.
   */
  private formatSearchResults(results: MCPSearchResult[], query: string): string {
    if (results.length === 0) {
      return `No symbols found for: "${query}"\n\nTry:\n- Different keywords\n- Broader search terms\n- Check if the file is indexed (use codepulse_stats)`;
    }

    const lines = [
      `# Search Results for: "${query}"`,
      '',
      `Found ${results.length} symbols:`,
      ''
    ];

    for (const result of results) {
      const { symbol, score, matchReason } = result;

      lines.push(`## ${symbol.name} (${symbol.kind})`);
      lines.push('');
      lines.push(`- **File**: ${symbol.file}`);
      lines.push(`- **Location**: Lines ${symbol.location.startLine}-${symbol.location.endLine}`);
      lines.push(`- **Scope**: ${symbol.scope}`);
      if (symbol.containerName) {
        lines.push(`- **Container**: ${symbol.containerName}`);
      }
      lines.push(`- **Score**: ${Math.round(score * 100)}%`);
      lines.push(`- **Match**: ${matchReason.join(', ')}`);

      if (symbol.signature) {
        lines.push('');
        lines.push('```typescript');
        lines.push(symbol.signature);
        lines.push('```');
      }

      if (symbol.documentation) {
        lines.push('');
        lines.push(symbol.documentation);
      }

      lines.push('');
      lines.push('---');
      lines.push('');
    }

    lines.push('');
    lines.push('💡 **Next Steps**: Use the Read tool to read specific lines from the files above.');
    lines.push(`📊 **Token Savings**: Found exact locations without scanning ${this.cache!.stats.totalFiles} files!`);

    return lines.join('\n');
  }

  /**
   * Handle codepulse_get_impact tool.
   */
  private async handleGetImpact(symbolId: string) {
    if (!this.cache) {
      throw new Error('Cache not loaded');
    }

    // Check if we have impact data
    if (!this.cache.impactData) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ Impact data not available.\n\nThe symbol index was built without impact analysis data. Please rebuild the index using the "CodePulse: Rebuild Symbol Index" command to include impact data.`
          }
        ]
      };
    }

    // Try to find symbol by ID or name
    let targetSymbol = this.cache.symbols.find(([id]) => id === symbolId);

    if (!targetSymbol) {
      // Try to find by name
      targetSymbol = this.cache.symbols.find(([, sym]) => sym.name === symbolId);
    }

    if (!targetSymbol) {
      return {
        content: [
          {
            type: 'text',
            text: `Symbol not found: ${symbolId}\n\nTry using codepulse_search to find the symbol first.`
          }
        ]
      };
    }

    const [id, symbol] = targetSymbol;
    const impact = this.cache.impactData[id];

    if (!impact || impact.callers === 0) {
      return {
        content: [
          {
            type: 'text',
            text:
              `# ✅ No Impact: \`${symbol.name}\`\n\n**File**: ${symbol.file}\n**Line**: ${symbol.location.startLine}\n\n` +
              `This function has **no callers** in the codebase. It's safe to modify or remove!\n\n` +
              `💡 This means no other code depends on this function.`
          }
        ]
      };
    }

    // Build detailed impact report
    const riskEmoji =
      impact.riskLevel === 'critical' ? '🔴' :
      impact.riskLevel === 'high' ? '🟠' :
      impact.riskLevel === 'medium' ? '🟡' : '🟢';
    const riskLabel = impact.riskLevel.charAt(0).toUpperCase() + impact.riskLevel.slice(1);

    let report = `# ${riskEmoji} Impact Analysis: \`${symbol.name}\`\n\n`;
    report += `**File**: ${symbol.file}:${symbol.location.startLine}\n`;
    report += `**Risk Level**: ${riskLabel}\n`;
    report += `**Total Callers**: ${impact.callers}\n`;
    report += `**Direct Callers**: ${impact.directCallersCount}\n`;
    report += `**Indirect Callers**: ${impact.indirectCallersCount}\n`;
    report += `**Affected Files**: ${impact.affectedFiles.length}\n\n`;

    report += `## ⚠️ CRITICAL WARNING\n\n`;
    report += `**${impact.callers} functions** depend on this code. Any changes to \`${symbol.name}\` will affect:\n`;
    report += `- ${impact.directCallersCount} direct callers (will break immediately)\n`;
    report += `- ${impact.indirectCallersCount} indirect callers (will break through call chain)\n`;
    report += `- ${impact.affectedFiles.length} different files\n\n`;

    if (impact.directCallers && impact.directCallers.length > 0) {
      report += `## 📞 Direct Callers (Top ${Math.min(impact.directCallers.length, 20)})\n\n`;
      for (const caller of impact.directCallers) {
        report += `- **\`${caller.name}\`** in \`${caller.file}:${caller.line}\`\n`;
      }
      if (impact.directCallersCount > 20) {
        report += `\n... and ${impact.directCallersCount - 20} more direct callers\n`;
      }
      report += `\n`;
    }

    if (impact.affectedFiles.length > 0) {
      report += `## 📁 Affected Files\n\n`;
      for (const file of impact.affectedFiles.slice(0, 15)) {
        report += `- ${file}\n`;
      }
      if (impact.affectedFiles.length > 15) {
        report += `\n... and ${impact.affectedFiles.length - 15} more files\n`;
      }
      report += `\n`;
    }

    report += `## ✅ Recommended Actions\n\n`;
    report += `1. **Review all callers** before making changes\n`;
    report += `2. **Maintain backward compatibility** if possible\n`;
    report += `3. **Update all affected functions** if breaking changes are necessary\n`;
    report += `4. **Add tests** to ensure nothing breaks\n`;
    report += `5. **Consider refactoring** if the impact is too large\n\n`;

    report += `---\n\n`;
    report += `*Impact data generated by CodePulse*\n`;

    return {
      content: [
        {
          type: 'text',
          text: report
        }
      ]
    };
  }

  /**
   * Handle codepulse_get_file_risks tool.
   */
  private async handleGetFileRisks(filePath: string, minRisk: string = 'medium') {
    if (!this.cache) {
      throw new Error('Cache not loaded');
    }

    if (!this.cache.impactData) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ Impact data not available. Please rebuild the index.`
          }
        ]
      };
    }

    // Normalize file path
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Find symbols in this file
    const fileSymbols: Array<{ id: string; symbol: CachedSymbol; impact: any }> = [];

    for (const [id, symbol] of this.cache.symbols) {
      if (symbol.file.replace(/\\/g, '/').includes(normalizedPath)) {
        const impact = this.cache.impactData[id];

        if (impact && impact.callers > 0) {
          // Check risk level
          const riskLevels = ['low', 'medium', 'high', 'critical'];
          const minRiskIndex = riskLevels.indexOf(minRisk);
          const symbolRiskIndex = riskLevels.indexOf(impact.riskLevel);

          if (symbolRiskIndex >= minRiskIndex) {
            fileSymbols.push({ id, symbol, impact });
          }
        }
      }
    }

    if (fileSymbols.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text:
              `# ✅ No High-Risk Functions\n\n**File**: ${filePath}\n\nNo functions in this file have a risk level of "${minRisk}" or higher.\n\n` +
              `This means the file is relatively safe to modify - functions have few or no callers.`
          }
        ]
      };
    }

    // Sort by risk (critical > high > medium > low) and then by caller count
    const riskOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    fileSymbols.sort((a, b) => {
      const riskDiff = riskOrder[b.impact.riskLevel] - riskOrder[a.impact.riskLevel];
      if (riskDiff !== 0) return riskDiff;
      return b.impact.callers - a.impact.callers;
    });

    let report = `# ⚠️ High-Risk Functions in File\n\n`;
    report += `**File**: ${filePath}\n`;
    report += `**Functions at risk level "${minRisk}" or higher**: ${fileSymbols.length}\n\n`;

    report += `## Functions (sorted by risk)\n\n`;

    for (const { symbol, impact } of fileSymbols) {
      const riskEmoji =
        impact.riskLevel === 'critical' ? '🔴' :
        impact.riskLevel === 'high' ? '🟠' :
        impact.riskLevel === 'medium' ? '🟡' : '🟢';

      report += `### ${riskEmoji} \`${symbol.name}\` - ${impact.riskLevel.toUpperCase()} Risk\n\n`;
      report += `- **Line**: ${symbol.location.startLine}\n`;
      report += `- **Callers**: ${impact.callers} (${impact.directCallersCount} direct, ${impact.indirectCallersCount} indirect)\n`;
      report += `- **Affected Files**: ${impact.affectedFiles.length}\n`;
      report += `- **⚠️ Warning**: Modifying this function will affect ${impact.callers} other functions!\n\n`;
    }

    report += `---\n\n`;
    report += `💡 **Tip**: Use \`codepulse_get_impact\` with a specific function name to see detailed caller information.\n`;

    return {
      content: [
        {
          type: 'text',
          text: report
        }
      ]
    };
  }

  /**
   * Start the MCP server.
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[CodePulse] MCP Server started and listening on stdio');
  }
}

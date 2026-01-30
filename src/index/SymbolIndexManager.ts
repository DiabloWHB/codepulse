import * as vscode from 'vscode';
import {
  CodeIndex,
  SymbolInfo,
  FileMetadata,
  SymbolKind,
  IndexStats,
  SymbolQuery,
  SymbolSearchResult,
  IndexProgress,
  IndexUpdate,
  ImportInfo,
  ExportInfo
} from './types';
import { QueryEngine } from './QueryEngine';
import { Logger } from '../utils/logger';
import { computeHash } from '../utils/hash';
import { isSupportedFile } from '../utils/paths';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Manages the symbol index for the workspace.
 * Provides fast symbol lookup, dependency tracking, and AI context generation.
 */
export class SymbolIndexManager {
  private index: CodeIndex;
  private queryEngine: QueryEngine;
  private readonly logger: Logger;
  private progressCallback?: (progress: IndexProgress) => void;
  private updateListeners: Array<(update: IndexUpdate) => void> = [];

  constructor() {
    this.logger = new Logger('SymbolIndexManager');
    this.queryEngine = new QueryEngine();
    this.index = this.createEmptyIndex();
  }

  /**
   * Create an empty index.
   */
  private createEmptyIndex(): CodeIndex {
    return {
      symbols: new Map(),
      nameIndex: new Map(),
      fileIndex: new Map(),
      kindIndex: new Map(),
      containerIndex: new Map(),
      builtAt: Date.now(),
      stats: {
        totalSymbols: 0,
        totalFiles: 0,
        byKind: {} as Record<SymbolKind, number>,
        exportedCount: 0,
        localCount: 0,
        avgSymbolsPerFile: 0
      }
    };
  }

  /**
   * Build the index for the entire workspace.
   */
  public async buildIndex(workspaceRoot: string): Promise<void> {
    this.logger.info('Building symbol index for workspace...');
    const startTime = Date.now();

    // Find all supported files
    const files = await this.findFiles(workspaceRoot);
    this.logger.info(`Found ${files.length} files to index`);

    // Clear existing index
    this.index = this.createEmptyIndex();

    let current = 0;
    const total = files.length;

    for (const file of files) {
      try {
        await this.indexFile(file);
        current++;

        // Report progress
        if (this.progressCallback) {
          const progress: IndexProgress = {
            total,
            current,
            currentFile: file,
            percentage: Math.round((current / total) * 100),
            estimatedTimeRemaining: this.estimateTimeRemaining(
              current,
              total,
              Date.now() - startTime
            )
          };
          this.progressCallback(progress);
        }
      } catch (error) {
        this.logger.error(`Failed to index file: ${file}`, error);
      }
    }

    // Update statistics
    this.updateStats();

    const duration = Date.now() - startTime;
    this.logger.info(`Index built in ${duration}ms`, {
      symbols: this.index.stats.totalSymbols,
      files: this.index.stats.totalFiles
    });
  }

  /**
   * Find all supported files in workspace.
   * Excludes build outputs, dependencies, and generated files.
   */
  private async findFiles(_workspaceRoot: string): Promise<string[]> {
    const files = await vscode.workspace.findFiles(
      '**/*.{ts,tsx,js,jsx}',
      '{**/node_modules/**,**/dist/**,**/build/**,**/.next/**,**/out/**,**/coverage/**,.git/**,**/.vscode-test/**,**/.turbo/**}'
    );

    return files.map((uri) => uri.fsPath).filter(isSupportedFile);
  }

  /**
   * Index a single file.
   */
  public async indexFile(filePath: string): Promise<void> {
    this.logger.debug(`Indexing file: ${filePath}`);

    // Read file content
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const hash = computeHash(content);

    // Check if file has changed
    const existingMeta = this.index.fileIndex.get(filePath);
    if (existingMeta && existingMeta.hash === hash) {
      this.logger.debug(`File unchanged, skipping: ${filePath}`);
      return;
    }

    // Remove old symbols if file was previously indexed
    if (existingMeta) {
      this.removeFileSymbols(filePath);
    }

    // Extract symbols from file
    const symbols = await this.extractSymbols(filePath, content);
    const imports = await this.extractImports(filePath, content);
    const exports = await this.extractExports(filePath, content);

    // Add symbols to index
    const symbolIds: string[] = [];
    for (const symbol of symbols) {
      this.addSymbol(symbol);
      symbolIds.push(symbol.id);
    }

    // Create file metadata
    const metadata: FileMetadata = {
      path: filePath,
      symbols: symbolIds,
      imports,
      exports,
      lastAnalyzed: Date.now(),
      hash,
      size: content.length
    };

    this.index.fileIndex.set(filePath, metadata);

    // Notify listeners
    this.notifyUpdate({
      type: existingMeta ? 'update' : 'add',
      file: filePath,
      symbolIds,
      timestamp: Date.now()
    });
  }

  /**
   * Extract symbols from file using VSCode's language server.
   */
  private async extractSymbols(filePath: string, _content: string): Promise<SymbolInfo[]> {
    const symbols: SymbolInfo[] = [];

    try {
      // Use VSCode's DocumentSymbolProvider
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        uri
      );

      if (!documentSymbols) {
        return symbols;
      }

      // Convert VSCode symbols to our format
      const processSymbol = (
        vsSymbol: vscode.DocumentSymbol,
        container?: vscode.DocumentSymbol
      ): void => {
        const line = vsSymbol.range.start.line;
        const symbolInfo: SymbolInfo = {
          id: `${filePath}:${line}:${vsSymbol.name}`,
          name: vsSymbol.name,
          kind: this.mapSymbolKind(vsSymbol.kind),
          file: filePath,
          location: {
            file: filePath,
            startLine: vsSymbol.range.start.line,
            startColumn: vsSymbol.range.start.character,
            endLine: vsSymbol.range.end.line,
            endColumn: vsSymbol.range.end.character
          },
          signature: this.extractSignature(document, vsSymbol),
          documentation: this.extractDocumentation(document, vsSymbol),
          scope: this.determineScope(document, vsSymbol),
          containerName: container?.name,
          containerKind: container ? this.mapSymbolKind(container.kind) : undefined,
          lastModified: Date.now()
        };

        symbols.push(symbolInfo);

        // Process children recursively
        if (vsSymbol.children) {
          for (const child of vsSymbol.children) {
            processSymbol(child, vsSymbol);
          }
        }
      };

      for (const symbol of documentSymbols) {
        processSymbol(symbol);
      }
    } catch (error) {
      this.logger.error(`Failed to extract symbols from ${filePath}`, error);
    }

    return symbols;
  }

  /**
   * Map VSCode SymbolKind to our SymbolKind.
   */
  private mapSymbolKind(kind: vscode.SymbolKind): SymbolKind {
    switch (kind) {
      case vscode.SymbolKind.Function:
        return 'function';
      case vscode.SymbolKind.Class:
        return 'class';
      case vscode.SymbolKind.Interface:
        return 'interface';
      case vscode.SymbolKind.Method:
        return 'method';
      case vscode.SymbolKind.Property:
        return 'property';
      case vscode.SymbolKind.Variable:
        return 'variable';
      case vscode.SymbolKind.Constant:
        return 'constant';
      case vscode.SymbolKind.TypeParameter:
        return 'type';
      default:
        return 'variable';
    }
  }

  /**
   * Extract function/method signature.
   */
  private extractSignature(
    document: vscode.TextDocument,
    symbol: vscode.DocumentSymbol
  ): string {
    const line = document.lineAt(symbol.range.start.line).text;
    return line.trim();
  }

  /**
   * Extract JSDoc documentation.
   */
  private extractDocumentation(
    document: vscode.TextDocument,
    symbol: vscode.DocumentSymbol
  ): string | undefined {
    const startLine = symbol.range.start.line;

    // Look for JSDoc comment above the symbol
    if (startLine > 0) {
      let docLines: string[] = [];
      let currentLine = startLine - 1;

      while (currentLine >= 0) {
        const lineText = document.lineAt(currentLine).text.trim();

        if (lineText.startsWith('*/')) {
          // Found end of JSDoc
          docLines.unshift(lineText);
          currentLine--;
          continue;
        }

        if (lineText.startsWith('*') || lineText.startsWith('/**')) {
          docLines.unshift(lineText);
          if (lineText.startsWith('/**')) {
            break; // Found start of JSDoc
          }
          currentLine--;
          continue;
        }

        // Not a comment line
        break;
      }

      if (docLines.length > 0) {
        return docLines.join('\n');
      }
    }

    return undefined;
  }

  /**
   * Determine if symbol is exported.
   */
  private determineScope(
    document: vscode.TextDocument,
    symbol: vscode.DocumentSymbol
  ): 'export' | 'local' {
    const line = document.lineAt(symbol.range.start.line).text;
    return line.includes('export') ? 'export' : 'local';
  }

  /**
   * Extract imports from file.
   */
  private async extractImports(filePath: string, content: string): Promise<ImportInfo[]> {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Match import statements
      const importMatch = line.match(
        /^import\s+(?:(type|typeof)\s+)?(?:(\w+)|(?:\{([^}]+)\})|(?:\*\s+as\s+(\w+)))\s+from\s+['"]([^'"]+)['"]/
      );

      if (importMatch) {
        const [, importType, defaultImport, namedImports, namespaceImport, source] = importMatch;

        const names: string[] = [];
        if (defaultImport) names.push(defaultImport);
        if (namedImports) {
          names.push(...namedImports.split(',').map((n) => n.trim().split(/\s+as\s+/)[0]));
        }
        if (namespaceImport) names.push(namespaceImport);

        imports.push({
          names,
          source,
          isDefault: !!defaultImport,
          isNamespace: !!namespaceImport,
          importType: importType === 'type' ? 'type' : 'value',
          location: {
            file: filePath,
            startLine: i,
            startColumn: 0,
            endLine: i,
            endColumn: line.length
          }
        });
      }
    }

    return imports;
  }

  /**
   * Extract exports from file.
   */
  private async extractExports(filePath: string, content: string): Promise<ExportInfo[]> {
    const exports: ExportInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Match export statements
      if (line.startsWith('export')) {
        const defaultMatch = line.match(/^export\s+default\s+(\w+)/);
        const namedMatch = line.match(/^export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/);
        const reexportMatch = line.match(/^export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);

        if (defaultMatch) {
          exports.push({
            name: defaultMatch[1],
            isDefault: true,
            isReExport: false,
            location: {
              file: filePath,
              startLine: i,
              startColumn: 0,
              endLine: i,
              endColumn: line.length
            }
          });
        } else if (namedMatch) {
          exports.push({
            name: namedMatch[1],
            isDefault: false,
            isReExport: false,
            location: {
              file: filePath,
              startLine: i,
              startColumn: 0,
              endLine: i,
              endColumn: line.length
            }
          });
        } else if (reexportMatch) {
          const names = reexportMatch[1].split(',').map((n) => n.trim());
          for (const name of names) {
            exports.push({
              name,
              isDefault: false,
              isReExport: true,
              source: reexportMatch[2],
              location: {
                file: filePath,
                startLine: i,
                startColumn: 0,
                endLine: i,
                endColumn: line.length
              }
            });
          }
        }
      }
    }

    return exports;
  }

  /**
   * Add a symbol to the index.
   */
  private addSymbol(symbol: SymbolInfo): void {
    // Add to main symbol map
    this.index.symbols.set(symbol.id, symbol);

    // Add to name index
    const nameList = this.index.nameIndex.get(symbol.name) || [];
    nameList.push(symbol.id);
    this.index.nameIndex.set(symbol.name, nameList);

    // Add to kind index
    const kindList = this.index.kindIndex.get(symbol.kind) || [];
    kindList.push(symbol.id);
    this.index.kindIndex.set(symbol.kind, kindList);

    // Add to container index
    if (symbol.containerName) {
      const containerList = this.index.containerIndex.get(symbol.containerName) || [];
      containerList.push(symbol.id);
      this.index.containerIndex.set(symbol.containerName, containerList);
    }
  }

  /**
   * Remove all symbols from a file.
   */
  private removeFileSymbols(filePath: string): void {
    const metadata = this.index.fileIndex.get(filePath);
    if (!metadata) return;

    for (const symbolId of metadata.symbols) {
      const symbol = this.index.symbols.get(symbolId);
      if (!symbol) continue;

      // Remove from main map
      this.index.symbols.delete(symbolId);

      // Remove from name index
      const nameList = this.index.nameIndex.get(symbol.name);
      if (nameList) {
        const filtered = nameList.filter((id) => id !== symbolId);
        if (filtered.length > 0) {
          this.index.nameIndex.set(symbol.name, filtered);
        } else {
          this.index.nameIndex.delete(symbol.name);
        }
      }

      // Remove from kind index
      const kindList = this.index.kindIndex.get(symbol.kind);
      if (kindList) {
        const filtered = kindList.filter((id) => id !== symbolId);
        if (filtered.length > 0) {
          this.index.kindIndex.set(symbol.kind, filtered);
        } else {
          this.index.kindIndex.delete(symbol.kind);
        }
      }

      // Remove from container index
      if (symbol.containerName) {
        const containerList = this.index.containerIndex.get(symbol.containerName);
        if (containerList) {
          const filtered = containerList.filter((id) => id !== symbolId);
          if (filtered.length > 0) {
            this.index.containerIndex.set(symbol.containerName, filtered);
          } else {
            this.index.containerIndex.delete(symbol.containerName);
          }
        }
      }
    }

    this.index.fileIndex.delete(filePath);
  }

  /**
   * Update index statistics.
   */
  private updateStats(): void {
    const stats: IndexStats = {
      totalSymbols: this.index.symbols.size,
      totalFiles: this.index.fileIndex.size,
      byKind: {} as Record<SymbolKind, number>,
      exportedCount: 0,
      localCount: 0,
      avgSymbolsPerFile: 0
    };

    // Count by kind and scope
    for (const symbol of this.index.symbols.values()) {
      stats.byKind[symbol.kind] = (stats.byKind[symbol.kind] || 0) + 1;

      if (symbol.scope === 'export') {
        stats.exportedCount++;
      } else {
        stats.localCount++;
      }
    }

    stats.avgSymbolsPerFile =
      stats.totalFiles > 0 ? stats.totalSymbols / stats.totalFiles : 0;

    this.index.stats = stats;
    this.index.builtAt = Date.now();
  }

  /**
   * Estimate remaining time for indexing.
   */
  private estimateTimeRemaining(
    current: number,
    total: number,
    elapsed: number
  ): number {
    if (current === 0) return 0;
    const avgTimePerFile = elapsed / current;
    const remaining = total - current;
    return Math.round(avgTimePerFile * remaining);
  }

  /**
   * Search for symbols.
   */
  public search(query: SymbolQuery): SymbolSearchResult[] {
    return this.queryEngine.search(this.index, query);
  }

  /**
   * Search by natural language context.
   */
  public searchByContext(context: string): SymbolSearchResult[] {
    return this.queryEngine.searchByContext(this.index, context);
  }

  /**
   * Get symbol by ID.
   */
  public getSymbol(id: string): SymbolInfo | undefined {
    return this.index.symbols.get(id);
  }

  /**
   * Get symbols in a file.
   */
  public getSymbolsInFile(filePath: string): SymbolInfo[] {
    const metadata = this.index.fileIndex.get(filePath);
    if (!metadata) return [];

    return metadata.symbols
      .map((id) => this.index.symbols.get(id))
      .filter((s): s is SymbolInfo => s !== undefined);
  }

  /**
   * Get index statistics.
   */
  public getStats(): IndexStats {
    return this.index.stats;
  }

  /**
   * Get the complete index (for debugging).
   */
  public getIndex(): CodeIndex {
    return this.index;
  }

  /**
   * Set progress callback.
   */
  public onProgress(callback: (progress: IndexProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Add update listener.
   */
  public onUpdate(listener: (update: IndexUpdate) => void): void {
    this.updateListeners.push(listener);
  }

  /**
   * Notify update listeners.
   */
  private notifyUpdate(update: IndexUpdate): void {
    for (const listener of this.updateListeners) {
      try {
        listener(update);
      } catch (error) {
        this.logger.error('Update listener failed', error);
      }
    }
  }

  /**
   * Export index to cache file for MCP server.
   */
  public async exportCache(cachePath: string): Promise<void> {
    try {
      // Ensure directory exists
      const cacheDir = path.dirname(cachePath);
      await fs.promises.mkdir(cacheDir, { recursive: true });

      // Convert Maps to arrays for JSON serialization
      const cache = {
        symbols: Array.from(this.index.symbols.entries()),
        nameIndex: Array.from(this.index.nameIndex.entries()),
        fileIndex: Array.from(this.index.fileIndex.entries()),
        kindIndex: Array.from(this.index.kindIndex.entries()),
        containerIndex: Array.from(this.index.containerIndex.entries()),
        stats: this.index.stats,
        builtAt: this.index.builtAt
      };

      // Write to file
      await fs.promises.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');

      this.logger.info(`Index cached to ${cachePath}`, {
        symbols: this.index.stats.totalSymbols,
        files: this.index.stats.totalFiles,
        size: `${Math.round((await fs.promises.stat(cachePath)).size / 1024)}KB`
      });
    } catch (error) {
      this.logger.error(`Failed to export cache to ${cachePath}`, error);
      throw error;
    }
  }

  /**
   * Clear the index.
   */
  public clear(): void {
    this.index = this.createEmptyIndex();
    this.logger.info('Index cleared');
  }
}

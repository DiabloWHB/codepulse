import * as vscode from 'vscode';
import { SymbolIndexManager } from './SymbolIndexManager';
import { Logger } from '../utils/logger';
import { debounce } from '../utils/debounce';
import { isSupportedFile } from '../utils/paths';

/**
 * Watches for file changes and updates the index in real-time.
 * Ensures the index is always up-to-date.
 */
export class IndexWatcher {
  private readonly indexManager: SymbolIndexManager;
  private readonly logger: Logger;
  private watcher?: vscode.FileSystemWatcher;
  private debouncedUpdate: (filePath: string) => void;
  private debouncedCacheExport: () => void;
  private updateQueue: Set<string> = new Set();
  private isProcessingQueue = false;
  private cachePath?: string;

  constructor(indexManager: SymbolIndexManager, debounceMs = 300) {
    this.indexManager = indexManager;
    this.logger = new Logger('IndexWatcher');

    // Debounce updates to avoid thrashing
    this.debouncedUpdate = debounce((filePath: string) => {
      this.queueUpdate(filePath);
    }, debounceMs);

    // Debounce cache export to avoid excessive writes
    this.debouncedCacheExport = debounce(() => {
      this.exportCache();
    }, 1000); // Export cache at most once per second
  }

  /**
   * Start watching for file changes.
   */
  public start(context: vscode.ExtensionContext, cachePath?: string): void {
    this.cachePath = cachePath;
    this.logger.info('Starting index watcher...');

    // Watch all TypeScript/JavaScript files
    this.watcher = vscode.workspace.createFileSystemWatcher(
      '**/*.{ts,tsx,js,jsx}',
      false, // Don't ignore creates
      false, // Don't ignore changes
      false  // Don't ignore deletes
    );

    // File created
    this.watcher.onDidCreate((uri) => {
      const filePath = uri.fsPath;
      if (this.shouldWatch(filePath)) {
        this.logger.debug(`File created: ${filePath}`);
        this.debouncedUpdate(filePath);
      }
    });

    // File changed
    this.watcher.onDidChange((uri) => {
      const filePath = uri.fsPath;
      if (this.shouldWatch(filePath)) {
        this.logger.debug(`File changed: ${filePath}`);
        this.debouncedUpdate(filePath);
      }
    });

    // File deleted
    this.watcher.onDidDelete((uri) => {
      const filePath = uri.fsPath;
      if (this.shouldWatch(filePath)) {
        this.logger.debug(`File deleted: ${filePath}`);
        this.handleFileDelete(filePath);
      }
    });

    // Also watch for active editor changes
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && this.shouldWatch(editor.document.uri.fsPath)) {
          const filePath = editor.document.uri.fsPath;
          // Index the file if not already indexed
          this.debouncedUpdate(filePath);
        }
      })
    );

    // Watch for document saves (more reliable than onDidChange)
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        const filePath = document.uri.fsPath;
        if (this.shouldWatch(filePath)) {
          this.logger.debug(`File saved: ${filePath}`);
          // Immediate update on save
          this.queueUpdate(filePath);
        }
      })
    );

    context.subscriptions.push(this.watcher);

    this.logger.info('Index watcher started');
  }

  /**
   * Check if we should watch this file.
   */
  private shouldWatch(filePath: string): boolean {
    // Skip node_modules and other common exclusions
    if (filePath.includes('node_modules')) return false;
    if (filePath.includes('.next')) return false;
    if (filePath.includes('dist')) return false;
    if (filePath.includes('build')) return false;
    if (filePath.includes('.git')) return false;

    return isSupportedFile(filePath);
  }

  /**
   * Queue a file for update.
   */
  private queueUpdate(filePath: string): void {
    this.updateQueue.add(filePath);
    this.processQueue();
  }

  /**
   * Process the update queue.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.updateQueue.size === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.updateQueue.size > 0) {
        // Get next file from queue
        const filePath = this.updateQueue.values().next().value;
        this.updateQueue.delete(filePath);

        // Update the file in index
        await this.updateFile(filePath);

        // Small delay to avoid blocking
        await this.sleep(10);
      }

      // Export cache after processing all updates (debounced)
      this.debouncedCacheExport();
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Update a single file in the index.
   */
  private async updateFile(filePath: string): Promise<void> {
    try {
      this.logger.debug(`Updating index for: ${filePath}`);
      const startTime = Date.now();

      await this.indexManager.indexFile(filePath);

      const duration = Date.now() - startTime;
      this.logger.debug(`Index updated in ${duration}ms: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to update index for ${filePath}`, error);
    }
  }

  /**
   * Handle file deletion.
   */
  private async handleFileDelete(filePath: string): Promise<void> {
    this.logger.info(`Removing from index: ${filePath}`);
    // The indexManager should have a method to remove a file
    // For now, we'll just log it
    // TODO: Implement removeFile in SymbolIndexManager
  }

  /**
   * Export cache for MCP server.
   */
  private async exportCache(): Promise<void> {
    if (!this.cachePath) {
      return; // Cache path not set
    }

    try {
      await this.indexManager.exportCache(this.cachePath);
      this.logger.debug('Cache exported successfully');
    } catch (error) {
      this.logger.error('Failed to export cache', error);
    }
  }

  /**
   * Sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Stop watching.
   */
  public stop(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = undefined;
    }

    this.updateQueue.clear();
    this.logger.info('Index watcher stopped');
  }

  /**
   * Get statistics.
   */
  public getStats(): {
    queueSize: number;
    isProcessing: boolean;
  } {
    return {
      queueSize: this.updateQueue.size,
      isProcessing: this.isProcessingQueue
    };
  }
}

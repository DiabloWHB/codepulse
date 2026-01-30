import { computeHash } from '../utils/hash';
import { Logger } from '../utils/logger';

interface CacheEntry<T> {
  value: T;
  contentHash: string;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

/**
 * LRU Cache with content-based invalidation.
 */
export class CacheManager<T = unknown> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly logger: Logger;
  private readonly maxSize: number;
  private readonly maxAge: number;

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0
  };

  constructor(maxSize: number = 100, maxAgeMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.maxAge = maxAgeMs;
    this.logger = new Logger('CacheManager');
  }

  /**
   * Get a cached value if valid.
   * Returns null if not found or content changed.
   */
  public get(key: string, currentContent?: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.createdAt > this.maxAge) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return null;
    }

    // Check if content changed (invalidation)
    if (currentContent !== undefined) {
      const currentHash = computeHash(currentContent);
      if (currentHash !== entry.contentHash) {
        this.cache.delete(key);
        this.stats.misses++;
        this.stats.size = this.cache.size;
        return null;
      }
    }

    // Update access info
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set a cached value.
   */
  public set(key: string, content: string, value: T): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      contentHash: computeHash(content),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Invalidate a specific key.
   */
  public invalidate(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  /**
   * Invalidate all keys matching a pattern.
   */
  public invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * Clear all cached entries.
   */
  public clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics.
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get hit rate (0-1).
   */
  public getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Evict least recently used entry.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
      this.logger.debug(`Evicted cache entry: ${oldestKey}`);
    }
  }

  /**
   * Check if key exists and is valid.
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() - entry.createdAt > this.maxAge) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get all keys.
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

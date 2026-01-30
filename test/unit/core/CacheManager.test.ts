import { describe, it, expect, beforeEach } from 'vitest';
import { CacheManager } from '../../../src/core/CacheManager';

describe('CacheManager', () => {
  let cache: CacheManager<string>;

  beforeEach(() => {
    cache = new CacheManager<string>(10, 60000);
  });

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'content1', 'value1');

      const result = cache.get('key1', 'content1');

      expect(result).toBe('value1');
    });

    it('should return null for missing keys', () => {
      const result = cache.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should invalidate on content change', () => {
      cache.set('key1', 'original content', 'value1');

      const result = cache.get('key1', 'changed content');

      expect(result).toBeNull();
    });

    it('should return value if content unchanged', () => {
      cache.set('key1', 'same content', 'value1');

      const result = cache.get('key1', 'same content');

      expect(result).toBe('value1');
    });
  });

  describe('expiration', () => {
    it('should expire old entries', () => {
      // Create cache with 1ms max age
      const shortCache = new CacheManager<string>(10, 1);
      shortCache.set('key1', 'content', 'value');

      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = shortCache.get('key1');
          expect(result).toBeNull();
          resolve();
        }, 10);
      });
    });
  });

  describe('LRU eviction', () => {
    it('should evict when cache is full', () => {
      const smallCache = new CacheManager<string>(3);

      smallCache.set('key1', 'c1', 'value1');
      smallCache.set('key2', 'c2', 'value2');
      smallCache.set('key3', 'c3', 'value3');

      // Cache is full, add key4 - should evict one item
      smallCache.set('key4', 'c4', 'value4');

      // Should still have 3 items (one was evicted)
      expect(smallCache.keys().length).toBe(3);
      // key4 should definitely exist
      expect(smallCache.has('key4')).toBe(true);
    });

    it('should track eviction count', () => {
      const smallCache = new CacheManager<string>(2);

      smallCache.set('key1', 'c1', 'value1');
      smallCache.set('key2', 'c2', 'value2');
      smallCache.set('key3', 'c3', 'value3'); // triggers eviction

      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('invalidate', () => {
    it('should invalidate specific key', () => {
      cache.set('key1', 'c1', 'value1');
      cache.set('key2', 'c2', 'value2');

      cache.invalidate('key1');

      expect(cache.get('key1', 'c1')).toBeNull();
      expect(cache.get('key2', 'c2')).toBe('value2');
    });

    it('should invalidate by pattern', () => {
      cache.set('/src/a.ts', 'c1', 'value1');
      cache.set('/src/b.ts', 'c2', 'value2');
      cache.set('/test/c.ts', 'c3', 'value3');

      const count = cache.invalidatePattern(/^\/src\//);

      expect(count).toBe(2);
      expect(cache.get('/test/c.ts', 'c3')).toBe('value3');
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'c1', 'value1');

      cache.get('key1', 'c1'); // hit
      cache.get('key1', 'c1'); // hit
      cache.get('key2'); // miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate', () => {
      cache.set('key1', 'c1', 'value1');

      cache.get('key1', 'c1'); // hit
      cache.get('key1', 'c1'); // hit
      cache.get('key2'); // miss
      cache.get('key3'); // miss

      expect(cache.getHitRate()).toBe(0.5);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'c1', 'value1');
      cache.set('key2', 'c2', 'value2');

      cache.clear();

      expect(cache.get('key1', 'c1')).toBeNull();
      expect(cache.get('key2', 'c2')).toBeNull();
    });
  });
});

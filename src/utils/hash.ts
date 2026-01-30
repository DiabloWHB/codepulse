import { createHash } from 'crypto';

/**
 * Compute a hash of content for cache invalidation.
 * Uses MD5 for speed (not cryptographic security).
 */
export function computeHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Compute a short hash (8 characters) for IDs.
 */
export function computeShortHash(content: string): string {
  return computeHash(content).substring(0, 8);
}

/**
 * Simple string hash function (djb2 algorithm).
 * Faster than crypto for non-security purposes.
 */
export function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Convert hash number to hex string.
 */
export function hashToHex(hash: number): string {
  return hash.toString(16).padStart(8, '0');
}

/**
 * Create a unique ID from multiple components.
 */
export function createUniqueId(...components: string[]): string {
  const combined = components.join('|');
  return hashToHex(simpleHash(combined));
}

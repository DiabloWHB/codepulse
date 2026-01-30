import * as path from 'path';
import { minimatch } from 'minimatch';

/**
 * Normalize path separators to forward slashes.
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Get relative path from workspace root.
 */
export function getRelativePath(filePath: string, workspaceRoot: string): string {
  const normalized = normalizePath(filePath);
  const normalizedRoot = normalizePath(workspaceRoot);

  if (normalized.startsWith(normalizedRoot)) {
    return normalized.substring(normalizedRoot.length + 1);
  }

  return path.relative(workspaceRoot, filePath);
}

/**
 * Get file extension (without dot).
 */
export function getExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext.startsWith('.') ? ext.substring(1) : ext;
}

/**
 * Check if file is TypeScript.
 */
export function isTypeScript(filePath: string): boolean {
  const ext = getExtension(filePath).toLowerCase();
  return ext === 'ts' || ext === 'tsx';
}

/**
 * Check if file is JavaScript.
 */
export function isJavaScript(filePath: string): boolean {
  const ext = getExtension(filePath).toLowerCase();
  return ext === 'js' || ext === 'jsx';
}

/**
 * Check if file is a supported language.
 */
export function isSupportedFile(filePath: string): boolean {
  return isTypeScript(filePath) || isJavaScript(filePath);
}

/**
 * Check if file path matches any of the patterns.
 */
export function matchesPatterns(filePath: string, patterns: string[]): boolean {
  const normalized = normalizePath(filePath);

  return patterns.some((pattern) => minimatch(normalized, pattern));
}

/**
 * Sanitize file path for logging (remove user home).
 */
export function sanitizePath(filePath: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  if (home && filePath.startsWith(home)) {
    return filePath.replace(home, '~');
  }
  return filePath;
}

/**
 * Get short display name for file (last 2 segments).
 */
export function getShortPath(filePath: string): string {
  const parts = normalizePath(filePath).split('/');
  return parts.slice(-2).join('/');
}

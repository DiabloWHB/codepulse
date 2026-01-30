import { describe, it, expect } from 'vitest';
import { minimatch } from 'minimatch';

// Note: ConfigManager tests require VS Code mock
// Basic tests focus on shouldAnalyzeFile logic

describe('ConfigManager', () => {
  describe('shouldAnalyzeFile', () => {
    const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    const excludePatterns = ['**/node_modules/**', '**/dist/**'];

    const shouldInclude = (filePath: string): boolean => {
      // Check excludes first
      for (const pattern of excludePatterns) {
        if (minimatch(filePath, pattern)) return false;
      }

      // Check includes
      for (const pattern of patterns) {
        if (minimatch(filePath, pattern)) return true;
      }

      return false;
    };

    it('should include TypeScript files by default pattern', () => {
      expect(shouldInclude('/src/test.ts')).toBe(true);
      expect(shouldInclude('/src/test.tsx')).toBe(true);
      expect(shouldInclude('/src/test.js')).toBe(true);
    });

    it('should exclude node_modules', () => {
      expect(shouldInclude('/node_modules/lodash/index.js')).toBe(false);
      expect(shouldInclude('/src/components/Button.tsx')).toBe(true);
    });

    it('should exclude dist folder', () => {
      expect(shouldInclude('/dist/bundle.js')).toBe(false);
      expect(shouldInclude('/src/index.ts')).toBe(true);
    });

    it('should not include non-JS/TS files', () => {
      expect(shouldInclude('/src/styles.css')).toBe(false);
      expect(shouldInclude('/src/data.json')).toBe(false);
    });
  });
});

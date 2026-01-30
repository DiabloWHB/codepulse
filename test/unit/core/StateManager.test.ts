import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../../../src/core/StateManager';
import { FileAnalysisResult, HealthStatus, CodeElementType } from '../../../src/types';

describe('StateManager', () => {
  let state: StateManager;

  beforeEach(() => {
    state = new StateManager();
  });

  function createMockResult(
    file: string,
    functions: Array<{ name: string; health: HealthStatus; calls?: Array<{ functionId: string; line: number }> }>
  ): FileAnalysisResult {
    return {
      file,
      contentHash: 'mock-hash',
      functions: functions.map((fn, index) => ({
        id: `${file}:${fn.name}:${index}`,
        name: fn.name,
        type: CodeElementType.FUNCTION,
        file,
        location: {
          file,
          startLine: index * 10,
          startColumn: 0,
          endLine: index * 10 + 5,
          endColumn: 0
        },
        health: fn.health,
        issues: [],
        calls: fn.calls?.map(c => ({ ...c, file, name: '', column: 0 })) || [],
        calledBy: [],
        imports: [],
        databaseTables: [],
        apiEndpoints: [],
        envVariables: [],
        isAsync: false,
        isExported: true,
        lastAnalyzedAt: Date.now()
      })),
      fileIssues: [],
      imports: [],
      exports: [],
      analysisDurationMs: 100,
      analyzedAt: Date.now()
    };
  }

  describe('file results', () => {
    it('should store and retrieve file results', () => {
      const result = createMockResult('/test.ts', [{ name: 'fn1', health: HealthStatus.HEALTHY }]);

      state.setFileResult('/test.ts', result);

      expect(state.getFileResult('/test.ts')).toBe(result);
    });

    it('should track analyzed files', () => {
      state.setFileResult('/a.ts', createMockResult('/a.ts', []));
      state.setFileResult('/b.ts', createMockResult('/b.ts', []));

      expect(state.getAnalyzedFiles()).toContain('/a.ts');
      expect(state.getAnalyzedFiles()).toContain('/b.ts');
    });
  });

  describe('function queries', () => {
    beforeEach(() => {
      state.setFileResult(
        '/a.ts',
        createMockResult('/a.ts', [
          { name: 'healthy', health: HealthStatus.HEALTHY },
          { name: 'warning', health: HealthStatus.WARNING }
        ])
      );
      state.setFileResult(
        '/b.ts',
        createMockResult('/b.ts', [{ name: 'error', health: HealthStatus.ERROR }])
      );
    });

    it('should get all functions', () => {
      const functions = state.getAllFunctions();
      expect(functions).toHaveLength(3);
    });

    it('should get functions by file', () => {
      const functions = state.getFunctionsByFile('/a.ts');
      expect(functions).toHaveLength(2);
    });

    it('should get functions by health', () => {
      const healthy = state.getFunctionsByHealth(HealthStatus.HEALTHY);
      expect(healthy).toHaveLength(1);
      expect(healthy[0].name).toBe('healthy');
    });
  });

  describe('summary', () => {
    it('should calculate summary statistics', () => {
      state.setFileResult(
        '/a.ts',
        createMockResult('/a.ts', [
          { name: 'h1', health: HealthStatus.HEALTHY },
          { name: 'h2', health: HealthStatus.HEALTHY },
          { name: 'w1', health: HealthStatus.WARNING }
        ])
      );
      state.setFileResult(
        '/b.ts',
        createMockResult('/b.ts', [{ name: 'e1', health: HealthStatus.ERROR }])
      );

      const summary = state.getSummary();

      expect(summary.totalFiles).toBe(2);
      expect(summary.totalFunctions).toBe(4);
      expect(summary.healthyCount).toBe(2);
      expect(summary.warningCount).toBe(1);
      expect(summary.errorCount).toBe(1);
    });
  });

  describe('events', () => {
    it('should emit analysis:completed event', () => {
      const callback = vi.fn();
      state.events.on('analysis:completed', callback);

      const result = createMockResult('/test.ts', []);
      state.setFileResult('/test.ts', result);

      expect(callback).toHaveBeenCalledWith({ file: '/test.ts', result });
    });

    it('should emit health:changed event', () => {
      const callback = vi.fn();
      state.events.on('health:changed', callback);

      // First result
      state.setFileResult(
        '/test.ts',
        createMockResult('/test.ts', [{ name: 'fn1', health: HealthStatus.HEALTHY }])
      );

      // Update with different health
      state.setFileResult(
        '/test.ts',
        createMockResult('/test.ts', [{ name: 'fn1', health: HealthStatus.ERROR }])
      );

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('dependency graph', () => {
    it('should build dependency graph', () => {
      state.setFileResult(
        '/a.ts',
        createMockResult('/a.ts', [
          { name: 'caller', health: HealthStatus.HEALTHY, calls: [{ functionId: '/a.ts:helper:1', line: 5 }] },
          { name: 'helper', health: HealthStatus.HEALTHY }
        ])
      );

      const graph = state.getGraph();

      expect(graph).not.toBeNull();
      expect(graph?.nodes.size).toBe(2);
    });

    it('should get impact analysis', () => {
      state.setFileResult(
        '/a.ts',
        createMockResult('/a.ts', [
          { name: 'caller', health: HealthStatus.HEALTHY, calls: [{ functionId: '/a.ts:helper:1', line: 5 }] },
          { name: 'helper', health: HealthStatus.HEALTHY }
        ])
      );

      const helperFn = state.getFunctionsByFile('/a.ts').find((f) => f.name === 'helper');
      const impact = state.getImpact(helperFn!.id);

      expect(impact).not.toBeNull();
      expect(impact!.directImpact).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should clear all state', () => {
      state.setFileResult('/test.ts', createMockResult('/test.ts', []));

      state.clear();

      expect(state.getAnalyzedFiles()).toHaveLength(0);
      expect(state.getGraph()).toBeNull();
    });
  });
});

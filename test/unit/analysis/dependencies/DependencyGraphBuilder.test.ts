import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraphBuilder } from '../../../../src/analysis/dependencies/DependencyGraphBuilder';
import { FileAnalysisResult, HealthStatus, CodeElementType, FunctionReference } from '../../../../src/types';

describe('DependencyGraphBuilder', () => {
  let builder: DependencyGraphBuilder;

  beforeEach(() => {
    builder = new DependencyGraphBuilder();
  });

  function createMockFileResult(
    file: string,
    functions: Array<{
      name: string;
      calls: string[];
      databaseTables?: string[];
      envVariables?: string[];
    }>
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
        health: HealthStatus.HEALTHY,
        issues: [],
        calls: fn.calls.map(
          (callName): FunctionReference => ({
            functionId: '',
            file: '',
            name: callName,
            line: 0,
            column: 0
          })
        ),
        calledBy: [],
        imports: [],
        databaseTables: fn.databaseTables || [],
        apiEndpoints: [],
        envVariables: fn.envVariables || [],
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

  describe('build', () => {
    it('should create nodes for all functions', () => {
      const files = new Map<string, FileAnalysisResult>([
        [
          '/src/a.ts',
          createMockFileResult('/src/a.ts', [
            { name: 'fnA', calls: [] },
            { name: 'fnB', calls: [] }
          ])
        ],
        ['/src/b.ts', createMockFileResult('/src/b.ts', [{ name: 'fnC', calls: [] }])]
      ]);

      const graph = builder.build(files);

      expect(graph.nodes.size).toBe(3);
      expect(graph.stats.totalFunctions).toBe(3);
    });

    it('should resolve call references', () => {
      const files = new Map<string, FileAnalysisResult>([
        ['/src/a.ts', createMockFileResult('/src/a.ts', [{ name: 'caller', calls: ['helper'] }])],
        ['/src/b.ts', createMockFileResult('/src/b.ts', [{ name: 'helper', calls: [] }])]
      ]);

      const graph = builder.build(files);

      // Find nodes
      const callerNode = Array.from(graph.nodes.values()).find((n) => n.name === 'caller');
      const helperNode = Array.from(graph.nodes.values()).find((n) => n.name === 'helper');

      // Caller should have helper in calls
      expect(callerNode?.calls).toHaveLength(1);
      expect(callerNode?.calls[0].name).toBe('helper');

      // Helper should have caller in calledBy
      expect(helperNode?.calledBy).toHaveLength(1);
      expect(helperNode?.calledBy[0].name).toBe('caller');
    });

    it('should build file index', () => {
      const files = new Map<string, FileAnalysisResult>([
        [
          '/src/utils.ts',
          createMockFileResult('/src/utils.ts', [
            { name: 'fn1', calls: [] },
            { name: 'fn2', calls: [] }
          ])
        ]
      ]);

      const graph = builder.build(files);

      const fileIndex = graph.fileIndex.get('/src/utils.ts');
      expect(fileIndex).toHaveLength(2);
    });

    it('should track external dependencies', () => {
      const files = new Map<string, FileAnalysisResult>([
        [
          '/src/api.ts',
          createMockFileResult('/src/api.ts', [
            {
              name: 'getUsers',
              calls: [],
              databaseTables: ['users'],
              envVariables: ['API_KEY']
            }
          ])
        ]
      ]);

      const graph = builder.build(files);

      const node = Array.from(graph.nodes.values())[0];
      expect(node.externalDeps).toHaveLength(2);

      const tablesDep = node.externalDeps.find((d) => d.type === 'supabase');
      expect(tablesDep?.details?.table).toBe('users');

      const envDep = node.externalDeps.find((d) => d.type === 'env');
      expect(envDep?.details?.envVar).toBe('API_KEY');
    });

    it('should build external dependency index', () => {
      const files = new Map<string, FileAnalysisResult>([
        ['/src/a.ts', createMockFileResult('/src/a.ts', [{ name: 'fn1', calls: [], databaseTables: ['users'] }])],
        ['/src/b.ts', createMockFileResult('/src/b.ts', [{ name: 'fn2', calls: [], databaseTables: ['users'] }])]
      ]);

      const graph = builder.build(files);

      const usersIndex = graph.externalDepIndex.get('supabase:users');
      expect(usersIndex).toHaveLength(2);
    });

    it('should handle circular dependencies', () => {
      const files = new Map<string, FileAnalysisResult>([
        ['/src/a.ts', createMockFileResult('/src/a.ts', [{ name: 'fnA', calls: ['fnB'] }])],
        [
          '/src/b.ts',
          createMockFileResult('/src/b.ts', [
            { name: 'fnB', calls: ['fnA'] } // Circular!
          ])
        ]
      ]);

      // Should not hang or crash
      const graph = builder.build(files);
      expect(graph.nodes.size).toBe(2);
    });
  });

  describe('stats', () => {
    it('should calculate connection statistics', () => {
      const files = new Map<string, FileAnalysisResult>([
        [
          '/src/a.ts',
          createMockFileResult('/src/a.ts', [
            { name: 'fn1', calls: ['fn2', 'fn3'] },
            { name: 'fn2', calls: ['fn3'] },
            { name: 'fn3', calls: [] }
          ])
        ]
      ]);

      const graph = builder.build(files);

      expect(graph.stats.totalConnections).toBe(3);
      expect(graph.stats.averageConnections).toBe(1);
    });
  });
});

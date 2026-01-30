import { describe, it, expect, beforeEach } from 'vitest';
import { ImpactAnalyzer } from '../../../../src/analysis/dependencies/ImpactAnalyzer';
import { DependencyGraphBuilder } from '../../../../src/analysis/dependencies/DependencyGraphBuilder';
import { FileAnalysisResult, HealthStatus, CodeElementType, FunctionReference } from '../../../../src/types';

describe('ImpactAnalyzer', () => {
  let analyzer: ImpactAnalyzer;
  let builder: DependencyGraphBuilder;

  beforeEach(() => {
    analyzer = new ImpactAnalyzer();
    builder = new DependencyGraphBuilder();
  });

  function createMockFileResult(
    file: string,
    functions: Array<{
      name: string;
      calls: string[];
      databaseTables?: string[];
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

  describe('analyzeFunction', () => {
    it('should find direct callers', () => {
      const files = new Map<string, FileAnalysisResult>([
        [
          '/src/a.ts',
          createMockFileResult('/src/a.ts', [
            { name: 'caller1', calls: ['target'] },
            { name: 'caller2', calls: ['target'] },
            { name: 'target', calls: [] }
          ])
        ]
      ]);

      const graph = builder.build(files);
      analyzer.setGraph(graph);

      const targetNode = Array.from(graph.nodes.values()).find((n) => n.name === 'target');
      const impact = analyzer.analyzeFunction(targetNode!.functionId);

      expect(impact).not.toBeNull();
      expect(impact!.directImpact).toHaveLength(2);
      expect(impact!.directImpact.map((n) => n.name)).toContain('caller1');
      expect(impact!.directImpact.map((n) => n.name)).toContain('caller2');
    });

    it('should find indirect callers', () => {
      // Chain: grandparent -> parent -> child
      const files = new Map<string, FileAnalysisResult>([
        [
          '/src/a.ts',
          createMockFileResult('/src/a.ts', [
            { name: 'grandparent', calls: ['parent'] },
            { name: 'parent', calls: ['child'] },
            { name: 'child', calls: [] }
          ])
        ]
      ]);

      const graph = builder.build(files);
      analyzer.setGraph(graph);

      const childNode = Array.from(graph.nodes.values()).find((n) => n.name === 'child');
      const impact = analyzer.analyzeFunction(childNode!.functionId);

      expect(impact!.directImpact).toHaveLength(1);
      expect(impact!.directImpact[0].name).toBe('parent');

      expect(impact!.indirectImpact).toHaveLength(1);
      expect(impact!.indirectImpact[0].name).toBe('grandparent');
    });

    it('should calculate correct risk level', () => {
      // Many callers = high risk
      const files = new Map<string, FileAnalysisResult>([
        [
          '/src/a.ts',
          createMockFileResult('/src/a.ts', [
            { name: 'c1', calls: ['target'] },
            { name: 'c2', calls: ['target'] },
            { name: 'c3', calls: ['target'] },
            { name: 'c4', calls: ['target'] },
            { name: 'c5', calls: ['target'] },
            { name: 'c6', calls: ['target'] },
            { name: 'c7', calls: ['target'] },
            { name: 'c8', calls: ['target'] },
            { name: 'c9', calls: ['target'] },
            { name: 'c10', calls: ['target'] },
            { name: 'c11', calls: ['target'] },
            { name: 'target', calls: [] }
          ])
        ]
      ]);

      const graph = builder.build(files);
      analyzer.setGraph(graph);

      const targetNode = Array.from(graph.nodes.values()).find((n) => n.name === 'target');
      const impact = analyzer.analyzeFunction(targetNode!.functionId);

      expect(impact!.riskLevel).toBe('high');
    });

    it('should list affected files', () => {
      const files = new Map<string, FileAnalysisResult>([
        ['/src/a.ts', createMockFileResult('/src/a.ts', [{ name: 'callerA', calls: ['target'] }])],
        ['/src/b.ts', createMockFileResult('/src/b.ts', [{ name: 'callerB', calls: ['target'] }])],
        ['/src/c.ts', createMockFileResult('/src/c.ts', [{ name: 'target', calls: [] }])]
      ]);

      const graph = builder.build(files);
      analyzer.setGraph(graph);

      const targetNode = Array.from(graph.nodes.values()).find((n) => n.name === 'target');
      const impact = analyzer.analyzeFunction(targetNode!.functionId);

      expect(impact!.affectedFiles).toContain('/src/a.ts');
      expect(impact!.affectedFiles).toContain('/src/b.ts');
      expect(impact!.affectedFiles).toContain('/src/c.ts');
    });
  });

  describe('analyzeTable', () => {
    it('should find all functions using a table', () => {
      const files = new Map<string, FileAnalysisResult>([
        ['/src/a.ts', createMockFileResult('/src/a.ts', [{ name: 'getUsers', calls: [], databaseTables: ['users'] }])],
        [
          '/src/b.ts',
          createMockFileResult('/src/b.ts', [{ name: 'updateUser', calls: [], databaseTables: ['users'] }])
        ],
        ['/src/c.ts', createMockFileResult('/src/c.ts', [{ name: 'getPosts', calls: [], databaseTables: ['posts'] }])]
      ]);

      const graph = builder.build(files);
      analyzer.setGraph(graph);

      const impact = analyzer.analyzeTable('users');

      expect(impact).not.toBeNull();
      expect(impact!.directImpact).toHaveLength(2);
      expect(impact!.directImpact.map((n) => n.name)).toContain('getUsers');
      expect(impact!.directImpact.map((n) => n.name)).toContain('updateUser');
      expect(impact!.directImpact.map((n) => n.name)).not.toContain('getPosts');
    });
  });

  describe('getHighImpactFunctions', () => {
    it('should return functions sorted by impact', () => {
      const files = new Map<string, FileAnalysisResult>([
        [
          '/src/a.ts',
          createMockFileResult('/src/a.ts', [
            { name: 'isolated', calls: [] },
            { name: 'lowImpact', calls: [] },
            { name: 'highImpact', calls: [] },
            { name: 'caller1', calls: ['highImpact'] },
            { name: 'caller2', calls: ['highImpact'] },
            { name: 'caller3', calls: ['highImpact'] },
            { name: 'caller4', calls: ['lowImpact'] }
          ])
        ]
      ]);

      const graph = builder.build(files);
      analyzer.setGraph(graph);

      const highImpact = analyzer.getHighImpactFunctions(3);

      expect(highImpact[0].name).toBe('highImpact');
    });
  });
});

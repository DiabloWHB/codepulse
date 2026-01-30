import { vi } from 'vitest';

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn(), dispose: vi.fn() })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
    visibleTextEditors: [],
    createStatusBarItem: vi.fn(() => ({
      show: vi.fn(),
      dispose: vi.fn(),
      text: '',
      tooltip: ''
    })),
    createTreeView: vi.fn(() => ({ dispose: vi.fn() }))
  },
  workspace: {
    getConfiguration: vi.fn(() => ({ get: vi.fn((k: string, d: unknown) => d) })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    workspaceFolders: [{ uri: { fsPath: '/test' } }]
  },
  languages: {
    createDiagnosticCollection: vi.fn(() => ({
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn()
    }))
  },
  Uri: { file: (p: string) => ({ fsPath: p }) },
  Range: vi.fn(),
  Position: vi.fn(),
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2 },
  StatusBarAlignment: { Right: 2 },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  EventEmitter: vi.fn(() => ({ event: vi.fn(), fire: vi.fn(), dispose: vi.fn() }))
}));

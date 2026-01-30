// Mock for VS Code API in tests

export const window = {
  createOutputChannel: () => ({
    appendLine: () => {},
    dispose: () => {}
  }),
  showInformationMessage: () => Promise.resolve(),
  showErrorMessage: () => Promise.resolve(),
  showWarningMessage: () => Promise.resolve()
};

export const workspace = {
  getConfiguration: () => ({
    get: <T>(key: string, defaultValue: T): T => defaultValue
  }),
  onDidChangeConfiguration: () => ({
    dispose: () => {}
  }),
  workspaceFolders: []
};

export const Uri = {
  file: (path: string) => ({ fsPath: path, path }),
  parse: (uri: string) => ({ fsPath: uri, path: uri })
};

export const Range = class {
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number
  ) {}
};

export const Position = class {
  constructor(
    public line: number,
    public character: number
  ) {}
};

export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3
};

export const Diagnostic = class {
  constructor(
    public range: typeof Range,
    public message: string,
    public severity: number
  ) {}
};

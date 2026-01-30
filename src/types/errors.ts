/**
 * Base error class for CodePulse.
 */
export class CodePulseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'CodePulseError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Parser errors.
 */
export class ParseError extends CodePulseError {
  constructor(
    message: string,
    public readonly file: string,
    public readonly position?: { line: number; column: number }
  ) {
    super(message, 'PARSE_ERROR', true);
    this.name = 'ParseError';
  }
}

/**
 * Configuration errors.
 */
export class ConfigError extends CodePulseError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', true);
    this.name = 'ConfigError';
  }
}

/**
 * Integration errors (Supabase, etc).
 */
export class IntegrationError extends CodePulseError {
  constructor(
    message: string,
    public readonly integration: string
  ) {
    super(message, 'INTEGRATION_ERROR', true);
    this.name = 'IntegrationError';
  }
}

/**
 * Analysis timeout error.
 */
export class TimeoutError extends CodePulseError {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message, 'TIMEOUT_ERROR', true);
    this.name = 'TimeoutError';
  }
}

/**
 * File not found error.
 */
export class FileNotFoundError extends CodePulseError {
  constructor(public readonly filePath: string) {
    super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', true);
    this.name = 'FileNotFoundError';
  }
}

/**
 * Graph error (circular dependency, etc).
 */
export class GraphError extends CodePulseError {
  constructor(
    message: string,
    public readonly nodeId?: string
  ) {
    super(message, 'GRAPH_ERROR', true);
    this.name = 'GraphError';
  }
}

/**
 * Type guard to check if error is a CodePulseError.
 */
export function isCodePulseError(error: unknown): error is CodePulseError {
  return error instanceof CodePulseError;
}

/**
 * Convert unknown error to Error instance.
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

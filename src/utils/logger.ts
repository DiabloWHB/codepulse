import * as vscode from 'vscode';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Logger class for CodePulse.
 * Logs to VS Code Output Channel.
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel | null = null;
  private static currentLevel: LogLevel = 'info';

  private readonly context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Initialize the global output channel.
   */
  public static initialize(level: LogLevel = 'info'): void {
    if (!Logger.outputChannel) {
      Logger.outputChannel = vscode.window.createOutputChannel('CodePulse');
    }
    Logger.currentLevel = level;
  }

  /**
   * Set the log level.
   */
  public static setLevel(level: LogLevel): void {
    Logger.currentLevel = level;
  }

  /**
   * Dispose the output channel.
   */
  public static dispose(): void {
    Logger.outputChannel?.dispose();
    Logger.outputChannel = null;
  }

  /**
   * Log a debug message.
   */
  public debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  /**
   * Log an info message.
   */
  public info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /**
   * Log a warning message.
   */
  public warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message.
   */
  public error(message: string, error?: Error | unknown): void {
    const errorData =
      error instanceof Error
        ? { error: error.message, stack: error.stack }
        : { error: String(error) };
    this.log('error', message, errorData);
  }

  /**
   * Internal log method.
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[Logger.currentLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;

    let logMessage = `${prefix} ${message}`;

    if (data && Object.keys(data).length > 0) {
      logMessage += ` ${JSON.stringify(data)}`;
    }

    Logger.outputChannel?.appendLine(logMessage);
  }
}

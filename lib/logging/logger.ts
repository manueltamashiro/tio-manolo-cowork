/**
 * Core Logger class with support for multiple transports and log levels
 */

import { LogLevel, type LogLevelName, type LogEntry, type LogContext, type LoggerOptions, type LogTransport } from './types';

const LOG_LEVEL_NAMES: Record<LogLevel, LogLevelName> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
};

const LOG_LEVEL_VALUES: Record<LogLevelName, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

const ANSI_COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Get log level from environment variable
 */
function getEnvLogLevel(): LogLevelName {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVEL_VALUES) {
    return envLevel as LogLevelName;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/**
 * Format a log entry for console output
 */
function formatConsoleLog(entry: LogEntry): string {
  const timestamp = new Date(entry.timestamp).toISOString();
  const level = entry.level.toUpperCase().padEnd(5);
  const source = entry.context?.source ? `[${entry.context.source}]` : '';

  let color = ANSI_COLORS.reset;
  if (entry.level === 'error') color = ANSI_COLORS.red;
  else if (entry.level === 'warn') color = ANSI_COLORS.yellow;
  else if (entry.level === 'info') color = ANSI_COLORS.cyan;
  else if (entry.level === 'debug') color = ANSI_COLORS.dim;

  let message = `${ANSI_COLORS.dim}${timestamp}${ANSI_COLORS.reset} ${color}${level}${ANSI_COLORS.reset} ${source} ${entry.message}`;

  if (entry.error) {
    message += `\n${ANSI_COLORS.red}Error: ${entry.error.message}${ANSI_COLORS.reset}`;
    if (entry.error.stack) {
      message += `\n${ANSI_COLORS.dim}${entry.error.stack}${ANSI_COLORS.reset}`;
    }
  }

  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    message += `\n${ANSI_COLORS.dim}${JSON.stringify(entry.metadata, null, 2)}${ANSI_COLORS.reset}`;
  }

  return message;
}

/**
 * Console transport for development
 */
class ConsoleTransport implements LogTransport {
  name = 'console';

  log(entry: LogEntry): void {
    const message = formatConsoleLog(entry);

    switch (entry.level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'info':
        console.info(message);
        break;
      default:
        console.log(message);
    }
  }
}

/**
 * Main Logger class
 */
export class Logger {
  private level: LogLevel;
  private transports: LogTransport[];
  private baseContext: LogContext;

  constructor(options: LoggerOptions = {}) {
    const envLevel = getEnvLogLevel();
    this.level = LOG_LEVEL_VALUES[options.level ?? envLevel];
    this.transports = options.transports ?? [new ConsoleTransport()];
    this.baseContext = options.context ?? {};
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  /**
   * Internal log method
   */
  private async log(level: LogLevel, message: string, error?: Error, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level: LOG_LEVEL_NAMES[level],
      message,
      timestamp: Date.now(),
      context: { ...this.baseContext },
      metadata,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    // Send to all transports
    await Promise.all(
      this.transports.map((transport) =>
        Promise.resolve(transport.log(entry)).catch((err) => {
          console.error(`Transport ${transport.name} failed:`, err);
        })
      )
    );
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): Promise<void> {
    return this.log(LogLevel.DEBUG, message, undefined, metadata);
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, unknown>): Promise<void> {
    return this.log(LogLevel.INFO, message, undefined, metadata);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): Promise<void> {
    return this.log(LogLevel.WARN, message, undefined, metadata);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, metadata?: Record<string, unknown>): Promise<void> {
    return this.log(LogLevel.ERROR, message, error, metadata);
  }

  /**
   * Log an API request
   */
  async logApiRequest(metadata: {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    userAgent?: string;
    ip?: string;
    userId?: string;
  }): Promise<void> {
    const level = metadata.statusCode >= 500 ? LogLevel.ERROR :
                  metadata.statusCode >= 400 ? LogLevel.WARN :
                  LogLevel.INFO;

    const message = `API ${metadata.method} ${metadata.path} ${metadata.statusCode} (${metadata.duration}ms)`;

    await this.log(level, message, undefined, metadata);
  }

  /**
   * Log a Claude API call
   */
  async logClaudeApiCall(metadata: {
    model: string;
    requestTokens?: number;
    responseTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    duration: number;
    streaming: boolean;
    error?: string;
  }): Promise<void> {
    const level = metadata.error ? LogLevel.ERROR : LogLevel.INFO;
    const mode = metadata.streaming ? 'streaming' : 'non-streaming';
    const message = `Claude API call (${mode}): ${metadata.model}`;

    await this.log(level, message, undefined, metadata);
  }

  /**
   * Log a file operation
   */
  async logFileOperation(metadata: {
    operation: 'read' | 'write' | 'delete' | 'list' | 'diff';
    path: string;
    success: boolean;
    duration?: number;
    size?: number;
    error?: string;
  }): Promise<void> {
    const level = !metadata.success ? LogLevel.ERROR :
                  metadata.operation === 'delete' ? LogLevel.WARN :
                  LogLevel.INFO;

    const message = `File operation ${metadata.operation}: ${metadata.path}`;

    await this.log(level, message, undefined, metadata);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger({
      level: LOG_LEVEL_NAMES[this.level],
      transports: this.transports,
      context: { ...this.baseContext, ...context },
    });
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.transports
        .filter((t) => t.flush)
        .map((t) => t.flush!())
    );
  }

  /**
   * Close all transports
   */
  async close(): Promise<void> {
    await Promise.all(
      this.transports
        .filter((t) => t.close)
        .map((t) => t.close!())
    );
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevelName): void {
    this.level = LOG_LEVEL_VALUES[level];
  }
}

// Default singleton instance
let defaultLogger: Logger | null = null;

/**
 * Get or create the default logger instance
 */
export function getLogger(options?: LoggerOptions): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger(options);
  }
  return defaultLogger;
}

/**
 * Reset the default logger (useful for testing)
 */
export function resetLogger(): void {
  if (defaultLogger) {
    defaultLogger.close();
    defaultLogger = null;
  }
}

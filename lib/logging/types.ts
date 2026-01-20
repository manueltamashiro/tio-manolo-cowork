/**
 * Logging system types
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export type LogLevelName = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevelName;
  message: string;
  timestamp: number;
  context?: LogContext;
  error?: ErrorInfo;
  metadata?: Record<string, unknown>;
}

export interface LogContext {
  source?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  route?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
}

export interface ErrorInfo {
  name?: string;
  message: string;
  stack?: string;
  code?: string | number;
}

export interface LogTransport {
  name: string;
  log(entry: LogEntry): Promise<void> | void;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

export interface LoggerOptions {
  level?: LogLevelName;
  transports?: LogTransport[];
  context?: LogContext;
}

export interface ApiLogEntry {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
  error?: string;
}

export interface ClaudeApiLogEntry {
  model: string;
  requestTokens?: number;
  responseTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  duration: number;
  streaming: boolean;
  error?: string;
}

export interface FileOperationLogEntry {
  operation: 'read' | 'write' | 'delete' | 'list' | 'diff';
  path: string;
  success: boolean;
  duration?: number;
  size?: number;
  error?: string;
}

export interface RequestContext {
  requestId: string;
  userAgent?: string;
  ip?: string;
}

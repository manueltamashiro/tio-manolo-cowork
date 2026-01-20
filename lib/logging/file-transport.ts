/**
 * File transport for persisting logs to disk
 */

import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { type LogEntry, type LogTransport } from './types';

export interface FileTransportOptions {
  logDir?: string;
  filename?: string;
  maxSize?: number;
  maxFiles?: number;
  json?: boolean;
}

const DEFAULT_OPTIONS = {
  logDir: process.cwd() + '/.data/logs',
  filename: 'app.log',
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  json: true,
};

/**
 * File transport that writes logs to rotating files
 */
export class FileTransport implements LogTransport {
  name = 'file';
  private logDir: string;
  private filename: string;
  private maxSize: number;
  private maxFiles: number;
  private json: boolean;
  private currentPath: string;
  private pendingWrites: Set<Promise<void>> = new Set();

  constructor(options: FileTransportOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.logDir = opts.logDir!;
    this.filename = opts.filename!;
    this.maxSize = opts.maxSize!;
    this.maxFiles = opts.maxFiles!;
    this.json = opts.json!;
    this.currentPath = join(this.logDir, this.filename);
  }

  /**
   * Initialize the log directory
   */
  private async init(): Promise<void> {
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true });
    }
  }

  /**
   * Format log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    if (this.json) {
      return JSON.stringify(entry) + '\n';
    }

    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const source = entry.context?.source ? `[${entry.context.source}]` : '';

    let message = `${timestamp} ${level} ${source} ${entry.message}`;

    if (entry.error) {
      message += `\nError: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n${entry.error.stack}`;
      }
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += `\n${JSON.stringify(entry.metadata)}`;
    }

    return message + '\n';
  }

  /**
   * Check if file needs rotation
   */
  private async needsRotation(): Promise<boolean> {
    try {
      const { stat } = await import('fs/promises');
      const stats = await stat(this.currentPath);
      return stats.size >= this.maxSize;
    } catch {
      return false;
    }
  }

  /**
   * Rotate log files
   */
  private async rotate(): Promise<void> {
    // Remove oldest file if it exists
    const oldestPath = join(this.logDir, `${this.filename}.${this.maxFiles}`);
    try {
      const { unlink } = await import('fs/promises');
      await unlink(oldestPath);
    } catch {
      // File doesn't exist, that's fine
    }

    // Rotate existing files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldPath = join(this.logDir, `${this.filename}.${i}`);
      const newPath = join(this.logDir, `${this.filename}.${i + 1}`);

      try {
        const { rename } = await import('fs/promises');
        await rename(oldPath, newPath);
      } catch {
        // File doesn't exist, that's fine
      }
    }

    // Move current file to .1
    const rotatedPath = join(this.logDir, `${this.filename}.1`);
    try {
      const { rename } = await import('fs/promises');
      await rename(this.currentPath, rotatedPath);
    } catch {
      // Current file doesn't exist yet, that's fine
    }
  }

  /**
   * Write log entry to file
   */
  async log(entry: LogEntry): Promise<void> {
    await this.init();

    // Check if rotation is needed
    if (await this.needsRotation()) {
      await this.rotate();
    }

    const data = this.formatEntry(entry);
    const writePromise = appendFile(this.currentPath, data);

    // Track pending writes
    this.pendingWrites.add(writePromise);
    writePromise.finally(() => {
      this.pendingWrites.delete(writePromise);
    });

    await writePromise;
  }

  /**
   * Flush all pending writes
   */
  async flush(): Promise<void> {
    await Promise.all(Array.from(this.pendingWrites));
  }

  /**
   * Close the transport (no-op for file transport)
   */
  async close(): Promise<void> {
    await this.flush();
  }
}

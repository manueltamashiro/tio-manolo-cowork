/**
 * File write utility with backup support
 */

import { existsSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { sanitizeFileName } from './file-operations';
import { createBackup as createBackupFile, type BackupOptions, type BackupResult } from './backup';
import { getLogger } from '@/lib/logging';

const logger = getLogger().child({ source: 'file-write' });

export interface FileWriteOptions {
  /** Content to write to the file */
  content: string;
  /** Encoding to use (default: 'utf8') */
  encoding?: BufferEncoding;
  /** Create backup before overwriting (default: true) */
  createBackup?: boolean;
  /** Backup options */
  backupOptions?: BackupOptions;
  /** Mode for file creation (default: 0o666) */
  mode?: number;
}

export interface FileWriteResponse {
  /** Full path of the written file */
  filePath: string;
  /** Name of the file */
  fileName: string;
  /** Whether the file was created or overwritten */
  action: 'created' | 'overwritten';
  /** Size of the file in bytes */
  size: number;
  /** Backup information (included if backup was created) */
  backup?: BackupResult;
}

/**
 * Check if a file exists at the given path
 */
function fileExists(filePath: string): boolean {
  try {
    const stats = statSync(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Write content to a file with optional backup
 *
 * @param filePath - Full path to the file to write
 * @param options - File write options
 * @returns FileWriteResponse with details about the write operation
 */
export function writeFile(
  filePath: string,
  options: FileWriteOptions
): FileWriteResponse {
  const startTime = Date.now();
  const {
    content = '',
    encoding = 'utf8',
    createBackup = true,
    backupOptions,
    mode = 0o666,
  } = options;

  // Validate file path
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }

  // Sanitize filename from path for security
  const sanitizedName = sanitizeFileName(basename(filePath));
  const targetPath = join(dirname(filePath), sanitizedName);

  // Check if file exists
  const fileExisted = fileExists(targetPath);
  let backupResult: BackupResult | undefined;

  // Create backup if file exists and backup is enabled
  if (fileExisted && createBackup) {
    try {
      backupResult = createBackupFile(targetPath, backupOptions);
    } catch (error) {
      // Log backup error but don't fail the write operation
      logger.warn(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Ensure parent directory exists
  const parentDir = dirname(targetPath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  // Write the file
  writeFileSync(targetPath, content, { encoding, mode });

  // Get file stats
  const stats = statSync(targetPath);

  const result: FileWriteResponse = {
    filePath: targetPath,
    fileName: basename(targetPath),
    action: fileExisted ? 'overwritten' : 'created',
    size: stats.size,
    backup: backupResult,
  };

  // Log the file operation
  logger.logFileOperation({
    operation: 'write',
    path: targetPath,
    success: true,
    size: stats.size,
    duration: Date.now() - startTime,
  });

  return result;
}

/**
 * Write content to a new file in a directory
 *
 * @param directoryPath - Directory where the file should be created
 * @param fileName - Name of the file to create
 * @param options - File write options
 * @returns FileWriteResponse with details about the write operation
 */
export function createFileWithBackup(
  directoryPath: string,
  fileName: string,
  options: FileWriteOptions
): FileWriteResponse {
  const {
    content = '',
    encoding = 'utf8',
    createBackup = true,
    backupOptions,
    mode = 0o666,
  } = options;

  // Validate inputs
  if (!directoryPath || typeof directoryPath !== 'string') {
    throw new Error('Invalid directory path');
  }

  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Invalid file name');
  }

  // Validate directory exists
  if (!existsSync(directoryPath)) {
    throw new Error(`Directory does not exist: ${directoryPath}`);
  }

  // Sanitize filename and construct full path
  const sanitizedName = sanitizeFileName(fileName);
  const targetPath = join(directoryPath, sanitizedName);

  // Write the file using the main writeFile function
  const result = writeFile(targetPath, {
    content,
    encoding,
    createBackup,
    backupOptions,
    mode,
  });

  return result;
}

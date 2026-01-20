/**
 * Queued File Operations - File operations wrapped with queue support
 * Integrates with the operation queue to prevent conflicts and show progress
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, basename } from 'path';
import { writeFile as writeFileDirect } from '@/lib/fs/write';
import { deleteFile as deleteFileDirect } from '@/lib/fs/delete';
import { listDirectory as listDirectoryDirect } from '@/lib/fs/directory';
import { validatePath } from '@/lib/fs/directory';
import type { OperationResult } from '@/types/queue';
import type { FileWriteResponse } from '@/lib/fs/write';
import type { DeleteResult } from '@/lib/fs/delete';
import type { FileSystemEntry } from '@/types/files';

// ==================== Types ====================

export interface QueuedWriteOptions {
  content: string;
  encoding?: BufferEncoding;
  createBackup?: boolean;
  onProgress?: (progress: number) => void;
}

export interface QueuedDeleteOptions {
  recursive?: boolean;
  onProgress?: (progress: number) => void;
}

export interface QueuedReadOptions {
  encoding?: BufferEncoding;
  onProgress?: (progress: number) => void;
}

// ==================== Queued Operations ====================

/**
 * Queued file read operation
 */
export async function readFileQueued(
  filePath: string,
  basePath: string | null,
  options: QueuedReadOptions = {}
): Promise<OperationResult<{ content: string; size: number }>> {
  const { encoding = 'utf8', onProgress } = options;

  try {
    onProgress?.(10);

    // Resolve and validate path
    const resolvedPath = resolve(filePath);

    onProgress?.(30);

    // Security check for path traversal if basePath is set
    if (basePath) {
      validatePath(basePath, resolvedPath);
    }

    onProgress?.(50);

    // Check file exists
    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    onProgress?.(70);

    // Check if it's a file (not a directory)
    const stats = statSync(resolvedPath);
    if (!stats.isFile()) {
      return {
        success: false,
        error: `Path is not a file: ${filePath}`,
      };
    }

    // Check file size (limit to 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (stats.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large: ${stats.size} bytes (max ${MAX_FILE_SIZE} bytes)`,
      };
    }

    onProgress?.(90);

    // Read file content
    const content = readFileSync(resolvedPath, encoding);

    onProgress?.(100);

    return {
      success: true,
      data: {
        content,
        size: stats.size,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Queued file write operation
 */
export async function writeFileQueued(
  filePath: string,
  options: QueuedWriteOptions
): Promise<OperationResult<FileWriteResponse>> {
  const { content, encoding, createBackup, onProgress } = options;

  try {
    onProgress?.(10);

    // Validate inputs
    if (!filePath || typeof filePath !== 'string') {
      return {
        success: false,
        error: 'Invalid file path',
      };
    }

    if (content === undefined || content === null) {
      return {
        success: false,
        error: 'Content is required',
      };
    }

    onProgress?.(30);

    // Perform the write operation
    const result = writeFileDirect(filePath, {
      content,
      encoding,
      createBackup,
    });

    onProgress?.(100);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Queued file delete operation
 */
export async function deleteFileQueued(
  basePath: string | null,
  filePath: string,
  options: QueuedDeleteOptions = {}
): Promise<OperationResult<DeleteResult>> {
  const { recursive, onProgress } = options;

  try {
    onProgress?.(10);

    // Validate inputs
    if (!filePath || typeof filePath !== 'string') {
      return {
        success: false,
        error: 'Invalid file path',
      };
    }

    onProgress?.(30);

    // Perform the delete operation
    const result = deleteFileDirect(basePath, filePath, { recursive });

    onProgress?.(100);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Queued directory list operation
 */
export async function listDirectoryQueued(
  dirPath: string,
  listOptions: {
    recursive?: boolean;
    includeHidden?: boolean;
    maxDepth?: number;
    extensions?: string[];
    fileTypes?: Array<'file' | 'directory' | 'symlink'>;
    onProgress?: (progress: number) => void;
  } = {}
): Promise<OperationResult<{ entries: FileSystemEntry[]; path: string; totalCount: number }>> {
  const { onProgress, ...options } = listOptions;

  try {
    onProgress?.(10);

    const resolvedPath = resolve(dirPath);

    onProgress?.(50);

    const entries = listDirectoryDirect(resolvedPath, options);

    onProgress?.(100);

    return {
      success: true,
      data: {
        entries,
        path: resolvedPath,
        totalCount: entries.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== Helper Functions ====================

/**
 * Format file path for display (truncate if too long)
 */
export function formatFilePath(filePath: string, maxLength = 40): string {
  if (filePath.length <= maxLength) return filePath;

  const parts = filePath.split(/[/\\]/);
  const fileName = parts[parts.length - 1];

  if (fileName.length > maxLength) {
    return fileName.substring(0, maxLength - 3) + '...';
  }

  // Show first directory and filename
  const firstDir = parts[0];
  return `${firstDir}/.../${fileName}`;
}

/**
 * Get a display name for a file operation
 */
export function getOperationDisplayName(type: string, filePath: string): string {
  const fileName = basename(filePath);
  const displayNames: Record<string, string> = {
    read_file: `Reading ${fileName}`,
    write_file: `Writing ${fileName}`,
    create_file: `Creating ${fileName}`,
    delete_file: `Deleting ${fileName}`,
    list_directory: `Listing ${fileName}`,
  };

  return displayNames[type] || `${type}: ${fileName}`;
}

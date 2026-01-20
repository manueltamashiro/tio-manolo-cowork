/**
 * File system utility functions for file deletion
 */

import { rmSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { validatePath } from './directory';
import { getLogger } from '@/lib/logging';

const logger = getLogger().child({ source: 'file-delete' });

/**
 * Delete options
 */
export interface DeleteOptions {
  /** Recursively delete directories (default: false) */
  recursive?: boolean;
  /** Create backup before deletion (default: false) */
  createBackup?: boolean;
}

/**
 * Delete result
 */
export interface DeleteResult {
  /** Whether the deletion was successful */
  success: boolean;
  /** Full path of the deleted file/directory */
  filePath: string;
  /** Name of the deleted file/directory */
  fileName: string;
  /** Size of the deleted item in bytes (for files) */
  size?: number;
  /** Whether the deleted item was a directory */
  isDirectory: boolean;
}

/**
 * Delete a file or directory with safety checks
 *
 * @param basePath - Base path for security validation (optional)
 * @param targetPath - Path to the file or directory to delete
 * @param options - Deletion options
 * @returns Delete result
 */
export function deleteFile(
  basePath: string | null,
  targetPath: string,
  options: DeleteOptions = {}
): DeleteResult {
  const startTime = Date.now();
  const resolvedTarget = resolve(targetPath);
  const fileName = resolvedTarget.split('/').pop() || resolvedTarget.split('\\').pop() || resolvedTarget;

  // Security check if basePath is provided
  if (basePath) {
    try {
      validatePath(basePath, resolvedTarget);
    } catch (error) {
      throw new Error(`Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Check if path exists
  if (!existsSync(resolvedTarget)) {
    logger.logFileOperation({
      operation: 'delete',
      path: targetPath,
      success: false,
      duration: Date.now() - startTime,
      error: 'File not found',
    });
    throw new Error(`File not found: ${targetPath}`);
  }

  // Check if it's a directory
  const stats = statSync(resolvedTarget);
  const isDirectory = stats.isDirectory();

  // For directories, require recursive option
  if (isDirectory && !options.recursive) {
    logger.logFileOperation({
      operation: 'delete',
      path: targetPath,
      success: false,
      duration: Date.now() - startTime,
      error: 'Cannot delete directory without recursive option',
    });
    throw new Error(`Cannot delete directory without recursive option. Use recursive: true to delete directories.`);
  }

  // Get size for files
  const size = isDirectory ? undefined : stats.size;

  // Delete the file or directory
  try {
    rmSync(resolvedTarget, {
      recursive: options.recursive || false,
      force: false, // Don't ignore errors
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.logFileOperation({
      operation: 'delete',
      path: targetPath,
      success: false,
      duration: Date.now() - startTime,
      error: errorMessage,
    });
    if (error instanceof Error) {
      throw new Error(`Failed to delete: ${error.message}`);
    }
    throw new Error('Failed to delete: Unknown error');
  }

  // Log successful deletion
  logger.logFileOperation({
    operation: 'delete',
    path: resolvedTarget,
    success: true,
    size,
    duration: Date.now() - startTime,
  });

  return {
    success: true,
    filePath: resolvedTarget,
    fileName,
    size,
    isDirectory,
  };
}

/**
 * Delete multiple files with batch safety check
 *
 * @param basePath - Base path for security validation
 * @param targetPaths - Array of paths to delete
 * @param options - Deletion options
 * @returns Array of delete results
 */
export function deleteFiles(
  basePath: string | null,
  targetPaths: string[],
  options: DeleteOptions = {}
): DeleteResult[] {
  const results: DeleteResult[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const path of targetPaths) {
    try {
      const result = deleteFile(basePath, path, options);
      results.push(result);
    } catch (error) {
      errors.push({
        path,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // If any errors occurred, throw with details
  if (errors.length > 0) {
    const errorMessages = errors.map((e) => `${e.path}: ${e.error}`).join('\n');
    throw new Error(`Some files could not be deleted:\n${errorMessages}`);
  }

  return results;
}

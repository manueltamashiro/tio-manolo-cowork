/**
 * File system utility functions for directory operations
 */

import { readdirSync, statSync, lstatSync, realpathSync, existsSync } from 'fs';
import { join, resolve, relative, dirname, basename } from 'path';
import * as path from 'path';
import type { FileSystemEntry, DirectoryListOptions, FileType } from '@/types/files';

/**
 * Maximum depth to prevent directory traversal attacks via deep nesting
 */
const MAX_DIRECTORY_DEPTH = 50;

/**
 * Forbidden path patterns that should never be accessed
 */
const FORBIDDEN_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /\.tio-manolo-backups/,
  /\.env$/,
  /\.env\./,
  /\/\.DS_Store$/,
];

/**
 * Enhanced security check to prevent path traversal and symlink attacks.
 * Resolves all symlinks to their real paths and validates boundaries.
 *
 * @param basePath - The base directory that defines the allowed boundary
 * @param targetPath - The target path to validate
 * @param allowNonExistent - If true, validates parent directory when target doesn't exist
 * @returns The validated, resolved real path
 * @throws Error if path validation fails
 */
export function validatePath(basePath: string, targetPath: string, allowNonExistent: boolean = false): string {
  if (!basePath || !targetPath) {
    throw new Error('Path validation failed: empty path provided');
  }

  // Resolve base path to real path
  const resolvedBase = resolve(basePath);

  // Check if base path exists
  if (!existsSync(resolvedBase)) {
    throw new Error(`Base path does not exist: ${basePath}`);
  }

  // Get real base path (resolves symlinks)
  let realBase: string;
  try {
    realBase = realpathSync(resolvedBase);
  } catch {
    realBase = resolvedBase;
  }

  // Check target path
  const resolvedTarget = resolve(targetPath);

  // If target doesn't exist, validate parent directory
  if (!existsSync(resolvedTarget)) {
    if (allowNonExistent) {
      const parentDir = dirname(resolvedTarget);
      return validatePath(basePath, parentDir, false);
    }
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  // Get real target path (resolves symlinks)
  let realTarget: string;
  try {
    realTarget = realpathSync(resolvedTarget);
  } catch {
    realTarget = resolvedTarget;
  }

  // Check for path traversal using relative path
  const relativePath = relative(realBase, realTarget);

  // Check if the relative path starts with '..' or is absolute (meaning it's outside base)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath) && relativePath !== realTarget) {
    throw new Error('Path traversal detected: access denied');
  }

  // Check for forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(realTarget)) {
      throw new Error(`Access to forbidden path detected: ${basename(realTarget)}`);
    }
  }

  // Check depth to prevent deep nesting attacks
  const pathComponents = relative(realBase, realTarget).split(/[\\/]/);
  if (pathComponents.length > MAX_DIRECTORY_DEPTH) {
    throw new Error(`Path depth exceeds maximum allowed depth of ${MAX_DIRECTORY_DEPTH}`);
  }

  return realTarget;
}

/**
 * Get file type from stats
 */
function getFileType(stats: { isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }): FileType {
  if (stats.isSymbolicLink()) return 'symlink';
  if (stats.isDirectory()) return 'directory';
  return 'file';
}

/**
 * Check if a file matches the filter criteria
 */
function matchesFilter(
  name: string,
  type: FileType,
  options: DirectoryListOptions
): boolean {
  // Check hidden files
  if (!options.includeHidden && name.startsWith('.')) {
    return false;
  }

  // Check file type filter
  if (options.fileTypes && options.fileTypes.length > 0) {
    if (!options.fileTypes.includes(type)) {
      return false;
    }
  }

  // Check extension filter (only applies to files)
  if (options.extensions && options.extensions.length > 0 && type === 'file') {
    const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
    if (!options.extensions.includes(ext)) {
      return false;
    }
  }

  return true;
}

/**
 * List a single directory (non-recursive)
 */
function listSingleDirectory(
  dirPath: string,
  basePath: string,
  options: DirectoryListOptions
): FileSystemEntry[] {
  const entries: FileSystemEntry[] = [];

  try {
    const files = readdirSync(dirPath);

    for (const file of files) {
      const fullPath = join(dirPath, file);
      const stats = lstatSync(fullPath);
      const type = getFileType(stats);

      if (!matchesFilter(file, type, options)) {
        continue;
      }

      const relativePath = relative(basePath, fullPath);

      entries.push({
        name: file,
        path: relativePath,
        type,
        size: type === 'file' ? stats.size : undefined,
        modified: stats.mtime,
      });
    }
  } catch (error) {
    // If directory doesn't exist or can't be read, return empty array
    if (error instanceof Error && 'code' in error) {
      throw error;
    }
  }

  return entries;
}

/**
 * List directory with recursive support
 */
function listDirectoryRecursive(
  dirPath: string,
  basePath: string,
  options: DirectoryListOptions,
  currentDepth: number = 0
): FileSystemEntry[] {
  const entries: FileSystemEntry[] = [];

  // Check max depth
  if (options.maxDepth !== undefined && currentDepth >= options.maxDepth) {
    return listSingleDirectory(dirPath, basePath, options);
  }

  try {
    const files = readdirSync(dirPath);

    for (const file of files) {
      const fullPath = join(dirPath, file);
      const stats = lstatSync(fullPath);
      const type = getFileType(stats);

      // Skip if doesn't match filter
      if (!matchesFilter(file, type, options)) {
        continue;
      }

      const relativePath = relative(basePath, fullPath);

      const entry: FileSystemEntry = {
        name: file,
        path: relativePath,
        type,
        size: type === 'file' ? stats.size : undefined,
        modified: stats.mtime,
      };

      // Recursively process subdirectories
      if (type === 'directory' && options.recursive) {
        entry.children = listDirectoryRecursive(
          fullPath,
          basePath,
          options,
          currentDepth + 1
        );
      }

      entries.push(entry);
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      throw error;
    }
  }

  return entries;
}

/**
 * Count total entries (including nested children)
 */
function countEntries(entries: FileSystemEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    count++;
    if (entry.children) {
      count += countEntries(entry.children);
    }
  }
  return count;
}

/**
 * List directory contents with filtering and recursive support
 *
 * @param dirPath - Absolute or relative path to directory
 * @param options - Options for filtering and recursion
 * @returns Array of file system entries
 */
export function listDirectory(
  dirPath: string,
  options: DirectoryListOptions = {}
): FileSystemEntry[] {
  const basePath = resolve(dirPath);

  // Validate directory exists
  try {
    const stats = statSync(basePath);
    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }
  } catch {
    throw new Error('Directory not found');
  }

  if (options.recursive) {
    return listDirectoryRecursive(basePath, basePath, options);
  }

  return listSingleDirectory(basePath, basePath, options);
}

/**
 * Get directory listing with metadata
 */
export function getDirectoryListing(
  dirPath: string,
  options: DirectoryListOptions = {}
): { entries: FileSystemEntry[]; path: string; totalCount: number } {
  const entries = listDirectory(dirPath, options);
  return {
    entries,
    path: resolve(dirPath),
    totalCount: countEntries(entries),
  };
}

/**
 * File system utility functions for file operations in Electron main process
 */

import { existsSync, writeFileSync, statSync, mkdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';

export interface FileCreateOptions {
  content: string;
  encoding?: BufferEncoding;
  onConflict?: 'error' | 'overwrite' | 'rename' | 'skip';
  mode?: number;
}

export interface FileCreateResponse {
  filePath: string;
  fileName: string;
  action: 'created' | 'skipped' | 'overwritten';
  size: number;
}

/**
 * Sanitize a filename to prevent path traversal and invalid characters
 */
export function sanitizeFileName(fileName: string): string {
  // Remove any path components (prevent path traversal)
  const cleanName = basename(fileName);

  // Remove characters that are invalid on Windows/Linux/macOS
  // Invalid: < > : " / \ | ? * and control characters
  return cleanName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

/**
 * Generate a unique filename if the original already exists
 */
export function generateUniqueFileName(filePath: string): string {
  if (!existsSync(filePath)) {
    return filePath;
  }

  const dir = dirname(filePath);
  const name = basename(filePath, extname(filePath));
  const ext = extname(filePath);

  let counter = 1;
  let newPath: string;

  do {
    newPath = join(dir, `${name} (${counter})${ext}`);
    counter++;
  } while (existsSync(newPath));

  return newPath;
}

/**
 * Create a file with the specified content in the given directory
 */
export function createFile(
  directoryPath: string,
  fileName: string,
  options: FileCreateOptions
): FileCreateResponse {
  const {
    content = '',
    encoding = 'utf8',
    onConflict = 'error',
    mode = 0o666,
  } = options;

  // Sanitize the filename to prevent security issues
  const sanitizedName = sanitizeFileName(fileName);

  // Construct the full file path
  let targetPath = join(directoryPath, sanitizedName);

  // Check if directory exists
  if (!existsSync(directoryPath)) {
    throw new Error(`Directory does not exist: ${directoryPath}`);
  }

  // Check if a file/directory with the same name exists
  const fileExists = existsSync(targetPath);

  if (fileExists) {
    // Handle existing file based on conflict resolution strategy
    switch (onConflict) {
      case 'error':
        throw new Error(`File already exists: ${sanitizedName}`);

      case 'skip':
        const stats = statSync(targetPath);
        return {
          filePath: targetPath,
          fileName: sanitizedName,
          action: 'skipped',
          size: stats.size,
        };

      case 'overwrite':
        // Proceed with overwriting
        break;

      case 'rename':
        targetPath = generateUniqueFileName(targetPath);
        break;
    }
  }

  // Ensure parent directory exists (create if needed)
  const parentDir = dirname(targetPath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  // Write the file
  writeFileSync(targetPath, content, { encoding, mode });

  // Get the final filename (may have changed due to rename)
  const finalFileName = basename(targetPath);
  const newStats = statSync(targetPath);

  return {
    filePath: targetPath,
    fileName: finalFileName,
    action: fileExists && onConflict === 'overwrite' ? 'overwritten' : 'created',
    size: newStats.size,
  };
}

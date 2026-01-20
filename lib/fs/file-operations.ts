/**
 * File system utility functions for file operations
 */

import { existsSync, writeFileSync, statSync, mkdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import type { FileCreateOptions, FileCreateResponse } from '@/types/files';

/**
 * Dangerous file extensions that should not be created by the application
 * These can be executables, scripts, or other potentially harmful files
 */
const DANGEROUS_EXTENSIONS = [
  '.exe', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm', '.dmg', '.pkg', '.msi',
  '.bat', '.cmd', '.sh', '.bash', '.ps1', '.vbs', '.js', '.jar', '.com', '.scr',
  '.pif', '.vb', '.vbe', '.ws', '.wsf', '.wsc', '.wsh', '.msc', '.url', '.lnk',
];

/**
 * Binary file extensions that should not be readable
 */
const BINARY_EXTENSIONS = [
  '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz', '.cab', '.iso',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.wav', '.ogg',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
];

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
 * Check if a file has a potentially dangerous extension
 */
export function isDangerousExtension(fileName: string): boolean {
  const ext = extname(fileName).toLowerCase();
  return DANGEROUS_EXTENSIONS.includes(ext);
}

/**
 * Check if a file is a binary file (should not be read as text)
 */
export function isBinaryFile(fileName: string): boolean {
  const ext = extname(fileName).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
}

/**
 * Generate a unique filename if the original already exists
 * Appends a number suffix before the extension: file (1).txt, file (2).txt, etc.
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
 *
 * @param directoryPath - Directory where the file should be created
 * @param fileName - Name of the file to create
 * @param options - File creation options
 * @returns FileCreateResponse with details about the created file
 * @throws Error if directory doesn't exist or on conflict with onConflict='error'
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

  // Security check: prevent creating dangerous executable files
  if (isDangerousExtension(sanitizedName)) {
    throw new Error(`Cannot create file with dangerous extension: ${extname(sanitizedName)}`);
  }

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

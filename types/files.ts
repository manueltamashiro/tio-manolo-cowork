/**
 * File system types for directory operations
 */

export type FileType = 'file' | 'directory' | 'symlink';

export interface FileSystemEntry {
  name: string;
  path: string;
  type: FileType;
  size?: number;
  modified?: Date;
  children?: FileSystemEntry[];
}

export interface DirectoryListOptions {
  /** Include hidden files (starting with .) */
  includeHidden?: boolean;
  /** Recursively list subdirectories */
  recursive?: boolean;
  /** Maximum depth for recursive listing (0 = unlimited) */
  maxDepth?: number;
  /** Filter by file extensions (e.g., ['.ts', '.tsx']) */
  extensions?: string[];
  /** Filter by file type */
  fileTypes?: FileType[];
}

export interface DirectoryListRequest {
  path: string;
  options?: DirectoryListOptions;
}

export interface DirectoryListResponse {
  entries: FileSystemEntry[];
  path: string;
  totalCount: number;
}

/**
 * File creation request options
 */
export interface FileCreateOptions {
  /** Content to write to the file */
  content: string;
  /** Encoding to use (default: 'utf8') */
  encoding?: BufferEncoding;
  /** How to handle naming conflicts */
  onConflict?: 'error' | 'overwrite' | 'rename' | 'skip';
  /** Mode for file creation (default: 0o666) */
  mode?: number;
}

/**
 * File creation request
 */
export interface FileCreateRequest {
  /** Directory path where the file should be created */
  directoryPath: string;
  /** Name of the file to create */
  fileName: string;
  /** File creation options */
  options: FileCreateOptions;
}

/**
 * File creation response
 */
export interface FileCreateResponse {
  /** Full path of the created file */
  filePath: string;
  /** Name of the file (may be modified if renamed due to conflict) */
  fileName: string;
  /** Whether the file was created, skipped, or overwritten */
  action: 'created' | 'skipped' | 'overwritten';
  /** Size of the created file in bytes */
  size: number;
}

/**
 * File read response
 */
export interface FileReadResponse {
  /** Full path of the file that was read */
  filePath: string;
  /** Name of the file */
  fileName: string;
  /** Content of the file as a string */
  content: string;
  /** Size of the file in bytes */
  size: number;
  /** Last modified date */
  modified: Date;
}

/**
 * File context for including in chat messages
 */
export interface FileContext {
  /** Path of the file */
  path: string;
  /** Name of the file */
  name: string;
  /** Content of the file */
  content: string;
  /** Line number range (optional) */
  lineRange?: {
    start: number;
    end: number;
  };
}

/**
 * File write request options
 */
export interface FileWriteOptions {
  /** Content to write to the file */
  content: string;
  /** Encoding to use (default: 'utf8') */
  encoding?: BufferEncoding;
  /** Mode for file writing (default: 0o666) */
  mode?: number;
}

/**
 * File write request
 */
export interface FileWriteRequest {
  /** Full path to the file to write */
  filePath: string;
  /** File write options */
  options: FileWriteOptions;
}

/**
 * File write response
 */
export interface FileWriteResponse {
  /** Full path of the written file */
  filePath: string;
  /** Name of the file */
  fileName: string;
  /** Size of the written file in bytes */
  size: number;
  /** Whether the file was created or overwritten */
  action: 'created' | 'overwritten';
  /** Backup information (included if backup was created) */
  backup?: BackupResult;
}

/**
 * Backup creation options
 */
export interface BackupOptions {
  /** Directory where backups are stored (default: .tio-manolo-backups) */
  backupDir?: string;
  /** Maximum number of backups to keep per file (default: 10) */
  maxBackups?: number;
}

/**
 * Backup creation result
 */
export interface BackupResult {
  /** Path to the backup file */
  backupPath: string;
  /** Size of the backup in bytes */
  size: number;
  /** Timestamp when backup was created */
  timestamp: Date;
}

/**
 * File write with backup request
 */
export interface FileWriteWithBackupRequest {
  /** Full path to the file to write */
  filePath: string;
  /** File write options */
  options: FileWriteWithBackupOptions;
}

/**
 * File write with backup options
 */
export interface FileWriteWithBackupOptions {
  /** Content to write to the file */
  content: string;
  /** Encoding to use (default: 'utf8') */
  encoding?: BufferEncoding;
  /** Create backup before overwriting (default: true) */
  createBackup?: boolean;
  /** Backup options */
  backupOptions?: BackupOptions;
  /** Mode for file writing (default: 0o666) */
  mode?: number;
}

/**
 * File delete response
 */
export interface FileDeleteResponse {
  /** Full path of the deleted file */
  filePath: string;
  /** Name of the file */
  fileName: string;
  /** Whether the deletion was successful */
  success: boolean;
  /** Size of the deleted file in bytes (for files) */
  size?: number;
  /** Whether the deleted item was a directory */
  isDirectory?: boolean;
}

/**
 * File delete request options
 */
export interface FileDeleteOptions {
  /** Recursively delete directories (default: false) */
  recursive?: boolean;
}

/**
 * File delete request
 */
export interface FileDeleteRequest {
  /** Full path to the file or directory to delete */
  filePath: string;
  /** Base path for security validation (optional, for web mode) */
  basePath?: string;
  /** Delete options */
  options?: FileDeleteOptions;
}

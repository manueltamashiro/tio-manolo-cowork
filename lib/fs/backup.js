"use strict";
/**
 * Backup utility functions for file operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBackup = createBackup;
exports.restoreFromBackup = restoreFromBackup;
exports.listBackups = listBackups;
const fs_1 = require("fs");
const path_1 = require("path");
const file_operations_1 = require("./file-operations");
const DEFAULT_BACKUP_DIR = '.tio-manolo-backups';
const DEFAULT_MAX_BACKUPS = 10;
/**
 * Generate a backup filename with timestamp
 * Format: filename.timestamp.ext.bak
 */
function generateBackupFileName(originalFileName) {
    const name = (0, path_1.basename)(originalFileName, (0, path_1.extname)(originalFileName));
    const ext = (0, path_1.extname)(originalFileName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${(0, file_operations_1.sanitizeFileName)(name)}.${timestamp}${ext}.bak`;
}
/**
 * Get the backup directory for a given file path
 * Creates the directory if it doesn't exist
 */
function getBackupDirectory(filePath, options) {
    const backupDirName = options?.backupDir || DEFAULT_BACKUP_DIR;
    const parentDir = (0, path_1.dirname)(filePath);
    const backupPath = (0, path_1.join)(parentDir, backupDirName);
    if (!(0, fs_1.existsSync)(backupPath)) {
        (0, fs_1.mkdirSync)(backupPath, { recursive: true });
    }
    return backupPath;
}
/**
 * Get all backup files for a given original file
 */
function getExistingBackups(filePath, options) {
    const backupDir = getBackupDirectory(filePath, options);
    const originalName = (0, path_1.basename)(filePath, (0, path_1.extname)(filePath));
    if (!(0, fs_1.existsSync)(backupDir)) {
        return [];
    }
    const allFiles = (0, fs_1.readdirSync)(backupDir);
    // Match files that start with the original name and end with .bak
    const backupFiles = allFiles.filter(file => {
        return file.startsWith(originalName) && file.endsWith('.bak');
    });
    return backupFiles.map(file => (0, path_1.join)(backupDir, file));
}
/**
 * Clean up old backups, keeping only the most recent ones
 */
function cleanupOldBackups(filePath, options) {
    const maxBackups = options?.maxBackups ?? DEFAULT_MAX_BACKUPS;
    const backups = getExistingBackups(filePath, options);
    if (backups.length <= maxBackups) {
        return;
    }
    // Sort by modification time (oldest first)
    const sortedBackups = backups.sort((a, b) => {
        return (0, fs_1.statSync)(a).mtimeMs - (0, fs_1.statSync)(b).mtimeMs;
    });
    // Remove oldest backups
    const toDelete = sortedBackups.slice(0, sortedBackups.length - maxBackups);
    for (const file of toDelete) {
        try {
            (0, fs_1.unlinkSync)(file);
        }
        catch {
            // Ignore errors when deleting old backups
        }
    }
}
/**
 * Create a backup of a file
 *
 * @param filePath - Path to the file to backup
 * @param options - Backup options
 * @returns BackupResult with details about the backup
 * @throws Error if file doesn't exist or cannot be read
 */
function createBackup(filePath, options) {
    // Verify the file exists
    if (!(0, fs_1.existsSync)(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
    }
    const stats = (0, fs_1.statSync)(filePath);
    if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
    }
    // Get backup directory
    const backupDir = getBackupDirectory(filePath, options);
    // Generate backup filename
    const originalFileName = (0, path_1.basename)(filePath);
    const backupFileName = generateBackupFileName(originalFileName);
    const backupPath = (0, path_1.join)(backupDir, backupFileName);
    // Copy file content
    const content = (0, fs_1.readFileSync)(filePath);
    (0, fs_1.writeFileSync)(backupPath, content);
    // Clean up old backups
    cleanupOldBackups(filePath, options);
    return {
        backupPath,
        size: content.length,
        timestamp: new Date(),
    };
}
/**
 * Restore a file from a backup
 *
 * @param backupPath - Path to the backup file
 * @param targetPath - Path where to restore the file
 * @returns The path where the file was restored
 */
function restoreFromBackup(backupPath, targetPath) {
    if (!(0, fs_1.existsSync)(backupPath)) {
        throw new Error(`Backup does not exist: ${backupPath}`);
    }
    const content = (0, fs_1.readFileSync)(backupPath);
    (0, fs_1.writeFileSync)(targetPath, content);
    return targetPath;
}
/**
 * List all backups for a given file
 *
 * @param filePath - Path to the original file
 * @param options - Backup options
 * @returns Array of backup file paths
 */
function listBackups(filePath, options) {
    const backups = getExistingBackups(filePath, options);
    return backups.map(path => {
        const stats = (0, fs_1.statSync)(path);
        return {
            path,
            size: stats.size,
            timestamp: stats.mtime,
        };
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

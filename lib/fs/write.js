"use strict";
/**
 * File write utility with backup support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFile = writeFile;
exports.createFileWithBackup = createFileWithBackup;
const fs_1 = require("fs");
const path_1 = require("path");
const file_operations_1 = require("./file-operations");
const backup_1 = require("./backup");
/**
 * Check if a file exists at the given path
 */
function fileExists(filePath) {
    try {
        const stats = (0, fs_1.statSync)(filePath);
        return stats.isFile();
    }
    catch {
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
function writeFile(filePath, options) {
    const { content = '', encoding = 'utf8', createBackup = true, backupOptions, mode = 0o666, } = options;
    // Validate file path
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
    }
    // Sanitize filename from path for security
    const sanitizedName = (0, file_operations_1.sanitizeFileName)((0, path_1.basename)(filePath));
    const targetPath = (0, path_1.join)((0, path_1.dirname)(filePath), sanitizedName);
    // Check if file exists
    const fileExisted = fileExists(targetPath);
    let backupResult;
    // Create backup if file exists and backup is enabled
    if (fileExisted && createBackup) {
        try {
            backupResult = (0, backup_1.createBackup)(targetPath, backupOptions);
        }
        catch (error) {
            // Log backup error but don't fail the write operation
            console.warn(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Ensure parent directory exists
    const parentDir = (0, path_1.dirname)(targetPath);
    if (!(0, fs_1.existsSync)(parentDir)) {
        (0, fs_1.mkdirSync)(parentDir, { recursive: true });
    }
    // Write the file
    (0, fs_1.writeFileSync)(targetPath, content, { encoding, mode });
    // Get file stats
    const stats = (0, fs_1.statSync)(targetPath);
    return {
        filePath: targetPath,
        fileName: (0, path_1.basename)(targetPath),
        action: fileExisted ? 'overwritten' : 'created',
        size: stats.size,
        backup: backupResult,
    };
}
/**
 * Write content to a new file in a directory
 *
 * @param directoryPath - Directory where the file should be created
 * @param fileName - Name of the file to create
 * @param options - File write options
 * @returns FileWriteResponse with details about the write operation
 */
function createFileWithBackup(directoryPath, fileName, options) {
    const { content = '', encoding = 'utf8', createBackup = true, backupOptions, mode = 0o666, } = options;
    // Validate inputs
    if (!directoryPath || typeof directoryPath !== 'string') {
        throw new Error('Invalid directory path');
    }
    if (!fileName || typeof fileName !== 'string') {
        throw new Error('Invalid file name');
    }
    // Validate directory exists
    if (!(0, fs_1.existsSync)(directoryPath)) {
        throw new Error(`Directory does not exist: ${directoryPath}`);
    }
    // Sanitize filename and construct full path
    const sanitizedName = (0, file_operations_1.sanitizeFileName)(fileName);
    const targetPath = (0, path_1.join)(directoryPath, sanitizedName);
    // Write the file using the main writeFile function
    return writeFile(targetPath, {
        content,
        encoding,
        createBackup,
        backupOptions,
        mode,
    });
}

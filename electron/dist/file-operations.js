"use strict";
/**
 * File system utility functions for file operations in Electron main process
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeFileName = sanitizeFileName;
exports.generateUniqueFileName = generateUniqueFileName;
exports.createFile = createFile;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Sanitize a filename to prevent path traversal and invalid characters
 */
function sanitizeFileName(fileName) {
    // Remove any path components (prevent path traversal)
    const cleanName = (0, path_1.basename)(fileName);
    // Remove characters that are invalid on Windows/Linux/macOS
    // Invalid: < > : " / \ | ? * and control characters
    return cleanName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}
/**
 * Generate a unique filename if the original already exists
 */
function generateUniqueFileName(filePath) {
    if (!(0, fs_1.existsSync)(filePath)) {
        return filePath;
    }
    const dir = (0, path_1.dirname)(filePath);
    const name = (0, path_1.basename)(filePath, (0, path_1.extname)(filePath));
    const ext = (0, path_1.extname)(filePath);
    let counter = 1;
    let newPath;
    do {
        newPath = (0, path_1.join)(dir, `${name} (${counter})${ext}`);
        counter++;
    } while ((0, fs_1.existsSync)(newPath));
    return newPath;
}
/**
 * Create a file with the specified content in the given directory
 */
function createFile(directoryPath, fileName, options) {
    const { content = '', encoding = 'utf8', onConflict = 'error', mode = 0o666, } = options;
    // Sanitize the filename to prevent security issues
    const sanitizedName = sanitizeFileName(fileName);
    // Construct the full file path
    let targetPath = (0, path_1.join)(directoryPath, sanitizedName);
    // Check if directory exists
    if (!(0, fs_1.existsSync)(directoryPath)) {
        throw new Error(`Directory does not exist: ${directoryPath}`);
    }
    // Check if a file/directory with the same name exists
    const fileExists = (0, fs_1.existsSync)(targetPath);
    if (fileExists) {
        // Handle existing file based on conflict resolution strategy
        switch (onConflict) {
            case 'error':
                throw new Error(`File already exists: ${sanitizedName}`);
            case 'skip':
                const stats = (0, fs_1.statSync)(targetPath);
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
    const parentDir = (0, path_1.dirname)(targetPath);
    if (!(0, fs_1.existsSync)(parentDir)) {
        (0, fs_1.mkdirSync)(parentDir, { recursive: true });
    }
    // Write the file
    (0, fs_1.writeFileSync)(targetPath, content, { encoding, mode });
    // Get the final filename (may have changed due to rename)
    const finalFileName = (0, path_1.basename)(targetPath);
    const newStats = (0, fs_1.statSync)(targetPath);
    return {
        filePath: targetPath,
        fileName: finalFileName,
        action: fileExists && onConflict === 'overwrite' ? 'overwritten' : 'created',
        size: newStats.size,
    };
}

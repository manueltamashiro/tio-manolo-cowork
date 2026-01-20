"use strict";
/**
 * File system utility functions for directory operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePath = validatePath;
exports.listDirectory = listDirectory;
exports.getDirectoryListing = getDirectoryListing;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Security check to prevent path traversal attacks
 */
function validatePath(basePath, targetPath) {
    const resolvedBase = (0, path_1.resolve)(basePath);
    const resolvedTarget = (0, path_1.resolve)(targetPath);
    const relativePath = (0, path_1.relative)(resolvedBase, resolvedTarget);
    // Check if the relative path starts with '..' (parent directory access)
    if (relativePath.startsWith('..')) {
        throw new Error('Path traversal detected: access denied');
    }
    return resolvedTarget;
}
/**
 * Get file type from stats
 */
function getFileType(stats) {
    if (stats.isSymbolicLink())
        return 'symlink';
    if (stats.isDirectory())
        return 'directory';
    return 'file';
}
/**
 * Check if a file matches the filter criteria
 */
function matchesFilter(name, type, options) {
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
function listSingleDirectory(dirPath, basePath, options) {
    const entries = [];
    try {
        const files = (0, fs_1.readdirSync)(dirPath);
        for (const file of files) {
            const fullPath = (0, path_1.join)(dirPath, file);
            const stats = (0, fs_1.lstatSync)(fullPath);
            const type = getFileType(stats);
            if (!matchesFilter(file, type, options)) {
                continue;
            }
            const relativePath = (0, path_1.relative)(basePath, fullPath);
            entries.push({
                name: file,
                path: relativePath,
                type,
                size: type === 'file' ? stats.size : undefined,
                modified: stats.mtime,
            });
        }
    }
    catch (error) {
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
function listDirectoryRecursive(dirPath, basePath, options, currentDepth = 0) {
    const entries = [];
    // Check max depth
    if (options.maxDepth !== undefined && currentDepth >= options.maxDepth) {
        return listSingleDirectory(dirPath, basePath, options);
    }
    try {
        const files = (0, fs_1.readdirSync)(dirPath);
        for (const file of files) {
            const fullPath = (0, path_1.join)(dirPath, file);
            const stats = (0, fs_1.lstatSync)(fullPath);
            const type = getFileType(stats);
            // Skip if doesn't match filter
            if (!matchesFilter(file, type, options)) {
                continue;
            }
            const relativePath = (0, path_1.relative)(basePath, fullPath);
            const entry = {
                name: file,
                path: relativePath,
                type,
                size: type === 'file' ? stats.size : undefined,
                modified: stats.mtime,
            };
            // Recursively process subdirectories
            if (type === 'directory' && options.recursive) {
                entry.children = listDirectoryRecursive(fullPath, basePath, options, currentDepth + 1);
            }
            entries.push(entry);
        }
    }
    catch (error) {
        if (error instanceof Error && 'code' in error) {
            throw error;
        }
    }
    return entries;
}
/**
 * Count total entries (including nested children)
 */
function countEntries(entries) {
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
function listDirectory(dirPath, options = {}) {
    const basePath = (0, path_1.resolve)(dirPath);
    // Validate directory exists
    try {
        const stats = (0, fs_1.statSync)(basePath);
        if (!stats.isDirectory()) {
            throw new Error('Path is not a directory');
        }
    }
    catch {
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
function getDirectoryListing(dirPath, options = {}) {
    const entries = listDirectory(dirPath, options);
    return {
        entries,
        path: (0, path_1.resolve)(dirPath),
        totalCount: countEntries(entries),
    };
}

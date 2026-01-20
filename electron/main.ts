import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync, readdirSync, lstatSync, realpathSync } from "fs";
import { createFile } from "./file-operations.js";
import { initializeMenu } from "./menu.js";
import {
  initializeAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdateAndRestart,
  getUpdateState,
  resetUpdateState,
} from "./auto-update.js";
import {
  initializeCrashReporter,
  getCrashReporterInfo,
  getLastCrashReport,
  getAllCrashReports,
  clearCrashReports,
  submitCrashReport,
  isCrashUploadEnabled,
} from "./crash-reporter.js";
import {
  initializeTray,
  updateUnreadCount,
  getUnreadCount,
  destroyTray,
} from "./tray.js";

// Window management for multi-window support
interface WindowInfo {
  window: BrowserWindow;
  windowId: string;
  sessionId: string | null;
}

const windows = new Map<string, WindowInfo>();
let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === "development";

// Initialize crash reporter early to catch any crashes during startup
const crashReportingEnabled = process.env.CRASH_REPORTING_ENABLED !== "false";
const crashSubmitURL = process.env.CRASH_REPORT_URL;

initializeCrashReporter({
  submitURL: crashSubmitURL,
  uploadToServer: crashReportingEnabled && !!crashSubmitURL,
});

/**
 * Generate a unique window ID
 */
function generateWindowId(): string {
  return `window_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get window info by webContents id
 */
function getWindowInfo(webContentsId: number): WindowInfo | undefined {
  for (const [, info] of windows.entries()) {
    if (info.window.webContents.id === webContentsId) {
      return info;
    }
  }
  return undefined;
}

/**
 * Content Security Policy for Electron renderer process.
 * More restrictive than web version since this is a desktop app.
 */
const ELECTRON_CSP = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self' https://api.anthropic.com wss://api.anthropic.com ws://localhost:3000;
  media-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`.replace(/\s{2,}/g, ' ').trim();

/**
 * Validates that a path is safe (no symlink attacks, resolves to real path).
 * Also validates that the path doesn't escape a base directory if provided.
 */
function validateSecurePath(targetPath: string, basePath?: string): string {
  try {
    // Resolve to real path to prevent symlink attacks
    const resolvedTarget = realpathSync(targetPath);

    // If base path provided, ensure target is within it
    if (basePath) {
      const resolvedBase = realpathSync(basePath);
      const relativePath = path.relative(resolvedBase, resolvedTarget);

      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error('Path traversal detected: access denied');
      }
    }

    return resolvedTarget;
  } catch (error) {
    // Path doesn't exist yet, validate the parent directory
    const parentDir = path.dirname(targetPath);
    if (existsSync(parentDir)) {
      const resolvedParent = realpathSync(parentDir);
      const fileName = path.basename(targetPath);

      if (basePath) {
        const resolvedBase = realpathSync(basePath);
        const relativePath = path.relative(resolvedBase, resolvedParent);

        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          throw new Error('Path traversal detected: access denied');
        }
      }

      return path.join(resolvedParent, fileName);
    }
    throw new Error('Invalid path');
  }
}

/**
 * Validates IPC sender to ensure it's from a valid renderer process.
 * In production, this validates against expected origins.
 */
function validateIPCSender(event: Electron.IpcMainInvokeEvent): void {
  const senderUrl = event.sender.getURL();

  // In development, allow localhost
  if (isDev && senderUrl.startsWith('http://localhost:')) {
    return;
  }

  // In production, only allow file:// protocol for built app
  if (!isDev && !senderUrl.startsWith('file://')) {
    throw new Error('Invalid sender origin');
  }
}

interface CreateWindowOptions {
  sessionId?: string | null;
  windowId?: string;
}

function createWindow(options: CreateWindowOptions = {}): BrowserWindow {
  const { sessionId = null, windowId } = options;
  const actualWindowId = windowId || generateWindowId();

  const newWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#18181b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Additional security settings
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Enable CSP via session (set below)
    },
    titleBarStyle: "hiddenInset",
  });

  // Store window info
  const windowInfo: WindowInfo = {
    window: newWindow,
    windowId: actualWindowId,
    sessionId,
  };
  windows.set(actualWindowId, windowInfo);

  // Keep track of main window
  if (!mainWindow) {
    mainWindow = newWindow;
  }

  // Configure session with security headers
  const windowSession = newWindow.webContents.session;

  // Set CSP for all requests
  windowSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [ELECTRON_CSP],
        'X-Frame-Options': ['DENY'],
        'X-Content-Type-Options': ['nosniff'],
      },
    });
  });

  // Disable dangerous permissions
  windowSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    // Deny all permissions except necessary ones
    const allowedPermissions: string[] = [];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Load the app
  if (isDev) {
    const url = sessionId
      ? `http://localhost:3000?windowId=${actualWindowId}&sessionId=${sessionId}`
      : `http://localhost:3000?windowId=${actualWindowId}`;
    newWindow.loadURL(url);
    newWindow.webContents.openDevTools();
  } else {
    const url = sessionId
      ? `file://${path.join(__dirname, "../out/index.html")}?windowId=${actualWindowId}&sessionId=${sessionId}`
      : `file://${path.join(__dirname, "../out/index.html")}?windowId=${actualWindowId}`;
    newWindow.loadURL(url);
  }

  // Show window when ready to prevent visual flash
  newWindow.once("ready-to-show", () => {
    newWindow.show();
  });

  newWindow.on("closed", () => {
    windows.delete(actualWindowId);
    if (mainWindow === newWindow) {
      // If this was the main window, reassign to another available window or null
      const remainingWindows = Array.from(windows.values());
      mainWindow = remainingWindows.length > 0 ? remainingWindows[0].window : null;
    }
  });

  return newWindow;
}

/**
 * Open a session in a new window
 */
function openSessionInNewWindow(sessionId: string): BrowserWindow {
  return createWindow({ sessionId });
}

// App lifecycle handlers
app.whenReady().then(() => {
  createWindow();

  // Initialize application menu
  if (mainWindow) {
    initializeMenu(mainWindow);

    // Initialize system tray
    initializeTray(mainWindow);

    // Initialize auto-updater
    initializeAutoUpdater(mainWindow);

    // Check for updates on launch (after a short delay to not slow down startup)
    setTimeout(() => {
      checkForUpdates().catch((error) => {
        console.error("Failed to check for updates on launch:", error);
      });
    }, 5000);
  }

  // macOS-specific: create window when dock icon is clicked
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Clean up tray when app quits
app.on("before-quit", () => {
  (app as any).isQuitting = true;
  destroyTray();
});

// IPC handlers for secure communication
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("get-platform", () => {
  return process.platform;
});

ipcMain.handle("quit-app", () => {
  app.quit();
});

ipcMain.handle("minimize-window", () => {
  mainWindow?.minimize();
});

ipcMain.handle("maximize-window", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle("close-window", () => {
  mainWindow?.close();
});

// Menu-related IPC handlers
ipcMain.handle("menu-get-app-info", () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
  };
});

/**
 * Open a folder selection dialog
 * Returns the selected folder path or null if cancelled
 */
ipcMain.handle("select-folder", async () => {
  if (!mainWindow) {
    throw new Error("Window not available");
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select a Folder",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

/**
 * Create a file in the specified directory
 */
ipcMain.handle(
  "create-file",
  async (event, directoryPath: string, fileName: string, options: any) => {
    // Validate IPC sender
    validateIPCSender(event);

    // Validate inputs
    if (!directoryPath || typeof directoryPath !== "string") {
      throw new Error("Invalid directory path");
    }

    if (!fileName || typeof fileName !== "string") {
      throw new Error("Invalid file name");
    }

    if (!options || typeof options !== "object") {
      throw new Error("Invalid options");
    }

    // Security check: ensure directory exists and validate path
    const validatedPath = validateSecurePath(directoryPath);
    if (!existsSync(validatedPath)) {
      throw new Error(`Directory does not exist: ${directoryPath}`);
    }

    try {
      const result = createFile(validatedPath, fileName, options);
      return result;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
);

/**
 * Read file contents
 * Returns the file content as a string along with metadata
 */
ipcMain.handle("read-file", async (event, filePath: string) => {
  // Validate IPC sender
  validateIPCSender(event);

  // Validate input
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Invalid file path");
  }

  // Security check: validate path to prevent symlink attacks
  const validatedPath = validateSecurePath(filePath);

  // Security check: ensure file exists
  if (!existsSync(validatedPath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  // Get file stats
  const stats = statSync(validatedPath);

  // Check if it's a file (not a directory)
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`);
  }

  // Check file size (warn if too large, but still allow it)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`);
  }

  try {
    // Read file content
    const content = readFileSync(validatedPath, "utf-8");

    return {
      filePath,
      fileName: path.basename(validatedPath),
      content,
      size: stats.size,
      modified: stats.mtime,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
});

/**
 * Write content to a file (creates new or overwrites existing)
 * Returns file metadata after writing
 */
ipcMain.handle("write-file", async (event, filePath: string, content: string, options: any) => {
  // Validate IPC sender
  validateIPCSender(event);

  // Validate inputs
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Invalid file path");
  }

  if (content === undefined || content === null) {
    throw new Error("Content is required");
  }

  // Check content size to prevent DOS attacks
  const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB
  if (content.length > MAX_CONTENT_SIZE) {
    throw new Error("Content too large. Maximum size is 10MB.");
  }

  const encoding = options?.encoding || "utf8";
  const mode = options?.mode || 0o666;

  // Validate path to prevent symlink attacks
  const validatedPath = validateSecurePath(filePath);

  // Sanitize the filename to prevent security issues
  const fileName = path.basename(validatedPath);

  // Check if parent directory exists
  const parentDir = path.dirname(validatedPath);
  if (!existsSync(parentDir)) {
    throw new Error(`Parent directory does not exist: ${parentDir}`);
  }

  // Check if file exists to determine action
  const fileExists = existsSync(validatedPath);

  // If file exists, verify it's a file (not directory)
  if (fileExists) {
    const stats = statSync(validatedPath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }
  }

  try {
    // Write the file
    writeFileSync(validatedPath, content, { encoding, mode });

    // Get the new file stats
    const newStats = statSync(validatedPath);

    return {
      filePath,
      fileName,
      size: newStats.size,
      action: fileExists ? "overwritten" : "created",
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
});

/**
 * List directory contents with optional filtering
 * Returns array of file system entries
 */
ipcMain.handle("list-directory", async (event, dirPath: string, options: any) => {
  // Validate IPC sender
  validateIPCSender(event);

  // Validate inputs
  if (!dirPath || typeof dirPath !== "string") {
    throw new Error("Invalid directory path");
  }

  const {
    includeHidden = false,
    recursive = false,
    maxDepth,
    extensions,
    fileTypes,
  } = options || {};

  // Security check: validate path and ensure directory exists
  const validatedPath = validateSecurePath(dirPath);
  if (!existsSync(validatedPath)) {
    throw new Error(`Directory does not exist: ${dirPath}`);
  }

  // Check if it's a directory
  const stats = statSync(validatedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }

  try {
    const entries = listDirectoryContents(validatedPath, validatedPath, {
      includeHidden,
      recursive,
      maxDepth,
      extensions: extensions ? (Array.isArray(extensions) ? extensions : extensions.split(",").map((e: string) => e.trim())) : undefined,
      fileTypes: fileTypes ? (Array.isArray(fileTypes) ? fileTypes : [fileTypes]) : undefined,
    });

    return {
      entries,
      path: dirPath,
      totalCount: countTotalEntries(entries),
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
});

/**
 * Delete a file
 * Returns confirmation of deletion
 */
ipcMain.handle("delete-file", async (event, filePath: string) => {
  // Validate IPC sender
  validateIPCSender(event);

  // Validate input
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Invalid file path");
  }

  // Security check: validate path to prevent symlink attacks
  const validatedPath = validateSecurePath(filePath);

  // Security check: ensure file exists
  if (!existsSync(validatedPath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  // Check if it's a file (not a directory)
  const stats = statSync(validatedPath);
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`);
  }

  const fileName = path.basename(validatedPath);

  try {
    // Delete the file
    unlinkSync(validatedPath);

    return {
      filePath,
      fileName,
      success: true,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
});

// ==================== Auto-update IPC handlers ====================

/**
 * Check for updates
 */
ipcMain.handle("update:check", async () => {
  await checkForUpdates();
  return getUpdateState();
});

/**
 * Download the available update
 */
ipcMain.handle("update:download", async () => {
  await downloadUpdate();
  return getUpdateState();
});

/**
 * Install the downloaded update and restart
 */
ipcMain.handle("update:install-and-restart", () => {
  installUpdateAndRestart();
  return { success: true };
});

/**
 * Get the current update state
 */
ipcMain.handle("update:get-state", () => {
  return getUpdateState();
});

/**
 * Reset the update state (dismiss notification)
 */
ipcMain.handle("update:reset", () => {
  resetUpdateState();
  return { success: true };
});

// ==================== Window management IPC handlers ====================

/**
 * Get the current window's ID
 */
ipcMain.handle("window:get-id", (event) => {
  const windowInfo = getWindowInfo(event.sender.id);
  return windowInfo?.windowId || null;
});

/**
 * Open a session in a new window
 */
ipcMain.handle("window:open-session", async (_event, sessionId: string) => {
  if (!sessionId || typeof sessionId !== "string") {
    throw new Error("Invalid session ID");
  }

  const newWindow = openSessionInNewWindow(sessionId);
  // Find the window info by matching the BrowserWindow instance
  const windowInfo = Array.from(windows.values()).find(info => info.window === newWindow);

  return {
    windowId: windowInfo?.windowId || null,
    sessionId,
  };
});

/**
 * Get list of all open windows
 */
ipcMain.handle("window:list", () => {
  return Array.from(windows.values()).map((info) => ({
    windowId: info.windowId,
    sessionId: info.sessionId,
  }));
});

/**
 * Get the current window's session ID
 */
ipcMain.handle("window:get-session", (event) => {
  const windowInfo = getWindowInfo(event.sender.id);
  return windowInfo?.sessionId || null;
});

/**
 * Set the current window's session ID
 */
ipcMain.handle("window:set-session", (event, sessionId: string | null) => {
  const windowInfo = getWindowInfo(event.sender.id);
  if (windowInfo) {
    windowInfo.sessionId = sessionId;
    // Update the windows map
    windows.set(windowInfo.windowId, windowInfo);
    return { success: true, windowId: windowInfo.windowId, sessionId };
  }
  return { success: false };
});

// Helper functions for directory listing

interface ListOptions {
  includeHidden?: boolean;
  recursive?: boolean;
  maxDepth?: number;
  extensions?: string[];
  fileTypes?: string[];
}

interface FileSystemEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
  modified?: Date;
  children?: FileSystemEntry[];
}

function getFileType(stats: { isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }): "file" | "directory" | "symlink" {
  if (stats.isSymbolicLink()) return "symlink";
  if (stats.isDirectory()) return "directory";
  return "file";
}

function matchesFilter(name: string, type: string, options: ListOptions): boolean {
  // Check hidden files
  if (!options.includeHidden && name.startsWith(".")) {
    return false;
  }

  // Check file type filter
  if (options.fileTypes && options.fileTypes.length > 0) {
    if (!options.fileTypes.includes(type)) {
      return false;
    }
  }

  // Check extension filter (only applies to files)
  if (options.extensions && options.extensions.length > 0 && type === "file") {
    const ext = name.includes(".") ? "." + name.split(".").pop() : "";
    if (!options.extensions.includes(ext)) {
      return false;
    }
  }

  return true;
}

function listDirectoryContents(
  dirPath: string,
  basePath: string,
  options: ListOptions,
  currentDepth: number = 0
): FileSystemEntry[] {
  const entries: FileSystemEntry[] = [];

  // Check max depth
  if (options.maxDepth !== undefined && currentDepth >= options.maxDepth) {
    return [];
  }

  const files = readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stats = lstatSync(fullPath);
    const type = getFileType(stats);

    // Skip if doesn't match filter
    if (!matchesFilter(file, type, options)) {
      continue;
    }

    const entry: FileSystemEntry = {
      name: file,
      path: fullPath,
      type,
      size: type === "file" ? stats.size : undefined,
      modified: stats.mtime,
    };

    // Recursively process subdirectories
    if (type === "directory" && options.recursive) {
      entry.children = listDirectoryContents(
        fullPath,
        basePath,
        options,
        currentDepth + 1
      );
    }

    entries.push(entry);
  }

  return entries;
}

function countTotalEntries(entries: FileSystemEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    count++;
    if (entry.children) {
      count += countTotalEntries(entry.children);
    }
  }
  return count;
}

// ==================== Badge IPC handlers ====================

// Store the current badge count
let currentBadgeCount = 0;

/**
 * Set the badge count on the app icon
 * On macOS: shows on the dock icon
 * On Windows: shows on the taskbar icon
 * On Linux: shows on the taskbar/dock (depending on WM)
 */
ipcMain.handle("badge:set-count", async (_event, count: number) => {
  // Validate input
  if (typeof count !== "number" || count < 0) {
    throw new Error("Invalid badge count");
  }

  currentBadgeCount = count;

  // Update tray unread count
  updateUnreadCount(count);

  // Set badge on the app
  if (app.badgeCount !== undefined) {
    // Electron's built-in badge support (works on macOS and some Linux WMs)
    app.badgeCount = count > 0 ? count : 0;
  }

  // On Windows, we would need to use setOverlayIcon with a custom image
  // This requires creating a badge image with the count number
  // For now, Windows badge support is limited to the app badge count
  // Future enhancement: Create a proper badge image for Windows overlay

  return { success: true, count: currentBadgeCount };
});

/**
 * Get the current badge count
 */
ipcMain.handle("badge:get-count", () => {
  return currentBadgeCount;
});

// ==================== Tray IPC handlers ====================

/**
 * Get the current tray unread count
 */
ipcMain.handle("tray:get-unread-count", () => {
  return getUnreadCount();
});

// ==================== Crash Reporter IPC handlers ====================

/**
 * Get crash reporter info
 */
ipcMain.handle("crash-reporter:get-info", () => {
  return getCrashReporterInfo();
});

/**
 * Get the last crash report
 */
ipcMain.handle("crash-reporter:get-last-crash", () => {
  return getLastCrashReport();
});

/**
 * Get all crash reports
 */
ipcMain.handle("crash-reporter:get-all-crashes", () => {
  return getAllCrashReports();
});

/**
 * Clear all crash reports
 */
ipcMain.handle("crash-reporter:clear-crashes", () => {
  return clearCrashReports();
});

/**
 * Submit a crash report manually
 */
ipcMain.handle("crash-reporter:submit-crash", async (_event, crashPath: string, extra?: Record<string, string>) => {
  if (!crashPath || typeof crashPath !== "string") {
    throw new Error("Invalid crash path");
  }
  return submitCrashReport(crashPath, extra);
});

/**
 * Check if crash upload is enabled
 */
ipcMain.handle("crash-reporter:is-upload-enabled", () => {
  return isCrashUploadEnabled();
});

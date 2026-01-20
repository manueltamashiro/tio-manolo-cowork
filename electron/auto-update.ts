/**
 * Auto-update module for Electron application using electron-updater
 * Handles update checking, downloading, and installation with progress reporting
 */

import { autoUpdater, UpdateInfo } from "electron-updater";
import { BrowserWindow } from "electron";

// Export state for testing and IPC handlers
export interface UpdateState {
  available: boolean;
  downloaded: boolean;
  checking: boolean;
  downloading: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export const updateState: UpdateState = {
  available: false,
  downloaded: false,
  checking: false,
  downloading: false,
  error: null,
  updateInfo: null,
  downloadProgress: 0,
  bytesPerSecond: 0,
  percent: 0,
  transferred: 0,
  total: 0,
};

let mainWindow: BrowserWindow | null = null;
let autoInstallOnQuit = true;

/**
 * Initialize the auto-updater with the main window reference
 */
export function initializeAutoUpdater(window: BrowserWindow): void {
  mainWindow = window;

  // Configure auto-updater settings
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = autoInstallOnQuit;

  // Set up feed URL - this will be configured via electron-builder
  // In development, updates are disabled
  if (process.env.NODE_ENV === "development") {
    console.log("[Auto-update] Running in development mode, updates disabled");
    autoUpdater.autoDownload = false;
    return;
  }

  setupEventListeners();
}

/**
 * Enable or disable automatic installation on quit
 */
export function setAutoInstallOnQuit(value: boolean): void {
  autoInstallOnQuit = value;
  autoUpdater.autoInstallOnAppQuit = value;
}

/**
 * Set up event listeners for auto-updater
 */
function setupEventListeners(): void {
  // Fired when an update is available
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    console.log("[Auto-update] Update available:", info.version);
    updateState.available = true;
    updateState.updateInfo = info;
    updateState.checking = false;
    sendToRenderer("update:available", info);
  });

  // Fired when an update is NOT available
  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    console.log("[Auto-update] No update available, current version:", info.version);
    updateState.available = false;
    updateState.checking = false;
    sendToRenderer("update:not-available", info);
  });

  // Fired when an update has been downloaded
  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    console.log("[Auto-update] Update downloaded:", info.version);
    updateState.downloaded = true;
    updateState.downloading = false;
    updateState.downloadProgress = 100;
    sendToRenderer("update:downloaded", info);
  });

  // Fired during download progress
  autoUpdater.on("download-progress", (progress) => {
    console.log(
      `[Auto-update] Download progress: ${Math.round(progress.percent)}% (${progress.transferred}/${progress.total} bytes)`
    );
    updateState.downloading = true;
    updateState.downloadProgress = progress.percent;
    updateState.bytesPerSecond = progress.bytesPerSecond;
    updateState.percent = progress.percent;
    updateState.transferred = progress.transferred;
    updateState.total = progress.total;
    sendToRenderer("update:download-progress", progress);
  });

  // Fired when there's an error
  autoUpdater.on("error", (error: Error) => {
    console.error("[Auto-update] Error:", error);
    updateState.error = error.message;
    updateState.checking = false;
    updateState.downloading = false;
    sendToRenderer("update:error", error.message);
  });
}

/**
 * Check for updates
 */
export async function checkForUpdates(): Promise<void> {
  if (!mainWindow) {
    throw new Error("Main window not available");
  }

  if (process.env.NODE_ENV === "development") {
    // Simulate update check in development
    updateState.checking = true;
    sendToRenderer("update:checking");
    setTimeout(() => {
      updateState.checking = false;
      sendToRenderer("update:not-available", { version: "0.1.0" });
    }, 1000);
    return;
  }

  updateState.checking = true;
  sendToRenderer("update:checking");

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    updateState.checking = false;
    updateState.error = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

/**
 * Download the update (if autoDownload is false)
 */
export async function downloadUpdate(): Promise<void> {
  if (!mainWindow) {
    throw new Error("Main window not available");
  }

  if (process.env.NODE_ENV === "development") {
    // Simulate download in development
    updateState.downloading = true;
    sendToRenderer("update:download-progress", { percent: 0 });

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      updateState.downloadProgress = progress;
      updateState.percent = progress;
      sendToRenderer("update:download-progress", {
        percent: progress,
        transferred: progress * 1000000,
        total: 10000000,
        bytesPerSecond: 5000000,
      });

      if (progress >= 100) {
        clearInterval(interval);
        updateState.downloading = false;
        updateState.downloaded = true;
        sendToRenderer("update:downloaded", { version: "0.2.0" });
      }
    }, 200);
    return;
  }

  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    updateState.downloading = false;
    throw error;
  }
}

/**
 * Install the downloaded update and restart the app
 */
export function installUpdateAndRestart(): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[Auto-update] Simulating update installation and restart");
    sendToRenderer("update:installing");
    // Don't actually restart in development
    return;
  }

  setImmediate(() => {
    autoUpdater.quitAndInstall();
  });
}

/**
 * Get the current update state
 */
export function getUpdateState(): UpdateState {
  return { ...updateState };
}

/**
 * Send a message to the renderer process
 */
function sendToRenderer(channel: string, ...args: any[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

/**
 * Reset the update state (e.g., after dismissing an update notification)
 */
export function resetUpdateState(): void {
  updateState.available = false;
  updateState.downloaded = false;
  updateState.checking = false;
  updateState.downloading = false;
  updateState.error = null;
  updateState.downloadProgress = 0;
  updateState.percent = 0;
}

// Export autoUpdater for direct access if needed
export { autoUpdater };

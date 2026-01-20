"use strict";
/**
 * Auto-update module for Electron application using electron-updater
 * Handles update checking, downloading, and installation with progress reporting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoUpdater = exports.updateState = void 0;
exports.initializeAutoUpdater = initializeAutoUpdater;
exports.setAutoInstallOnQuit = setAutoInstallOnQuit;
exports.checkForUpdates = checkForUpdates;
exports.downloadUpdate = downloadUpdate;
exports.installUpdateAndRestart = installUpdateAndRestart;
exports.getUpdateState = getUpdateState;
exports.resetUpdateState = resetUpdateState;
const electron_updater_1 = require("electron-updater");
Object.defineProperty(exports, "autoUpdater", { enumerable: true, get: function () { return electron_updater_1.autoUpdater; } });
exports.updateState = {
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
let mainWindow = null;
let autoInstallOnQuit = true;
/**
 * Initialize the auto-updater with the main window reference
 */
function initializeAutoUpdater(window) {
    mainWindow = window;
    // Configure auto-updater settings
    electron_updater_1.autoUpdater.autoDownload = true;
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = autoInstallOnQuit;
    // Set up feed URL - this will be configured via electron-builder
    // In development, updates are disabled
    if (process.env.NODE_ENV === "development") {
        console.log("[Auto-update] Running in development mode, updates disabled");
        electron_updater_1.autoUpdater.autoDownload = false;
        return;
    }
    setupEventListeners();
}
/**
 * Enable or disable automatic installation on quit
 */
function setAutoInstallOnQuit(value) {
    autoInstallOnQuit = value;
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = value;
}
/**
 * Set up event listeners for auto-updater
 */
function setupEventListeners() {
    // Fired when an update is available
    electron_updater_1.autoUpdater.on("update-available", (info) => {
        console.log("[Auto-update] Update available:", info.version);
        exports.updateState.available = true;
        exports.updateState.updateInfo = info;
        exports.updateState.checking = false;
        sendToRenderer("update:available", info);
    });
    // Fired when an update is NOT available
    electron_updater_1.autoUpdater.on("update-not-available", (info) => {
        console.log("[Auto-update] No update available, current version:", info.version);
        exports.updateState.available = false;
        exports.updateState.checking = false;
        sendToRenderer("update:not-available", info);
    });
    // Fired when an update has been downloaded
    electron_updater_1.autoUpdater.on("update-downloaded", (info) => {
        console.log("[Auto-update] Update downloaded:", info.version);
        exports.updateState.downloaded = true;
        exports.updateState.downloading = false;
        exports.updateState.downloadProgress = 100;
        sendToRenderer("update:downloaded", info);
    });
    // Fired during download progress
    electron_updater_1.autoUpdater.on("download-progress", (progress) => {
        console.log(`[Auto-update] Download progress: ${Math.round(progress.percent)}% (${progress.transferred}/${progress.total} bytes)`);
        exports.updateState.downloading = true;
        exports.updateState.downloadProgress = progress.percent;
        exports.updateState.bytesPerSecond = progress.bytesPerSecond;
        exports.updateState.percent = progress.percent;
        exports.updateState.transferred = progress.transferred;
        exports.updateState.total = progress.total;
        sendToRenderer("update:download-progress", progress);
    });
    // Fired when there's an error
    electron_updater_1.autoUpdater.on("error", (error) => {
        console.error("[Auto-update] Error:", error);
        exports.updateState.error = error.message;
        exports.updateState.checking = false;
        exports.updateState.downloading = false;
        sendToRenderer("update:error", error.message);
    });
}
/**
 * Check for updates
 */
async function checkForUpdates() {
    if (!mainWindow) {
        throw new Error("Main window not available");
    }
    if (process.env.NODE_ENV === "development") {
        // Simulate update check in development
        exports.updateState.checking = true;
        sendToRenderer("update:checking");
        setTimeout(() => {
            exports.updateState.checking = false;
            sendToRenderer("update:not-available", { version: "0.1.0" });
        }, 1000);
        return;
    }
    exports.updateState.checking = true;
    sendToRenderer("update:checking");
    try {
        await electron_updater_1.autoUpdater.checkForUpdates();
    }
    catch (error) {
        exports.updateState.checking = false;
        exports.updateState.error = error instanceof Error ? error.message : String(error);
        throw error;
    }
}
/**
 * Download the update (if autoDownload is false)
 */
async function downloadUpdate() {
    if (!mainWindow) {
        throw new Error("Main window not available");
    }
    if (process.env.NODE_ENV === "development") {
        // Simulate download in development
        exports.updateState.downloading = true;
        sendToRenderer("update:download-progress", { percent: 0 });
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            exports.updateState.downloadProgress = progress;
            exports.updateState.percent = progress;
            sendToRenderer("update:download-progress", {
                percent: progress,
                transferred: progress * 1000000,
                total: 10000000,
                bytesPerSecond: 5000000,
            });
            if (progress >= 100) {
                clearInterval(interval);
                exports.updateState.downloading = false;
                exports.updateState.downloaded = true;
                sendToRenderer("update:downloaded", { version: "0.2.0" });
            }
        }, 200);
        return;
    }
    try {
        await electron_updater_1.autoUpdater.downloadUpdate();
    }
    catch (error) {
        exports.updateState.downloading = false;
        throw error;
    }
}
/**
 * Install the downloaded update and restart the app
 */
function installUpdateAndRestart() {
    if (process.env.NODE_ENV === "development") {
        console.log("[Auto-update] Simulating update installation and restart");
        sendToRenderer("update:installing");
        // Don't actually restart in development
        return;
    }
    setImmediate(() => {
        electron_updater_1.autoUpdater.quitAndInstall();
    });
}
/**
 * Get the current update state
 */
function getUpdateState() {
    return { ...exports.updateState };
}
/**
 * Send a message to the renderer process
 */
function sendToRenderer(channel, ...args) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, ...args);
    }
}
/**
 * Reset the update state (e.g., after dismissing an update notification)
 */
function resetUpdateState() {
    exports.updateState.available = false;
    exports.updateState.downloaded = false;
    exports.updateState.checking = false;
    exports.updateState.downloading = false;
    exports.updateState.error = null;
    exports.updateState.downloadProgress = 0;
    exports.updateState.percent = 0;
}

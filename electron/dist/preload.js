"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Exposed APIs for the renderer process.
 * This provides a secure bridge between main and renderer processes.
 */
const electronAPI = {
    // App info
    getAppVersion: () => electron_1.ipcRenderer.invoke("get-app-version"),
    getPlatform: () => electron_1.ipcRenderer.invoke("get-platform"),
    getAppInfo: () => electron_1.ipcRenderer.invoke("menu-get-app-info"),
    // Window controls
    minimizeWindow: () => electron_1.ipcRenderer.invoke("minimize-window"),
    maximizeWindow: () => electron_1.ipcRenderer.invoke("maximize-window"),
    closeWindow: () => electron_1.ipcRenderer.invoke("close-window"),
    // Multi-window management
    getWindowId: () => electron_1.ipcRenderer.invoke("window:get-id"),
    openSessionInNewWindow: (sessionId) => electron_1.ipcRenderer.invoke("window:open-session", sessionId),
    listWindows: () => electron_1.ipcRenderer.invoke("window:list"),
    getWindowSession: () => electron_1.ipcRenderer.invoke("window:get-session"),
    setWindowSession: (sessionId) => electron_1.ipcRenderer.invoke("window:set-session", sessionId),
    // App controls
    quitApp: () => electron_1.ipcRenderer.invoke("quit-app"),
    // File operations
    selectFolder: () => electron_1.ipcRenderer.invoke("select-folder"),
    createFile: (directoryPath, fileName, options) => electron_1.ipcRenderer.invoke("create-file", directoryPath, fileName, options),
    readFile: (filePath) => electron_1.ipcRenderer.invoke("read-file", filePath),
    writeFile: (filePath, content, options) => electron_1.ipcRenderer.invoke("write-file", filePath, content, options),
    listDirectory: (dirPath, options) => electron_1.ipcRenderer.invoke("list-directory", dirPath, options),
    deleteFile: (filePath) => electron_1.ipcRenderer.invoke("delete-file", filePath),
    // Auto-update operations
    checkForUpdates: () => electron_1.ipcRenderer.invoke("update:check"),
    downloadUpdate: () => electron_1.ipcRenderer.invoke("update:download"),
    installUpdateAndRestart: () => electron_1.ipcRenderer.invoke("update:install-and-restart"),
    getUpdateState: () => electron_1.ipcRenderer.invoke("update:get-state"),
    resetUpdateState: () => electron_1.ipcRenderer.invoke("update:reset"),
    // Crash reporter operations
    getCrashReporterInfo: () => electron_1.ipcRenderer.invoke("crash-reporter:get-info"),
    getLastCrashReport: () => electron_1.ipcRenderer.invoke("crash-reporter:get-last-crash"),
    getAllCrashReports: () => electron_1.ipcRenderer.invoke("crash-reporter:get-all-crashes"),
    clearCrashReports: () => electron_1.ipcRenderer.invoke("crash-reporter:clear-crashes"),
    submitCrashReport: (crashPath, extra) => electron_1.ipcRenderer.invoke("crash-reporter:submit-crash", crashPath, extra),
    isCrashUploadEnabled: () => electron_1.ipcRenderer.invoke("crash-reporter:is-upload-enabled"),
    // Update event listeners
    onUpdateEvent: (callback) => {
        const updateEvents = [
            "update:checking",
            "update:available",
            "update:not-available",
            "update:downloaded",
            "update:download-progress",
            "update:error",
            "update:installing",
        ];
        updateEvents.forEach((event) => {
            electron_1.ipcRenderer.on(event, (_event, ...args) => callback(event, args[0]));
        });
    },
    removeUpdateListener: (channel, callback) => {
        electron_1.ipcRenderer.removeListener(channel, callback);
    },
    // Menu event listeners (renderer can listen for menu actions)
    onMenuAction: (callback) => {
        // Register listeners for all menu events
        const menuEvents = [
            "menu:new-chat",
            "menu:open-workspace",
            "menu:save-chat",
            "menu:export-chat",
            "menu:settings",
            "menu:find",
            "menu:find-next",
            "menu:find-previous",
            "menu:clear-chat",
            "menu:toggle-sidebar",
            "menu:check-updates",
        ];
        menuEvents.forEach((event) => {
            electron_1.ipcRenderer.on(event, (_event, ...args) => callback(event, ...args));
        });
    },
    // Remove a specific menu listener
    removeMenuListener: (channel, callback) => {
        electron_1.ipcRenderer.removeListener(channel, callback);
    },
    // Badge operations
    setBadgeCount: (count) => electron_1.ipcRenderer.invoke("badge:set-count", count),
    getBadgeCount: () => electron_1.ipcRenderer.invoke("badge:get-count"),
    // Platform detection
    isMac: process.platform === "darwin",
    isWindows: process.platform === "win32",
    isLinux: process.platform === "linux",
    isElectron: true,
};
// Expose the API to the renderer process via contextBridge
electron_1.contextBridge.exposeInMainWorld("electronAPI", electronAPI);

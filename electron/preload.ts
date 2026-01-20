import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposed APIs for the renderer process.
 * This provides a secure bridge between main and renderer processes.
 */
const electronAPI = {
  // App info
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getPlatform: () => ipcRenderer.invoke("get-platform"),
  getAppInfo: () => ipcRenderer.invoke("menu-get-app-info"),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke("minimize-window"),
  maximizeWindow: () => ipcRenderer.invoke("maximize-window"),
  closeWindow: () => ipcRenderer.invoke("close-window"),

  // Multi-window management
  getWindowId: () => ipcRenderer.invoke("window:get-id"),
  openSessionInNewWindow: (sessionId: string) =>
    ipcRenderer.invoke("window:open-session", sessionId),
  listWindows: () => ipcRenderer.invoke("window:list"),
  getWindowSession: () => ipcRenderer.invoke("window:get-session"),
  setWindowSession: (sessionId: string | null) =>
    ipcRenderer.invoke("window:set-session", sessionId),

  // App controls
  quitApp: () => ipcRenderer.invoke("quit-app"),

  // File operations
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  createFile: (directoryPath: string, fileName: string, options: any) =>
    ipcRenderer.invoke("create-file", directoryPath, fileName, options),
  readFile: (filePath: string) =>
    ipcRenderer.invoke("read-file", filePath),
  writeFile: (filePath: string, content: string, options: any) =>
    ipcRenderer.invoke("write-file", filePath, content, options),
  listDirectory: (dirPath: string, options: any) =>
    ipcRenderer.invoke("list-directory", dirPath, options),
  deleteFile: (filePath: string) =>
    ipcRenderer.invoke("delete-file", filePath),

  // Auto-update operations
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdateAndRestart: () => ipcRenderer.invoke("update:install-and-restart"),
  getUpdateState: () => ipcRenderer.invoke("update:get-state"),
  resetUpdateState: () => ipcRenderer.invoke("update:reset"),

  // Crash reporter operations
  getCrashReporterInfo: () => ipcRenderer.invoke("crash-reporter:get-info"),
  getLastCrashReport: () => ipcRenderer.invoke("crash-reporter:get-last-crash"),
  getAllCrashReports: () => ipcRenderer.invoke("crash-reporter:get-all-crashes"),
  clearCrashReports: () => ipcRenderer.invoke("crash-reporter:clear-crashes"),
  submitCrashReport: (crashPath: string, extra?: Record<string, string>) =>
    ipcRenderer.invoke("crash-reporter:submit-crash", crashPath, extra),
  isCrashUploadEnabled: () => ipcRenderer.invoke("crash-reporter:is-upload-enabled"),

  // Update event listeners
  onUpdateEvent: (callback: (event: string, data: any) => void) => {
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
      ipcRenderer.on(event, (_event, ...args) => callback(event, args[0]));
    });
  },

  removeUpdateListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback as any);
  },

  // Menu event listeners (renderer can listen for menu actions)
  onMenuAction: (callback: (event: string, ...args: any[]) => void) => {
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
      ipcRenderer.on(event, (_event, ...args) => callback(event, ...args));
    });
  },

  // Remove a specific menu listener
  removeMenuListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback as any);
  },

  // Badge operations
  setBadgeCount: (count: number) => ipcRenderer.invoke("badge:set-count", count),
  getBadgeCount: () => ipcRenderer.invoke("badge:get-count"),

  // Tray operations
  getTrayUnreadCount: () => ipcRenderer.invoke("tray:get-unread-count"),

  // Platform detection
  isMac: process.platform === "darwin",
  isWindows: process.platform === "win32",
  isLinux: process.platform === "linux",
  isElectron: true,
};

// Expose the API to the renderer process via contextBridge
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Type definitions for the exposed API
export type ElectronAPI = typeof electronAPI;

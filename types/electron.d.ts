/**
 * Type definitions for the Electron API exposed to the renderer process.
 * These types are automatically available throughout the application.
 */

import type {
  FileCreateOptions,
  FileCreateResponse,
  FileReadResponse,
  FileWriteOptions,
  FileWriteResponse,
  FileDeleteResponse,
  DirectoryListOptions,
  DirectoryListResponse,
} from "./files";

/**
 * Application information returned by the menu
 */
export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
}

/**
 * Menu event types that can be dispatched from the native menu
 */
export type MenuEvent =
  | "menu:new-chat"
  | "menu:open-workspace"
  | "menu:save-chat"
  | "menu:export-chat"
  | "menu:settings"
  | "menu:find"
  | "menu:find-next"
  | "menu:find-previous"
  | "menu:clear-chat"
  | "menu:toggle-sidebar"
  | "menu:check-updates";

/**
 * Callback type for menu action listeners
 */
export type MenuActionCallback = (event: MenuEvent, ...args: any[]) => void;

// ==================== Auto-update types ====================

/**
 * Update information from electron-updater
 */
export interface UpdateInfo {
  version: string;
  files?: Array<{
    url: string;
    sha512: string;
    size: number;
  }>;
  path?: string;
  sha512?: string;
  releaseDate?: string;
  releaseName?: string;
  releaseNotes?: string | Array<{ version: string; notes: string }>;
}

/**
 * Download progress information
 */
export interface UpdateDownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

/**
 * Current update state
 */
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

/**
 * Update event types sent from main process
 */
export type UpdateEvent =
  | "update:checking"
  | "update:available"
  | "update:not-available"
  | "update:downloaded"
  | "update:download-progress"
  | "update:error"
  | "update:installing";

/**
 * Callback type for update event listeners
 */
export type UpdateEventCallback = (event: UpdateEvent, data?: any) => void;

export interface ElectronAPI {
  getAppVersion(): Promise<string>;
  getPlatform(): Promise<string>;
  getAppInfo(): Promise<AppInfo>;
  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  quitApp(): Promise<void>;

  // File operations
  /**
   * Open a native folder selection dialog
   * @returns The selected folder path or null if cancelled
   */
  selectFolder(): Promise<string | null>;

  /**
   * Create a file in the specified directory
   * @param directoryPath - Directory where the file should be created
   * @param fileName - Name of the file to create
   * @param options - File creation options including content and conflict handling
   * @returns Details about the created file
   */
  createFile(
    directoryPath: string,
    fileName: string,
    options: FileCreateOptions
  ): Promise<FileCreateResponse>;

  /**
   * Read file contents
   * @param filePath - Full path to the file to read
   * @returns File contents along with metadata
   */
  readFile(filePath: string): Promise<FileReadResponse>;

  /**
   * Write content to a file (creates new or overwrites existing)
   * @param filePath - Full path to the file to write
   * @param content - Content to write to the file
   * @param options - File write options including encoding
   * @returns Details about the written file
   */
  writeFile(
    filePath: string,
    content: string,
    options?: FileWriteOptions
  ): Promise<FileWriteResponse>;

  /**
   * List directory contents with optional filtering
   * @param dirPath - Path to the directory to list
   * @param options - Options for filtering and recursion
   * @returns Directory contents with metadata
   */
  listDirectory(
    dirPath: string,
    options?: DirectoryListOptions
  ): Promise<DirectoryListResponse>;

  /**
   * Delete a file
   * @param filePath - Full path to the file to delete
   * @returns Confirmation of deletion
   */
  deleteFile(filePath: string): Promise<FileDeleteResponse>;

  // Auto-update operations
  /**
   * Check for available updates
   * @returns The current update state
   */
  checkForUpdates(): Promise<UpdateState>;

  /**
   * Download the available update
   * @returns The current update state
   */
  downloadUpdate(): Promise<UpdateState>;

  /**
   * Install the downloaded update and restart the application
   * @returns Success status
   */
  installUpdateAndRestart(): Promise<{ success: boolean }>;

  /**
   * Get the current update state
   * @returns The current update state
   */
  getUpdateState(): Promise<UpdateState>;

  /**
   * Reset the update state (dismiss notification)
   * @returns Success status
   */
  resetUpdateState(): Promise<{ success: boolean }>;

  /**
   * Register a callback for update events
   * @param callback - Function to call when an update event occurs
   */
  onUpdateEvent(callback: UpdateEventCallback): void;

  /**
   * Remove a specific update listener
   * @param channel - The update event channel
   * @param callback - The callback to remove
   */
  removeUpdateListener(channel: string, callback: (...args: any[]) => void): void;

  /**
   * Register a callback for menu actions
   * @param callback - Function to call when a menu item is clicked
   */
  onMenuAction(callback: MenuActionCallback): void;

  /**
   * Remove a specific menu listener
   * @param channel - The menu event channel
   * @param callback - The callback to remove
   */
  removeMenuListener(channel: string, callback: (...args: any[]) => void): void;

  /**
   * Set the badge count on the app icon (dock/taskbar)
   * @param count - The number to display (0 to clear)
   * @returns Success status with the current count
   */
  setBadgeCount(count: number): Promise<{ success: boolean; count: number }>;

  /**
   * Get the current badge count
   * @returns The current badge count
   */
  getBadgeCount(): Promise<number>;

  /**
   * Get the current tray unread count
   * @returns The current unread count shown in the tray
   */
  getTrayUnreadCount(): Promise<number>;

  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
  isElectron: true;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

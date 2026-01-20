"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeMenu = initializeMenu;
exports.rebuildMenu = rebuildMenu;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const state = {
    mainWindow: null,
};
/**
 * Initialize the application menu with a reference to the main window
 */
function initializeMenu(mainWindow) {
    state.mainWindow = mainWindow;
    const menu = buildMenu();
    electron_1.Menu.setApplicationMenu(menu);
}
/**
 * Build the File menu submenu
 */
function buildFileSubmenu() {
    const submenu = [
        {
            label: "New Chat",
            accelerator: "CmdOrCtrl+N",
            click: () => sendToRenderer("menu:new-chat"),
        },
        {
            label: "Open Workspace...",
            accelerator: "CmdOrCtrl+O",
            click: async () => {
                const result = await electron_1.dialog.showOpenDialog(state.mainWindow, {
                    properties: ["openDirectory"],
                    title: "Select Workspace Folder",
                });
                if (!result.canceled && result.filePaths.length > 0) {
                    sendToRenderer("menu:open-workspace", result.filePaths[0]);
                }
            },
        },
        { type: "separator" },
        {
            label: "Save Chat",
            accelerator: "CmdOrCtrl+S",
            click: () => sendToRenderer("menu:save-chat"),
        },
        {
            label: "Export Chat As...",
            accelerator: "CmdOrCtrl+Shift+S",
            click: async () => {
                const result = await electron_1.dialog.showSaveDialog(state.mainWindow, {
                    title: "Export Chat",
                    defaultPath: path_1.default.join(electron_1.app.getPath("documents"), "chat-export.txt"),
                    filters: [
                        { name: "Text Files", extensions: ["txt"] },
                        { name: "Markdown Files", extensions: ["md"] },
                        { name: "JSON Files", extensions: ["json"] },
                        { name: "All Files", extensions: ["*"] },
                    ],
                });
                if (!result.canceled && result.filePath) {
                    sendToRenderer("menu:export-chat", result.filePath);
                }
            },
        },
        { type: "separator" },
        {
            label: "Settings",
            accelerator: "CmdOrCtrl+,",
            click: () => sendToRenderer("menu:settings"),
        },
        { type: "separator" },
        { role: "close", label: "Close Window" },
    ];
    // Add Quit item for non-macOS platforms
    if (process.platform !== "darwin") {
        submenu.push({ type: "separator" });
        submenu.push({ role: "quit" });
    }
    return submenu;
}
/**
 * Build the Edit menu submenu
 */
function buildEditSubmenu() {
    return [
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { role: "pasteAndMatchStyle", label: "Paste and Match Style" },
        { role: "delete", label: "Delete" },
        { role: "selectAll", label: "Select All" },
        { type: "separator" },
        {
            label: "Find",
            accelerator: "CmdOrCtrl+F",
            click: () => sendToRenderer("menu:find"),
        },
        {
            label: "Find Next",
            accelerator: "CmdOrCtrl+G",
            click: () => sendToRenderer("menu:find-next"),
        },
        {
            label: "Find Previous",
            accelerator: "CmdOrCtrl+Shift+G",
            click: () => sendToRenderer("menu:find-previous"),
        },
        { type: "separator" },
        {
            label: "Clear Chat",
            accelerator: "CmdOrCtrl+Shift+K",
            click: () => sendToRenderer("menu:clear-chat"),
        },
    ];
}
/**
 * Build the View menu submenu
 */
function buildViewSubmenu() {
    return [
        {
            label: "Toggle Sidebar",
            accelerator: "CmdOrCtrl+B",
            click: () => sendToRenderer("menu:toggle-sidebar"),
        },
        {
            label: "Toggle Full Screen",
            accelerator: process.platform === "darwin" ? "Ctrl+Command+F" : "F11",
            click: () => {
                if (state.mainWindow) {
                    state.mainWindow.setFullScreen(!state.mainWindow.isFullScreen());
                }
            },
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        {
            label: "Developer Tools",
            accelerator: process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
            click: () => {
                state.mainWindow?.webContents.toggleDevTools();
            },
        },
        { type: "separator" },
        {
            label: "Reload",
            accelerator: "CmdOrCtrl+R",
            click: () => {
                state.mainWindow?.reload();
            },
        },
        {
            label: "Force Reload",
            accelerator: "CmdOrCtrl+Shift+R",
            click: () => {
                state.mainWindow?.webContents.reloadIgnoringCache();
            },
        },
    ];
}
/**
 * Build the Window menu submenu
 */
function buildWindowSubmenu() {
    return [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
        { type: "separator" },
        {
            label: "Reset Window Size",
            click: () => {
                if (state.mainWindow) {
                    state.mainWindow.setSize(1200, 800);
                    state.mainWindow.center();
                }
            },
        },
    ];
}
/**
 * Build the Help menu submenu
 */
function buildHelpSubmenu() {
    return [
        {
            label: "Documentation",
            click: async () => {
                await electron_1.shell.openExternal("https://docs.anthropic.com");
            },
        },
        {
            label: "API Reference",
            click: async () => {
                await electron_1.shell.openExternal("https://docs.anthropic.com/en/api/getting-started");
            },
        },
        {
            label: "GitHub Repository",
            click: async () => {
                await electron_1.shell.openExternal("https://github.com/anthropics/anthropic-sdk-typescript");
            },
        },
        { type: "separator" },
        {
            label: "Report an Issue...",
            click: async () => {
                await electron_1.shell.openExternal("https://github.com/anthropics/anthropic-sdk-typescript/issues");
            },
        },
        { type: "separator" },
        {
            label: "Check for Updates...",
            click: () => sendToRenderer("menu:check-updates"),
        },
        { type: "separator" },
        {
            label: `About ${electron_1.app.getName()}`,
            click: () => {
                electron_1.dialog.showMessageBox(state.mainWindow, {
                    type: "info",
                    title: `About ${electron_1.app.getName()}`,
                    message: electron_1.app.getName(),
                    detail: `Version: ${electron_1.app.getVersion()}\n\nAn AI-powered cowork workspace.\n\nBuilt with Electron, Next.js, and Claude.`,
                    buttons: ["OK"],
                });
            },
        },
    ];
}
/**
 * Build the application menu structure
 */
function buildMenu() {
    const template = [];
    // App menu (macOS only)
    if (process.platform === "darwin") {
        template.push({
            label: electron_1.app.getName(),
            submenu: [
                { role: "about", label: `About ${electron_1.app.getName()}` },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
            ],
        });
    }
    // File menu
    template.push({
        label: "File",
        submenu: buildFileSubmenu(),
    });
    // Edit menu
    template.push({
        label: "Edit",
        submenu: buildEditSubmenu(),
    });
    // View menu
    template.push({
        label: "View",
        submenu: buildViewSubmenu(),
    });
    // Window menu
    template.push({
        label: "Window",
        submenu: buildWindowSubmenu(),
    });
    // Help menu
    template.push({
        label: "Help",
        submenu: buildHelpSubmenu(),
    });
    return electron_1.Menu.buildFromTemplate(template);
}
/**
 * Send a message to the renderer process
 */
function sendToRenderer(channel, ...args) {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send(channel, ...args);
    }
}
/**
 * Rebuild the menu (useful for dynamic menu updates)
 */
function rebuildMenu() {
    if (state.mainWindow) {
        const menu = buildMenu();
        electron_1.Menu.setApplicationMenu(menu);
    }
}

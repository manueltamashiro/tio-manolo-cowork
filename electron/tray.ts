import { app, BrowserWindow, Menu, MenuItemConstructorOptions, nativeImage, Tray } from "electron";

interface TrayState {
  tray: Tray | null;
  mainWindow: BrowserWindow | null;
  unreadCount: number;
  isEnabled: boolean;
}

const state: TrayState = {
  tray: null,
  mainWindow: null,
  unreadCount: 0,
  isEnabled: true,
};

// Base64 encoded icon for the tray (16x16 PNG with a simple chat bubble design)
// This is a simple placeholder icon - in production, you would use an actual asset file
const TRAY_ICON_BASE64 = `iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAKCSURBVDjLpZPLS1RRFMV/972Z6qZTgxKzE1wTE3MTEzM8xnYWNjM8xncDIyM8z0YWFhn8TE+DiQYmJiIhHxQcjDdO3ppc5968690w0yb0C908qnn3uv3rvfVfQSqUSqVQqlUol9hX4BvgK3ARkAd2BL1hPbM0pALrgJjABrABrAbVVVRURF9dXf0d3xM4FpgB7QC7gFVVVbW19gU4CkwBH0a7qKro6up6rSvJzc2NlpeXT01OTl65rra2lhobG6ekpGQnJibm7NlsVl1d3VdCfX19h4aGBhsbG6d+v1+/ft0A7Nq166RSqTwNDAysrKysj4eHh6vRaBSr1SrLyspM7HZ7KyoqKoqVlZW9sbGxZWRkZOzOnTv09vaGEzC0tra2lZWVVVpDw8MDP5HwYDDYy8nJ8fX29v7GxsbF0dHR8f3HjkZ2d/f39v7m5+fHx8XlnZ2cf6+bm5pubm2tra+slEonE9fDw8P39vbW9vr6urr6+vo+np2dPTU1NTU9P09PR0oC9JNpsd7e3tvXZ3dz87Ozt4/0mS9vZ2u/7+/tb+/v6Fg4PDE9J7t7bS6fT09PR0O3fvsLu7e8PDw/8PDg7+e3p6RkXFxeFhYWdn5/PT01N/eXh4cHBweGqq6v7yMrKKisrq8vKysrExMTk5OTk5O/v7++/j4+Pv7m5ubW1tbWzs6urq1taWhoYG+vr6ePj4+IiPj4+KiYmJiYmNjY2NjU1NTU1MTEyMjIyMjExMTGi2traKigoKCgoKCgoKCgoIiIiISEhISEhISEhIR4eHh4dHR0dHR0dHR0dHR0dHRwcHBwcHBwcHBwcHBwcGxsbGxsbGxsbGxsbGxsbGxsbG5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm6A0L/A68Cj/wE0h/0z0Hh9DQAAAABJRU5ErkJggg==`;

// Empty icon template for macOS (dark mode support)
const TRAY_ICON_TEMPLATE_BASE64 = `iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFQSURBVDjLpZPNSsNQEIW/972Z1RUVMX4M2xMTE3MLMxMTMz4Y2NjZxETFxcTE8PEbCwsDIzMzPDMTc3N7M1NTW/I0QTEyO3zpw7c+69O/f+fWeQEj4H7f2Vej0er2+3zEYjF9R9Pf36+np2efnZ0dGR0dHR0fHx8fnl5WVhTqdTr1CCPV6vVar1Xa1Wu1qtRqNRvN6vVqtVqvVqtvtdrtcLstqtZqmaVqrVYqtVos6nY5isXiu2+2+s9lsKpVKptPpDIfD2W63y1yWzWbTbDZbpVJpunK5XFgqleSDQYBqtYrtdtvu9/vd7/d8l8slEolEu9zu9/tJp9Nks9nMJpN+u93u4XCI6qy8r9frLZfLOXc2m63ValWz2WxOp9P9V199b+D3A/UGfAD+A7cAb1BVVUVVVR8BH0A/3wMfANoAz4A/4DfwBe4H/UP3h/wAAAABJRU5ErkJggg==`;

/**
 * Create a tray icon from base64 data
 */
function createTrayIcon(isTemplate = false): Electron.NativeImage {
  const buffer = Buffer.from(isTemplate ? TRAY_ICON_TEMPLATE_BASE64 : TRAY_ICON_BASE64, "base64");
  return nativeImage.createFromBuffer(buffer);
}

/**
 * Build the tray context menu
 */
function buildTrayMenu(): Menu {
  const menuItems: MenuItemConstructorOptions[] = [
    {
      label: "New Chat",
      click: () => sendToRenderer("menu:new-chat"),
    },
    {
      label: "Show Window",
      click: () => showWindow(),
    },
    { type: "separator" },
  ];

  // Add unread count item if there are unread messages
  if (state.unreadCount > 0) {
    menuItems.push({
      label: `Unread Messages: ${state.unreadCount}`,
      enabled: false,
    });
    menuItems.push({ type: "separator" });
  }

  menuItems.push(
    {
      label: "Quit",
      click: () => app.quit(),
    }
  );

  return Menu.buildFromTemplate(menuItems);
}

/**
 * Update the tray menu (call when state changes)
 */
function updateTrayMenu(): void {
  if (state.tray) {
    state.tray.setContextMenu(buildTrayMenu());
    updateTrayTooltip();
  }
}

/**
 * Update the tray tooltip to show unread count
 */
function updateTrayTooltip(): void {
  if (!state.tray) return;

  const appName = app.getName();
  if (state.unreadCount > 0) {
    state.tray.setToolTip(`${appName}\n${state.unreadCount} unread message${state.unreadCount > 1 ? "s" : ""}`);
  } else {
    state.tray.setToolTip(appName);
  }
}

/**
 * Show the main window
 */
function showWindow(): void {
  if (state.mainWindow) {
    if (state.mainWindow.isMinimized()) {
      state.mainWindow.restore();
    }
    state.mainWindow.show();
    state.mainWindow.focus();
  }
}

/**
 * Toggle window visibility
 */
function toggleWindow(): void {
  if (!state.mainWindow) return;

  if (state.mainWindow.isVisible()) {
    state.mainWindow.hide();
  } else {
    showWindow();
  }
}

/**
 * Send a message to the renderer process
 */
function sendToRenderer(channel: string, ...args: any[]): void {
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send(channel, ...args);
  }
}

/**
 * Initialize the system tray
 */
export function initializeTray(mainWindow: BrowserWindow): void {
  state.mainWindow = mainWindow;

  // Create tray icon
  // On macOS, use template mode for better dark/light mode support
  const isMac = process.platform === "darwin";
  const trayIcon = createTrayIcon(!isMac); // Use template icon on macOS

  state.tray = new Tray(trayIcon);

  // Set initial context menu
  state.tray.setContextMenu(buildTrayMenu());

  // Set tooltip
  updateTrayTooltip();

  // Handle tray click events
  state.tray.on("click", () => {
    // On Windows/Linux, single click toggles window
    // On macOS, the context menu handles interaction
    if (process.platform !== "darwin") {
      toggleWindow();
    }
  });

  // Handle double-click (mainly for Windows/Linux)
  state.tray.on("double-click", () => {
    showWindow();
  });

  // Intercept window close to hide instead of quit when tray is active
  mainWindow.on("close", (event) => {
    // Check if app is quitting (not just closing window)
    // We use a custom property on the app object to track quit state
    const isQuitting = (app as any).isQuitting === true;

    if (!isQuitting && state.isEnabled) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

/**
 * Update the unread message count
 */
export function updateUnreadCount(count: number): void {
  state.unreadCount = Math.max(0, count);
  updateTrayMenu();
}

/**
 * Get the current unread count
 */
export function getUnreadCount(): number {
  return state.unreadCount;
}

/**
 * Enable or disable the tray (close to tray behavior)
 */
export function setTrayEnabled(enabled: boolean): void {
  state.isEnabled = enabled;
}

/**
 * Check if the tray is enabled
 */
export function isTrayEnabled(): boolean {
  return state.isEnabled;
}

/**
 * Destroy the tray (cleanup on app quit)
 */
export function destroyTray(): void {
  if (state.tray) {
    state.tray.destroy();
    state.tray = null;
  }
}

import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  /** Key combination (e.g., "Cmd+N", "Cmd+K", "Enter") */
  key: string;
  /** Callback function to execute when shortcut is triggered */
  callback: () => void;
  /** Description of what the shortcut does (for help display) */
  description: string;
  /** Whether to use Cmd or Ctrl key */
  metaKey?: boolean;
  /** Whether Shift key is required */
  shiftKey?: boolean;
  /** Whether Alt/Option key is required */
  altKey?: boolean;
}

/**
 * Custom hook for registering keyboard shortcuts
 *
 * @param shortcuts - Array of keyboard shortcuts to register
 * @param isEnabled - Whether shortcuts are enabled (default: true)
 * @param dependencies - Dependencies for the effect (default: [])
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  isEnabled: boolean = true,
  dependencies: any[] = []
) {
  // Parse key combination like "Cmd+N" into component parts
  const parseShortcut = useCallback((shortcut: string) => {
    const parts = shortcut.toLowerCase().split("+").map(s => s.trim());
    return {
      key: parts.pop() || "",
      metaKey: parts.includes("cmd") || parts.includes("ctrl"),
      shiftKey: parts.includes("shift"),
      altKey: parts.includes("alt") || parts.includes("option"),
    };
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in an input
      const target = e.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        const parsed = parseShortcut(shortcut.key);

        // Check if the pressed key matches the shortcut
        const keyMatches = e.key.toLowerCase() === parsed.key.toLowerCase();
        const metaMatches = e.metaKey === parsed.metaKey;
        const ctrlMatches = e.ctrlKey === parsed.metaKey;
        const shiftMatches = e.shiftKey === parsed.shiftKey;
        const altMatches = e.altKey === parsed.altKey;

        if (
          keyMatches &&
          (metaMatches || ctrlMatches) &&
          shiftMatches &&
          altMatches
        ) {
          // For some shortcuts like Enter in inputs, allow them
          if (isInputElement && !parsed.metaKey && !parsed.altKey) {
            continue; // Skip non-modifier shortcuts in inputs
          }

          e.preventDefault();
          e.stopPropagation();
          shortcut.callback();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, isEnabled, parseShortcut, ...dependencies]);
}

/**
 * Check if the platform is macOS
 */
export function isMacOS(): boolean {
  return typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/**
 * Format shortcut key for display (shows Cmd on Mac, Ctrl on other platforms)
 */
export function formatShortcutKey(shortcut: string): string {
  const mac = isMacOS();
  return shortcut
    .replace(/Cmd/g, mac ? "Cmd" : "Ctrl")
    .replace(/Option/g, mac ? "Option" : "Alt");
}

/**
 * Get all available keyboard shortcuts for the app
 */
export function getAppShortcuts(): Omit<KeyboardShortcut, "callback">[] {
  return [
    { key: "Cmd+N", description: "New chat" },
    { key: "Cmd+K", description: "Search conversations" },
    { key: "Cmd+,", description: "Open settings" },
    { key: "Cmd+/", description: "Show keyboard shortcuts" },
    { key: "Enter", description: "Send message" },
    { key: "Escape", description: "Close modal/dialog" },
  ];
}

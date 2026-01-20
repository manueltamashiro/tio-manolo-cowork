"use client";

import { useEffect } from "react";
import { isMacOS, getAppShortcuts } from "@/lib/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when user closes the modal */
  onClose: () => void;
}

/**
 * Modal displaying all available keyboard shortcuts in the app
 */
export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = getAppShortcuts();
  const mac = isMacOS();

  // Group shortcuts by category
  const navigationShortcuts = shortcuts.filter(s =>
    ["New chat", "Search conversations", "Open settings"].includes(s.description)
  );
  const editingShortcuts = shortcuts.filter(s =>
    ["Send message"].includes(s.description)
  );
  const generalShortcuts = shortcuts.filter(s =>
    ["Show keyboard shortcuts", "Close modal/dialog"].includes(s.description)
  );

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-neutral-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Platform hint */}
          <div className="text-sm text-neutral-400 bg-neutral-700/50 rounded-md px-3 py-2">
            {mac ? "Mac shortcuts shown" : "Windows/Linux shortcuts shown"}
          </div>

          {/* Navigation Shortcuts */}
          <ShortcutSection
            title="Navigation"
            shortcuts={navigationShortcuts}
          />

          {/* Editing Shortcuts */}
          <ShortcutSection
            title="Editing"
            shortcuts={editingShortcuts}
          />

          {/* General Shortcuts */}
          <ShortcutSection
            title="General"
            shortcuts={generalShortcuts}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface ShortcutSectionProps {
  title: string;
  shortcuts: Array<{ key: string; description: string }>;
}

function ShortcutSection({ title, shortcuts }: ShortcutSectionProps) {
  const mac = isMacOS();

  return (
    <div>
      <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
        {title}
      </h3>
      <div className="space-y-2">
        {shortcuts.map((shortcut) => {
          const keys = parseKeys(shortcut.key, mac);
          return (
            <div
              key={shortcut.key}
              className="flex items-center justify-between py-2"
            >
              <span className="text-neutral-300">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {keys.map((key, i) => (
                  <kbd
                    key={i}
                    className="px-2 py-1 text-xs font-medium text-neutral-300 bg-neutral-700 rounded border border-neutral-600 min-w-[24px] text-center"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Parse shortcut key string into individual key display names
 */
function parseKeys(shortcut: string, mac: boolean): string[] {
  const parts = shortcut.toLowerCase().split("+").map(s => s.trim());
  const keys: string[] = [];

  for (const part of parts) {
    switch (part) {
      case "cmd":
        keys.push(mac ? "Cmd" : "Ctrl");
        break;
      case "ctrl":
        keys.push("Ctrl");
        break;
      case "shift":
        keys.push(mac ? "Shift" : "Shift");
        break;
      case "alt":
      case "option":
        keys.push(mac ? "Option" : "Alt");
        break;
      case "enter":
        keys.push("Enter");
        break;
      case "escape":
      case "esc":
        keys.push("Esc");
        break;
      case ",":
        keys.push(",");
        break;
      case "/":
        keys.push("/");
        break;
      default:
        // Capitalize the key
        keys.push(part.charAt(0).toUpperCase() + part.slice(1));
    }
  }

  return keys;
}

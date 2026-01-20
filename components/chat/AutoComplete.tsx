"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { FileSystemEntry } from "@/types/files";

// ==================== Types ====================

export type SuggestionType = "command" | "file";

export interface Suggestion {
  type: SuggestionType;
  value: string;
  label: string;
  description?: string;
  icon?: "command" | "file" | "folder";
}

interface AutoCompleteProps {
  /** Current input value */
  input: string;
  /** Reference to the input element */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Whether autocomplete is enabled */
  disabled?: boolean;
  /** File tree entries for file suggestions */
  fileEntries?: FileSystemEntry[];
  /** Called when a suggestion is selected */
  onSelect: (value: string, replaceFrom: number, replaceTo: number) => void;
}

// ==================== Command Definitions ====================

const COMMANDS = [
  {
    name: "read",
    description: "Read and display file contents",
    icon: "command" as const,
  },
  {
    name: "write",
    description: "Write content to a file",
    icon: "command" as const,
  },
  {
    name: "create",
    description: "Create a new file",
    icon: "command" as const,
  },
  {
    name: "delete",
    description: "Delete a file or directory",
    icon: "command" as const,
  },
  {
    name: "list",
    description: "List directory contents",
    icon: "command" as const,
  },
  {
    name: "search",
    description: "Search for text in files",
    icon: "command" as const,
  },
  {
    name: "clear",
    description: "Clear the current conversation",
    icon: "command" as const,
  },
];

// ==================== AutoComplete Component ====================

export function AutoComplete({
  input,
  inputRef,
  disabled = false,
  fileEntries = [],
  onSelect,
}: AutoCompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerInfo, setTriggerInfo] = useState<{
    trigger: string;
    startIndex: number;
    query: string;
  } | null>(null);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // ==================== Helpers ====================

  /**
   * Flatten file tree to get all files and directories
   */
  const flattenFileEntries = useCallback((entries: FileSystemEntry[], depth = 0): FileSystemEntry[] => {
    const maxDepth = 5; // Limit depth for performance
    if (depth > maxDepth) return [];

    const result: FileSystemEntry[] = [];
    for (const entry of entries) {
      result.push(entry);
      if (entry.children) {
        result.push(...flattenFileEntries(entry.children, depth + 1));
      }
    }
    return result;
  }, []);

  /**
   * Get file icon type based on entry type
   */
  const getFileIconType = (type: "file" | "directory" | "symlink"): Suggestion["icon"] => {
    return type === "directory" ? "folder" : "file";
  };

  /**
   * Generate suggestions based on current input
   */
  const generateSuggestions = useCallback((value: string) => {
    if (!value) return null;

    // Check for command trigger (/)
    const commandMatch = value.match(/\/(\w*)$/);
    if (commandMatch) {
      const query = commandMatch[1].toLowerCase();
      const startIndex = commandMatch.index!;
      const filtered = COMMANDS.filter((cmd) =>
        cmd.name.toLowerCase().startsWith(query)
      );

      if (filtered.length > 0) {
        return {
          trigger: "/",
          startIndex,
          query,
          suggestions: filtered.map((cmd) => ({
            type: "command" as SuggestionType,
            value: cmd.name,
            label: `/${cmd.name}`,
            description: cmd.description,
            icon: cmd.icon,
          })),
        };
      }
    }

    // Check for file trigger (@)
    const fileMatch = value.match(/@(\w*)$/);
    if (fileMatch) {
      const query = fileMatch[1].toLowerCase();
      const startIndex = fileMatch.index!;
      const allFiles = flattenFileEntries(fileEntries);
      const filtered = allFiles.filter((entry) =>
        entry.name.toLowerCase().includes(query)
      ).slice(0, 10); // Limit to 10 suggestions

      if (filtered.length > 0) {
        return {
          trigger: "@",
          startIndex,
          query,
          suggestions: filtered.map((entry) => ({
            type: "file" as SuggestionType,
            value: entry.path,
            label: entry.name,
            description: entry.path,
            icon: getFileIconType(entry.type),
          })),
        };
      }
    }

    return null;
  }, [fileEntries, flattenFileEntries]);

  // ==================== Effects ====================

  // Update suggestions when input changes
  useEffect(() => {
    if (disabled) {
      setShowSuggestions(false);
      setTriggerInfo(null);
      return;
    }

    const result = generateSuggestions(input);
    if (result && result.suggestions.length > 0) {
      setTriggerInfo({
        trigger: result.trigger,
        startIndex: result.startIndex,
        query: result.query,
      });
      setSuggestions(result.suggestions);
      setSelectedIndex(0);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setTriggerInfo(null);
    }
  }, [input, disabled, generateSuggestions]);

  // Scroll selected item into view
  useEffect(() => {
    if (showSuggestions && selectedIndex >= 0) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex, showSuggestions]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!showSuggestions || disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if input is focused
      if (document.activeElement !== inputRef.current) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % suggestions.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(
            (i) => (i - 1 + suggestions.length) % suggestions.length
          );
          break;
        case "Enter":
          e.preventDefault();
          handleSelect(suggestions[selectedIndex]);
          break;
        case "Escape":
          e.preventDefault();
          setShowSuggestions(false);
          break;
        case "Tab":
          e.preventDefault();
          handleSelect(suggestions[selectedIndex]);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSuggestions, suggestions, selectedIndex, disabled, inputRef]);

  // Close suggestions when clicking outside
  useEffect(() => {
    if (!showSuggestions) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions, inputRef]);

  // ==================== Handlers ====================

  const handleSelect = (suggestion: Suggestion) => {
    if (!triggerInfo) return;

    const { startIndex, trigger } = triggerInfo;
    const replaceFrom = startIndex;
    const replaceTo = startIndex + trigger.length + triggerInfo.query.length;

    // For commands, include the space after
    const value = suggestion.type === "command"
      ? `${trigger}${suggestion.value} `
      : suggestion.value;

    onSelect(value, replaceFrom, replaceTo);
    setShowSuggestions(false);
    setTriggerInfo(null);

    // Refocus input
    inputRef.current?.focus();
  };

  // ==================== Render ====================

  if (!showSuggestions || suggestions.length === 0) {
    return null;
  }

  const getItemIcon = (icon?: Suggestion["icon"]) => {
    switch (icon) {
      case "command":
        return (
          <svg
            className="w-4 h-4 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        );
      case "file":
        return (
          <svg
            className="w-4 h-4 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
      case "folder":
        return (
          <svg
            className="w-4 h-4 text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={suggestionsRef}
      className="absolute z-[1200] w-full max-w-md bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-fade-in"
      role="listbox"
      aria-label="Suggestions"
      style={{
        bottom: "100%",
        marginBottom: "4px",
      }}
    >
      <div className="max-h-60 overflow-y-auto py-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.type}-${suggestion.value}`}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            onClick={() => handleSelect(suggestion)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
              index === selectedIndex
                ? "bg-blue-600/30 text-blue-300"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
            }`}
          >
            <span className="shrink-0">{getItemIcon(suggestion.icon)}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {suggestion.label}
              </div>
              {suggestion.description && (
                <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {suggestion.description}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded">
            <span aria-hidden="true">↑↓</span>
            <span className="sr-only">Arrow keys</span>
          </kbd>
          <span>to navigate</span>
          <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded">
            Enter
          </kbd>
          <span>to select</span>
          <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded">
            Esc
          </kbd>
          <span>to close</span>
        </div>
      </div>
    </div>
  );
}

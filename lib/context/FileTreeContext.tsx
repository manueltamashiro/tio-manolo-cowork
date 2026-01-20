'use client';

/**
 * File Tree Context - Provides global state management for the file tree sidebar
 * Manages folder selection, expansion state, and file system entries
 */

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import type { FileSystemEntry } from '@/types/files';
import { useFileTreeState as useFileTreeUIState } from '../storage/ui-state';

// ==================== Types ====================

export interface FileTreeContextValue {
  // State
  rootPath: string | null;
  entries: FileSystemEntry[];
  expandedPaths: Set<string>;
  selectedPath: string | null;
  isLoading: boolean;
  error: string | null;

  // Operations
  selectFolder: (path: string) => Promise<void>;
  toggleExpand: (path: string) => void;
  selectPath: (path: string | null) => void;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const FileTreeContext = createContext<FileTreeContextValue | undefined>(undefined);

// ==================== Provider ====================

interface FileTreeProviderProps {
  children: React.ReactNode;
  initialPath?: string;
}

export function FileTreeProvider({ children, initialPath }: FileTreeProviderProps) {
  const [rootPath, setRootPath] = useState<string | null>(initialPath ?? null);
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state persistence
  const {
    get: getSavedFileTreeState,
    setRootPath: saveRootPath,
    setExpandedPaths: saveExpandedPaths,
    setSelectedPath: saveSelectedPath,
  } = useFileTreeUIState();

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

  /**
   * Load directory entries for a given path
   */
  const loadDirectory = useCallback(async (path: string): Promise<FileSystemEntry[]> => {
    if (isElectron) {
      // In Electron, we'll use a simpler approach - just list the directory
      // For now, use the API route which also works in Electron
      const response = await fetch('/api/files/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          options: {
            includeHidden: false,
            recursive: false,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load directory');
      }

      const data = await response.json();
      return data.entries;
    } else {
      // In web mode, use the API route
      const response = await fetch('/api/files/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          options: {
            includeHidden: false,
            recursive: false,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load directory');
      }

      const data = await response.json();
      return data.entries;
    }
  }, [isElectron]);

  /**
   * Select a folder and load its contents
   */
  const selectFolder = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const newEntries = await loadDirectory(path);
      setRootPath(path);
      setEntries(newEntries);
      setExpandedPaths(new Set());
      setSelectedPath(null);
      // Persist the root path
      saveRootPath(path);
      // Clear expanded paths and selected path
      saveExpandedPaths(new Set());
      saveSelectedPath(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load folder';
      setError(message);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [loadDirectory, saveRootPath, saveExpandedPaths, saveSelectedPath]);

  /**
   * Toggle expansion state for a directory
   */
  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      // Persist the expanded paths
      saveExpandedPaths(newSet);
      return newSet;
    });
  }, [saveExpandedPaths]);

  /**
   * Select a file or folder path
   */
  const selectPath = useCallback((path: string | null) => {
    setSelectedPath(path);
    // Persist the selected path
    saveSelectedPath(path);
  }, [saveSelectedPath]);

  /**
   * Refresh the current directory
   */
  const refresh = useCallback(async () => {
    if (rootPath) {
      await selectFolder(rootPath);
    }
  }, [rootPath, selectFolder]);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Restore saved state on mount
  useEffect(() => {
    const savedState = getSavedFileTreeState();

    // Restore root path if it exists
    if (savedState.rootPath) {
      selectFolder(savedState.rootPath);
    }

    // Restore expanded paths after entries are loaded
    if (savedState.expandedPaths.size > 0) {
      setExpandedPaths(savedState.expandedPaths);
    }

    // Restore selected path
    if (savedState.selectedPath) {
      setSelectedPath(savedState.selectedPath);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== Context Value ====================

  const value: FileTreeContextValue = {
    rootPath,
    entries,
    expandedPaths,
    selectedPath,
    isLoading,
    error,
    selectFolder,
    toggleExpand,
    selectPath,
    refresh,
    clearError,
  };

  return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>;
}

// ==================== Hook ====================

/**
 * Hook to access the file tree context
 */
export function useFileTreeContext(): FileTreeContextValue {
  const context = useContext(FileTreeContext);
  if (!context) {
    throw new Error('useFileTreeContext must be used within a FileTreeProvider');
  }
  return context;
}

/**
 * Hook to access the file tree context safely (returns null if not within provider)
 */
export function useFileTreeContextSafe(): FileTreeContextValue | null {
  return useContext(FileTreeContext) ?? null;
}

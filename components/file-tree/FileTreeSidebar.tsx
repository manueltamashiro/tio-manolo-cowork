'use client';

import { useState, useCallback } from 'react';
import { FileTreeProvider, useFileTreeContext } from '@/lib/context/FileTreeContext';
import { FileTree } from './FileTree';

/**
 * Check if running in Electron environment
 */
function isElectronEnv(): boolean {
  return typeof window !== 'undefined' && 'electronAPI' in window;
}

/**
 * FileTreeSidebarInner - The inner sidebar component that uses the context
 */
function FileTreeSidebarInner() {
  const { rootPath, selectFolder, refresh, isLoading } = useFileTreeContext();
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);

  // Handle folder selection
  const handleSelectFolder = useCallback(async () => {
    setIsOpeningFolder(true);

    try {
      if (isElectronEnv()) {
        // Use Electron's native folder picker
        const path = await window.electronAPI.selectFolder();
        if (path) {
          await selectFolder(path);
        }
      } else {
        // Fallback for web mode - prompt for path
        // In production, you might want to use a different approach
        const path = prompt('Enter folder path:');
        if (path) {
          await selectFolder(path);
        }
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    } finally {
      setIsOpeningFolder(false);
    }
  }, [selectFolder]);

  // Get folder name from path for display
  const getFolderName = useCallback(() => {
    if (!rootPath) return null;
    const parts = rootPath.split('/');
    return parts[parts.length - 1] || parts[parts.length - 2] || rootPath;
  }, [rootPath]);

  const folderName = getFolderName();

  return (
    <div className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
            Files
          </h2>
          {rootPath && (
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-1 text-neutral-400 hover:text-white transition-colors disabled:opacity-50 rounded hover:bg-neutral-800"
              title="Refresh"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Current folder display / select button */}
        {rootPath ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-neutral-500 truncate">Current folder:</p>
              <p
                className="text-sm text-white truncate font-medium"
                title={rootPath}
              >
                {folderName}
              </p>
            </div>
            <button
              onClick={handleSelectFolder}
              disabled={isOpeningFolder}
              className="p-1.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-50 rounded hover:bg-neutral-800"
              title="Open different folder"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={handleSelectFolder}
            disabled={isOpeningFolder}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isOpeningFolder ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Opening...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                Open Folder
              </>
            )}
          </button>
        )}
      </div>

      {/* File tree */}
      <FileTree />
    </div>
  );
}

/**
 * FileTreeSidebar - The sidebar component with file tree functionality
 *
 * This component includes the FileTreeProvider and renders the sidebar
 * with folder selection and file tree display.
 */
export function FileTreeSidebar() {
  return (
    <FileTreeProvider>
      <FileTreeSidebarInner />
    </FileTreeProvider>
  );
}

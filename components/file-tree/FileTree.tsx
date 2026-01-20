'use client';

import { useFileTreeContext } from '@/lib/context/FileTreeContext';
import { FileTreeNode } from './FileTreeNode';

// Screen reader announcement for dynamic content changes
function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => document.body.removeChild(announcement), 1000);
}

/**
 * FileTree - The main file tree component
 *
 * Displays the root entries of the selected folder as a collapsible tree.
 * Handles loading, empty, and error states.
 */
export function FileTree() {
  const { entries, isLoading, error, rootPath, clearError } = useFileTreeContext();

  // Empty state - no folder selected
  if (!rootPath && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6" role="status" aria-live="polite">
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto text-neutral-600 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <p className="text-neutral-500 text-sm">Select a folder to browse</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6" role="status" aria-live="polite" aria-busy="true">
        <div className="flex flex-col items-center">
          <svg className="w-8 h-8 animate-spin text-blue-500 mb-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
          <p className="text-neutral-500 text-sm">Loading folder...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6" role="alert" aria-live="assertive">
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto text-red-500 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-red-400 text-sm mb-2">Failed to load folder</p>
          <p className="text-neutral-500 text-xs mb-3">{error}</p>
          <button
            onClick={clearError}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Empty directory
  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6" role="status" aria-live="polite">
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto text-neutral-600 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-neutral-500 text-sm">This folder is empty</p>
        </div>
      </div>
    );
  }

  // Render the tree
  return (
    <div
      className="flex-1 overflow-y-auto py-2"
      role="tree"
      aria-label="File browser"
      aria-describedby={entries.length > 0 ? 'file-tree-count' : undefined}
    >
      {entries.length > 0 && (
        <span id="file-tree-count" className="sr-only">
          {entries.length} {entries.length === 1 ? 'item' : 'items'} in file tree
        </span>
      )}
      {entries.map((entry) => (
        <FileTreeNode key={entry.path} entry={entry} />
      ))}
    </div>
  );
}

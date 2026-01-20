'use client';

import { useState, useCallback, useRef } from 'react';
import type { FileSystemEntry } from '@/types/files';
import { useFileTreeContext } from '@/lib/context/FileTreeContext';
import { useToast } from '@/lib/context/ToastContext';
import { FileDeleteConfirm } from '@/components/ui/ConfirmDialog';
import { ImagePreviewModal, type ImagePreviewData } from '@/components/ui/ImagePreviewModal';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';
import {
  Trash2,
  FileText,
  FolderOpen,
  Copy,
  Edit3,
  MessageSquare,
  Eye
} from 'lucide-react';

interface FileTreeNodeProps {
  entry: FileSystemEntry;
  level?: number;
  /** Callback when a file is deleted */
  onFileDeleted?: (path: string) => void;
  /** Callback when a file is dragged */
  onFileDragStart?: (entry: FileSystemEntry) => void;
}

/**
 * Check if a file is an image based on its extension
 */
function isImageFile(fileName: string): boolean {
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp'].includes(ext || '');
}

/**
 * Get file icon based on file extension
 */
function getFileIcon(fileName: string): React.ReactNode {
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';

  // Code files
  if (['js', 'jsx', 'ts', 'tsx', 'vue', 'svelte'].includes(ext || '')) {
    return (
      <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    );
  }

  // HTML/CSS
  if (['html', 'css', 'scss', 'less'].includes(ext || '')) {
    return (
      <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }

  // JSON/XML
  if (['json', 'xml', 'yaml', 'yml'].includes(ext || '')) {
    return (
      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    );
  }

  // Markdown
  if (['md', 'markdown'].includes(ext || '')) {
    return (
      <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }

  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'].includes(ext || '')) {
    return (
      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }

  // Default file icon
  return (
    <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

/**
 * FileTreeNode - A single node in the file tree
 *
 * Displays a file or folder with appropriate icons and expand/collapse functionality.
 * Folders can be expanded to show their children (loaded dynamically).
 * Files can be deleted with a confirmation dialog.
 */
export function FileTreeNode({ entry, level = 0, onFileDeleted, onFileDragStart }: FileTreeNodeProps) {
  const { expandedPaths, selectedPath, toggleExpand, selectPath, rootPath, refresh } = useFileTreeContext();
  const { success: showSuccess, error: showError } = useToast();
  const [children, setChildren] = useState<FileSystemEntry[]>(entry.children || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [requiresRecursive, setRequiresRecursive] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileSystemEntry;
  } | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [previewImage, setPreviewImage] = useState<ImagePreviewData | null>(null);

  const nodeRef = useRef<HTMLDivElement>(null);

  const isDirectory = entry.type === 'directory';
  const isExpanded = expandedPaths.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const hasChildren = children.length > 0;

  // Build full path for display
  const getFullPath = () => {
    if (rootPath) {
      // entry.path is relative to rootPath
      return `${rootPath}${entry.path.startsWith('/') ? '' : '/'}${entry.path}`;
    }
    return entry.path;
  };

  // Load children when expanding a directory
  const handleToggle = useCallback(async () => {
    if (!isDirectory) return;

    if (isExpanded) {
      // Collapse - just toggle the state
      toggleExpand(entry.path);
    } else {
      // Expand - if no children loaded, fetch them
      if (!hasChildren && !entry.children) {
        setIsLoading(true);
        setError(null);

        try {
          const fullPath = getFullPath();
          const response = await fetch('/api/files/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: fullPath,
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
          setChildren(data.entries);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load directory');
        } finally {
          setIsLoading(false);
        }
      }

      toggleExpand(entry.path);
    }
  }, [isDirectory, isExpanded, hasChildren, entry.path, entry.children, toggleExpand, getFullPath]);

  // Handle selection
  const handleClick = useCallback(() => {
    selectPath(entry.path);
  }, [entry.path, selectPath]);

  // Keyboard navigation with full tree support
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (isDirectory) {
            handleToggle();
          } else {
            handleClick();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isDirectory && !isExpanded) {
            handleToggle();
          } else if (isDirectory && isExpanded && hasChildren) {
            // Move focus to first child
            const firstChild = nodeRef.current?.nextElementSibling as HTMLElement;
            firstChild?.querySelector('[role="treeitem"]')?.getAttribute('tabindex') === '0' &&
              (firstChild.querySelector('[role="treeitem"]') as HTMLElement)?.focus();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (isDirectory && isExpanded) {
            handleToggle();
          } else if (level > 0) {
            // Move focus to parent
            const parentTreeItem = nodeRef.current?.parentElement?.previousElementSibling as HTMLElement;
            parentTreeItem?.focus();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          // Move to next tree item
          const nextTreeItem = nodeRef.current?.parentElement?.nextElementSibling?.querySelector('[role="treeitem"]') as HTMLElement;
          if (nextTreeItem) {
            nextTreeItem.focus();
          } else if (isDirectory && isExpanded && hasChildren) {
            // Move to first child
            const firstChild = nodeRef.current?.nextElementSibling?.querySelector('[role="treeitem"]') as HTMLElement;
            firstChild?.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          // Move to previous tree item
          const prevTreeItem = nodeRef.current?.parentElement?.previousElementSibling?.querySelector('[role="treeitem"]') as HTMLElement;
          if (prevTreeItem) {
            prevTreeItem.focus();
          }
          break;
        case 'Home':
          e.preventDefault();
          // Move to first tree item
          const firstTreeItem = nodeRef.current?.closest('[role="tree"]')?.querySelector('[role="treeitem"]') as HTMLElement;
          firstTreeItem?.focus();
          break;
        case 'End':
          e.preventDefault();
          // Move to last tree item
          const allTreeItems = nodeRef.current?.closest('[role="tree"]')?.querySelectorAll('[role="treeitem"]');
          const lastTreeItem = allTreeItems?.[allTreeItems.length - 1] as HTMLElement;
          lastTreeItem?.focus();
          break;
      }
    },
    [isDirectory, isExpanded, hasChildren, level, handleToggle, handleClick]
  );

  // Handle delete button click
  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // For directories, check if we need recursive deletion
    if (isDirectory && hasChildren) {
      setRequiresRecursive(true);
    } else {
      setRequiresRecursive(false);
    }
    setShowDeleteConfirm(true);
  }, [isDirectory, hasChildren]);

  // Confirm deletion
  const handleConfirmDelete = useCallback(async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);

    try {
      const fullPath = getFullPath();

      const response = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: fullPath,
          basePath: rootPath,
          options: {
            recursive: requiresRecursive,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete file');
      }

      const data = await response.json();
      showSuccess(`Deleted ${data.isDirectory ? 'directory' : 'file'}: ${data.fileName}`);

      // Notify parent component
      if (onFileDeleted) {
        onFileDeleted(entry.path);
      }

      // Refresh the file tree to reflect changes
      if (refresh) {
        await refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete file';
      showError(message);
    } finally {
      setIsDeleting(false);
    }
  }, [getFullPath, rootPath, requiresRecursive, showSuccess, showError, onFileDeleted, entry.path, refresh]);

  // Cancel deletion
  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setRequiresRecursive(false);
  }, []);

  // Handle drag start for files
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (isDirectory) {
      e.preventDefault();
      return;
    }

    // Set drag data
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'file',
      path: entry.path,
      name: entry.name,
      fullPath: getFullPath(),
    }));

    // Call the drag start callback if provided
    if (onFileDragStart) {
      onFileDragStart(entry);
    }
  }, [isDirectory, entry, onFileDragStart, getFullPath]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
    });
    // Select this item when context menu is opened
    selectPath(entry.path);
  }, [entry, selectPath]);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle copy path
  const handleCopyPath = useCallback(async () => {
    const fullPath = getFullPath();
    try {
      await navigator.clipboard.writeText(fullPath);
      showSuccess('Path copied to clipboard');
    } catch (err) {
      showError('Failed to copy path');
    }
  }, [getFullPath, showSuccess, showError]);

  // Handle rename
  const handleRename = useCallback(() => {
    setNewName(entry.name);
    setShowRenameDialog(true);
  }, [entry.name]);

  // Confirm rename
  const handleConfirmRename = useCallback(async () => {
    if (!newName.trim() || newName === entry.name) {
      setShowRenameDialog(false);
      return;
    }

    try {
      const fullPath = getFullPath();
      const pathParts = fullPath.split(/[/\\]/);
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');

      const response = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPath: fullPath,
          newPath,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to rename');
      }

      showSuccess(`Renamed to ${newName}`);

      // Refresh the file tree
      if (refresh) {
        await refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename';
      showError(message);
    } finally {
      setShowRenameDialog(false);
    }
  }, [newName, entry.name, getFullPath, showSuccess, showError, refresh]);

  // Handle insert in chat (dispatch custom event)
  const handleInsertInChat = useCallback(() => {
    const fullPath = getFullPath();
    // Dispatch a custom event that the chat interface can listen to
    window.dispatchEvent(new CustomEvent('insert-file-in-chat', {
      detail: {
        path: entry.path,
        fullPath,
        name: entry.name,
      },
    }));
    showSuccess(`File reference inserted in chat`);
  }, [entry, getFullPath, showSuccess]);

  // Handle image preview
  const handlePreview = useCallback(async () => {
    const fullPath = getFullPath();

    try {
      const response = await fetch('/api/files/image-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load image');
      }

      const data = await response.json();
      setPreviewImage({
        src: `data:${data.mediaType};base64,${data.base64Data}`,
        fileName: data.fileName,
        filePath: data.filePath,
        mediaType: data.mediaType,
        width: data.width,
        height: data.height,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load image';
      showError(message);
    }
  }, [getFullPath, showError]);

  // Close image preview
  const closeImagePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  // Build context menu items
  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    // Open option (for both files and folders)
    items.push({
      label: isDirectory ? 'Open Folder' : 'Open File',
      icon: isDirectory ? <FolderOpen size={14} /> : <FileText size={14} />,
      onClick: isDirectory ? handleToggle : handleClick,
    });

    // Preview option (only for image files)
    if (!isDirectory && isImageFile(entry.name)) {
      items.push({
        label: 'Preview Image',
        icon: <Eye size={14} />,
        onClick: handlePreview,
      });
    }

    // Insert in chat (only for files)
    if (!isDirectory) {
      items.push({
        label: 'Insert in Chat',
        icon: <MessageSquare size={14} />,
        onClick: handleInsertInChat,
      });
    }

    // Rename
    items.push({
      label: 'Rename',
      icon: <Edit3 size={14} />,
      onClick: handleRename,
    });

    // Copy path
    items.push({
      label: 'Copy Path',
      icon: <Copy size={14} />,
      onClick: handleCopyPath,
    });

    // Delete
    items.push({
      label: 'Delete',
      icon: <Trash2 size={14} />,
      onClick: () => {
        if (isDirectory && hasChildren) {
          setRequiresRecursive(true);
        } else {
          setRequiresRecursive(false);
        }
        setShowDeleteConfirm(true);
      },
      variant: 'danger',
    });

    return items;
  }, [isDirectory, hasChildren, handleToggle, handleClick, handleInsertInChat, handleRename, handleCopyPath, handlePreview, entry.name]);

  return (
    <div>
      {/* Node row */}
      <div
        ref={nodeRef}
        className={`
          flex items-center py-1.5 px-2 cursor-pointer group
          hover:bg-neutral-800 transition-colors
          ${isSelected ? 'bg-blue-900/30 text-blue-300' : 'text-neutral-300'}
          ${isDeleting ? 'opacity-50' : ''}
          ${!isDirectory ? 'draggable-file' : ''}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={isDirectory ? handleToggle : handleClick}
        onKeyDown={handleKeyDown}
        onDragStart={handleDragStart}
        onContextMenu={handleContextMenu}
        draggable={!isDirectory}
        role="treeitem"
        tabIndex={isSelected ? 0 : -1}
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={isSelected}
        aria-level={level + 1}
        aria-label={`${entry.type === 'directory' ? 'Folder' : 'File'}: ${entry.name}`}
      >
        {/* Expand/collapse icon for directories */}
        {isDirectory && (
          <span className="mr-1 flex-shrink-0">
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin text-neutral-500" fill="none" viewBox="0 0 24 24">
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
              <svg
                className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </span>
        )}

        {/* File/folder icon */}
        <span className="mr-2 flex-shrink-0">
          {isDirectory ? (
            <svg
              className={`w-4 h-4 ${isExpanded ? 'text-blue-400' : 'text-neutral-400'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isExpanded ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              )}
            </svg>
          ) : (
            getFileIcon(entry.name)
          )}
        </span>

        {/* File/folder name */}
        <span className="text-sm truncate flex-1">{entry.name}</span>

        {/* Delete button (shown on hover) */}
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-700 rounded text-neutral-500 hover:text-red-400 transition-opacity focus:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Delete ${entry.name}`}
          title={`Delete ${entry.name}`}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="ml-8 py-1 px-2 text-xs text-red-400"
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        >
          {error}
        </div>
      )}

      {/* Children (if expanded) */}
      {isExpanded && hasChildren && (
        <div role="group">
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              level={level + 1}
              onFileDeleted={onFileDeleted}
              onFileDragStart={onFileDragStart}
            />
          ))}
        </div>
      )}

      {/* Empty state for expanded directory */}
      {isExpanded && !isLoading && !hasChildren && !error && (
        <div
          className="py-1 px-2 text-xs text-neutral-500 italic"
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        >
          Empty folder
        </div>
      )}

      {/* Delete confirmation dialog */}
      <FileDeleteConfirm
        filePath={getFullPath()}
        isDirectory={isDirectory}
        requiresRecursive={requiresRecursive}
        isOpen={showDeleteConfirm}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Rename dialog */}
      {showRenameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="rename-title">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowRenameDialog(false)}
            aria-hidden="true"
          />
          <div className="relative bg-neutral-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 id="rename-title" className="text-lg font-semibold text-white mb-4">
              Rename {isDirectory ? 'Folder' : 'File'}
            </h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmRename();
                } else if (e.key === 'Escape') {
                  setShowRenameDialog(false);
                }
              }}
              className="w-full px-3 py-2 bg-neutral-700 text-white rounded-md border border-neutral-600 focus:outline-none focus:border-blue-500 mb-4"
              autoFocus
              aria-label="New name"
            />
            <div className="flex flex-row-reverse gap-3">
              <button
                type="button"
                onClick={handleConfirmRename}
                disabled={!newName.trim() || newName === entry.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setShowRenameDialog(false)}
                className="px-4 py-2 bg-neutral-700 text-white rounded-md hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          onClose={closeContextMenu}
          items={getContextMenuItems()}
        />
      )}

      {/* Image preview modal */}
      {previewImage && (
        <ImagePreviewModal
          isOpen={!!previewImage}
          imageData={previewImage}
          onClose={closeImagePreview}
        />
      )}
    </div>
  );
}

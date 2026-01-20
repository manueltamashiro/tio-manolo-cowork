"use client";

import { useCallback, useState } from "react";
import { useProgress } from "@/lib/context/ProgressContext";
import { useTranslations } from "@/lib/context/LocaleContext";

interface FileSystemItem {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileSystemItem[];
}

interface FileExplorerProps {
  onFileSelect: (filePath: string) => void;
}

// Check if running in Electron environment
function isElectronEnv(): boolean {
  return typeof window !== "undefined" && "electronAPI" in window;
}

/**
 * Get file icon based on file extension
 */
function getFileIcon(fileName: string): React.ReactNode {
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : "";

  // Code files
  if (["js", "jsx", "ts", "tsx", "vue", "svelte"].includes(ext || "")) {
    return (
      <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    );
  }

  // HTML/CSS
  if (["html", "css", "scss", "less"].includes(ext || "")) {
    return (
      <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }

  // JSON/XML
  if (["json", "xml", "yaml", "yml"].includes(ext || "")) {
    return (
      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    );
  }

  // Markdown
  if (["md", "markdown"].includes(ext || "")) {
    return (
      <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }

  // Image files
  if (["png", "jpg", "jpeg", "gif", "svg", "ico", "webp"].includes(ext || "")) {
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

export function FileExplorer({ onFileSelect }: FileExplorerProps) {
  const { t } = useTranslations();
  const [fileTree, setFileTree] = useState<FileSystemItem[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { startOperation, updateProgress, completeOperation, failOperation } = useProgress();

  // Load directory contents
  const loadFiles = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    // Get folder name for display
    const folderName = path.split("/").pop() || path;

    // Declare opId outside try block for catch access
    let opId: string | undefined;

    try {
      opId = startOperation("file-read", t('chat.progress.loading', { name: folderName }), { filePath: path, fileName: folderName });
      updateProgress(opId, 20, t('chat.progress.readingDirectory'));

      const response = await fetch("/api/files/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        throw new Error(data.error || t('errors.failedToLoadDirectory'));
      }

      updateProgress(opId, 80, t('chat.progress.processingFiles'));

      const data = await response.json();
      setFileTree(data.entries || []);
      setCurrentPath(path);

      updateProgress(opId, 100, t('chat.progress.directoryLoaded'));
      completeOperation(opId, t('chat.progress.directoryLoaded'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.failedToLoadDirectory');
      setError(errorMessage);
      setFileTree([]);
      if (opId) {
        failOperation(opId, errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [startOperation, updateProgress, completeOperation, failOperation]);

  // Load children for a directory
  const loadChildren = useCallback(async (path: string): Promise<FileSystemItem[]> => {
    try {
      const fullPath = currentPath ? `${currentPath}/${path}` : path;
      const response = await fetch("/api/files/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        throw new Error(data.error || t('errors.failedToLoadDirectory'));
      }

      const data = await response.json();
      return data.entries || [];
    } catch {
      return [];
    }
  }, [currentPath]);

  // Toggle directory expansion
  const toggleExpand = useCallback(
    async (path: string, item: FileSystemItem) => {
      setExpandedPaths((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(path)) {
          newSet.delete(path);
          return newSet;
        } else {
          // Load children if not already loaded
          if (!item.children) {
            loadChildren(path).then((children) => {
              setFileTree((prev) => updateItemChildren(prev, path, children));
            });
          }
          newSet.add(path);
          return newSet;
        }
      });
    },
    [loadChildren]
  );

  // Update item children in tree
  const updateItemChildren = (
    items: FileSystemItem[],
    path: string,
    children: FileSystemItem[]
  ): FileSystemItem[] => {
    return items.map((item) => {
      if (item.path === path) {
        return { ...item, children };
      }
      if (item.children) {
        return { ...item, children: updateItemChildren(item.children, path, children) };
      }
      return item;
    });
  };

  // Handle folder selection
  const handleSelectFolder = useCallback(async () => {
    setIsOpeningFolder(true);

    try {
      if (isElectronEnv()) {
        const path = await window.electronAPI.selectFolder();
        if (path) {
          await loadFiles(path);
        }
      } else {
        const path = prompt("Enter folder path:");
        if (path) {
          await loadFiles(path);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.failedToSelectFolder'));
    } finally {
      setIsOpeningFolder(false);
    }
  }, [loadFiles, t]);

  // Handle item click
  const handleItemClick = useCallback(
    (item: FileSystemItem) => {
      if (item.type === "directory") {
        toggleExpand(item.path, item);
      } else {
        setSelectedPath(item.path);
        const fullPath = currentPath ? `${currentPath}/${item.path}` : item.path;
        onFileSelect(fullPath);
      }
    },
    [toggleExpand, onFileSelect, currentPath]
  );

  // Render file tree recursively
  const renderFileTree = useCallback(
    (items: FileSystemItem[], level: number = 0): React.ReactNode => {
      return items.map((item) => {
        const isExpanded = expandedPaths.has(item.path);
        const isSelected = selectedPath === item.path;
        const paddingLeft = level * 16 + 8;

        return (
          <div key={item.path}>
            <div
              className={`
                flex items-center py-1.5 px-2 cursor-pointer
                hover:bg-neutral-800 transition-colors
                ${isSelected ? "bg-blue-900/30 text-blue-300" : "text-neutral-300"}
              `}
              style={{ paddingLeft: `${paddingLeft}px` }}
              onClick={() => handleItemClick(item)}
              role="treeitem"
              tabIndex={0}
              aria-expanded={item.type === "directory" ? isExpanded : undefined}
            >
              {item.type === "directory" && (
                <span className="mr-1 flex-shrink-0">
                  <svg
                    className={`w-4 h-4 text-neutral-500 transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              )}

              <span className="mr-2 flex-shrink-0">
                {item.type === "directory" ? (
                  <svg
                    className={`w-4 h-4 ${isExpanded ? "text-blue-400" : "text-neutral-400"}`}
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
                  getFileIcon(item.name)
                )}
              </span>

              <span className="text-sm truncate flex-1">{item.name}</span>
            </div>

            {item.type === "directory" && isExpanded && item.children && (
              <div role="group">{renderFileTree(item.children, level + 1)}</div>
            )}

            {item.type === "directory" && isExpanded && !item.children && (
              <div
                className="py-1 px-2 text-xs text-neutral-500 italic"
                style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
              >
                {t('common.loading')}
              </div>
            )}
          </div>
        );
      });
    },
    [expandedPaths, selectedPath, handleItemClick]
  );

  // Get folder name from path
  const getFolderName = useCallback(() => {
    if (!currentPath) return null;
    const parts = currentPath.split("/");
    return parts[parts.length - 1] || parts[parts.length - 2] || currentPath;
  }, [currentPath]);

  const folderName = getFolderName();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
          {t('sidebar.files.title')}
        </span>
        {currentPath && (
          <button
            onClick={() => currentPath && loadFiles(currentPath)}
            disabled={isLoading}
            className="p-1 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded transition-colors disabled:opacity-50"
            title={t('common.refresh')}
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
      <div className="px-3 py-2 border-b border-neutral-800">
        {currentPath ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-neutral-500 truncate">{t('sidebar.files.currentFolder')}</p>
              <p className="text-sm text-white truncate font-medium" title={currentPath}>
                {folderName}
              </p>
            </div>
            <button
              onClick={handleSelectFolder}
              disabled={isOpeningFolder}
              className="p-1 text-neutral-400 hover:text-white transition-colors disabled:opacity-50 rounded hover:bg-neutral-800"
              title={t('sidebar.files.openFolder')}
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
                {t('sidebar.files.opening')}
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
                {t('sidebar.files.openFolder')}
              </>
            )}
          </button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 text-xs text-red-400 bg-red-900/20">
          {error}
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-2" role="tree">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-neutral-500 text-sm flex flex-col items-center">
            <svg className="w-8 h-8 animate-spin text-blue-500 mb-3" fill="none" viewBox="0 0 24 24">
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
            {t('sidebar.files.loadingFolder')}
          </div>
        ) : !currentPath ? (
          <div className="px-4 py-8 text-center text-neutral-500 text-sm flex flex-col items-center">
            <svg
              className="w-12 h-12 text-neutral-600 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            {t('sidebar.files.selectFolder')}
          </div>
        ) : fileTree.length === 0 ? (
          <div className="px-4 py-8 text-center text-neutral-500 text-sm">{t('sidebar.files.folderEmpty')}</div>
        ) : (
          renderFileTree(fileTree)
        )}
      </div>
    </div>
  );
}

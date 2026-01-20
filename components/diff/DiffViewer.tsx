"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import * as diff from "diff";

interface DiffLine {
  lineNumber: number;
  type: "added" | "removed" | "unchanged";
  content: string;
  originalLineNumber?: number;
  newLineNumber?: number;
}

interface DiffViewerProps {
  /** Original file content */
  originalContent: string;
  /** New file content */
  newContent: string;
  /** Filename to display */
  fileName: string;
  /** File extension for syntax highlighting */
  language?: string;
  /** Callback when diff is closed */
  onClose: () => void;
}

type ViewMode = "unified" | "side-by-side";

/**
 * DiffViewer component - displays a side-by-side or unified diff view
 * with syntax highlighting and clear visual indicators for changes.
 */
export function DiffViewer({
  originalContent,
  newContent,
  fileName,
  language = "",
  onClose,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("side-by-side");
  const [copiedSide, setCopiedSide] = useState<string | null>(null);

  // Detect language from filename if not provided
  const detectedLanguage = useMemo(() => {
    if (language) return language;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "tsx",
      js: "javascript",
      jsx: "jsx",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      c: "c",
      cpp: "cpp",
      cs: "csharp",
      php: "php",
      rb: "ruby",
      sql: "sql",
      sh: "bash",
      yaml: "yaml",
      yml: "yaml",
      json: "json",
      xml: "xml",
      html: "html",
      css: "css",
      scss: "scss",
      md: "markdown",
    };
    return languageMap[ext] || "text";
  }, [language, fileName]);

  // Compute the diff
  const diffResult = useMemo(() => {
    const changes = diff.diffLines(originalContent, newContent);
    const lines: DiffLine[] = [];
    let originalLineNumber = 1;
    let newLineNumber = 1;

    for (const change of changes) {
      const changeLines = change.value.split("\n");
      // Remove empty string at end if exists (from split)
      if (changeLines[changeLines.length - 1] === "") {
        changeLines.pop();
      }

      if (change.added) {
        for (const line of changeLines) {
          lines.push({
            lineNumber: newLineNumber,
            type: "added",
            content: line,
            newLineNumber,
          });
          newLineNumber++;
        }
      } else if (change.removed) {
        for (const line of changeLines) {
          lines.push({
            lineNumber: originalLineNumber,
            type: "removed",
            content: line,
            originalLineNumber,
          });
          originalLineNumber++;
        }
      } else {
        for (const line of changeLines) {
          lines.push({
            lineNumber: Math.max(originalLineNumber, newLineNumber),
            type: "unchanged",
            content: line,
            originalLineNumber,
            newLineNumber,
          });
          originalLineNumber++;
          newLineNumber++;
        }
      }
    }

    return lines;
  }, [originalContent, newContent]);

  // Group lines for side-by-side view
  const sideBySideDiff = useMemo(() => {
    const groups: Array<{
      left: { lineNumber: number; content: string; type: "removed" | "unchanged" | "empty" } | null;
      right: { lineNumber: number; content: string; type: "added" | "unchanged" | "empty" } | null;
    }> = [];

    let i = 0;
    while (i < diffResult.length) {
      const line = diffResult[i];

      if (line.type === "unchanged") {
        groups.push({
          left: { lineNumber: line.originalLineNumber!, content: line.content, type: "unchanged" },
          right: { lineNumber: line.newLineNumber!, content: line.content, type: "unchanged" },
        });
        i++;
      } else if (line.type === "removed") {
        // Look ahead for added lines
        let removedLines = [{ lineNumber: line.originalLineNumber!, content: line.content }];
        let j = i + 1;
        let addedLines: Array<{ lineNumber: number; content: string }> = [];

        while (j < diffResult.length && diffResult[j].type === "removed") {
          removedLines.push({
            lineNumber: diffResult[j].originalLineNumber!,
            content: diffResult[j].content,
          });
          j++;
        }

        while (j < diffResult.length && diffResult[j].type === "added") {
          addedLines.push({
            lineNumber: diffResult[j].newLineNumber!,
            content: diffResult[j].content,
          });
          j++;
        }

        const maxLen = Math.max(removedLines.length, addedLines.length);
        for (let k = 0; k < maxLen; k++) {
          groups.push({
            left: removedLines[k]
              ? { lineNumber: removedLines[k].lineNumber, content: removedLines[k].content, type: "removed" as const }
              : null,
            right: addedLines[k]
              ? { lineNumber: addedLines[k].lineNumber, content: addedLines[k].content, type: "added" as const }
              : null,
          });
        }

        i = j;
      } else if (line.type === "added") {
        // Added line without preceding removal
        groups.push({
          left: null,
          right: { lineNumber: line.newLineNumber!, content: line.content, type: "added" },
        });
        i++;
      }
    }

    return groups;
  }, [diffResult]);

  // Calculate stats
  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const line of diffResult) {
      if (line.type === "added") additions++;
      if (line.type === "removed") deletions++;
    }
    return { additions, deletions, unchanged: diffResult.length - additions - deletions };
  }, [diffResult]);

  const copyToClipboard = useCallback(async (content: string, side: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSide(side);
      setTimeout(() => setCopiedSide(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const getRowBgClass = (type: string): string => {
    switch (type) {
      case "added":
        return "bg-emerald-900/30";
      case "removed":
        return "bg-red-900/30";
      case "unchanged":
        return "bg-transparent";
      default:
        return "bg-transparent";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-neutral-800 rounded-lg shadow-2xl w-[95vw] h-[90vh] flex flex-col max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">Diff Preview</h2>
            <span className="px-2 py-1 text-xs font-medium bg-neutral-700 rounded text-neutral-300">
              {fileName}
            </span>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-emerald-400">+{stats.additions}</span>
              <span className="text-red-400">-{stats.deletions}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center bg-neutral-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode("side-by-side")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === "side-by-side"
                    ? "bg-neutral-600 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
                type="button"
              >
                Side by Side
              </button>
              <button
                onClick={() => setViewMode("unified")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === "unified"
                    ? "bg-neutral-600 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
                type="button"
              >
                Unified
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-md transition-colors"
              aria-label="Close"
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "unified" ? (
            <UnifiedView
              lines={diffResult}
              language={detectedLanguage}
              copiedSide={copiedSide}
              onCopy={(side) => copyToClipboard(newContent, side)}
              getRowBgClass={getRowBgClass}
            />
          ) : (
            <SideBySideView
              groups={sideBySideDiff}
              copiedSide={copiedSide}
              onCopyOriginal={(side) => copyToClipboard(originalContent, side)}
              onCopyNew={(side) => copyToClipboard(newContent, side)}
              getRowBgClass={getRowBgClass}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-700 bg-neutral-800/50">
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-900/30 border border-emerald-700/50 rounded" />
              Added
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-red-900/30 border border-red-700/50 rounded" />
              Removed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-transparent border border-neutral-600 rounded" />
              Unchanged
            </span>
          </div>
          <p className="text-xs text-neutral-500">Press Escape to close</p>
        </div>
      </div>
    </div>
  );
}

interface UnifiedViewProps {
  lines: DiffLine[];
  language: string;
  copiedSide: string | null;
  onCopy: (side: string) => void;
  getRowBgClass: (type: string) => string;
}

function UnifiedView({ lines, language, copiedSide, onCopy, getRowBgClass }: UnifiedViewProps) {
  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
        <span className="text-xs text-neutral-400">{language || "text"}</span>
        <button
          onClick={() => onCopy("unified")}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-700"
          type="button"
        >
          {copiedSide === "unified" ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} className={`${getRowBgClass(line.type)} border-b border-neutral-700/50`}>
              <td className="w-12 px-2 py-0.5 text-right text-neutral-600 text-xs font-mono select-none border-r border-neutral-700/50">
                {line.originalLineNumber ?? line.newLineNumber ?? ""}
              </td>
              <td className={`px-3 py-0.5 font-mono ${line.type === "added" ? "text-emerald-300" : line.type === "removed" ? "text-red-300" : "text-neutral-200"}`}>
                <span className="inline-block w-4 mr-2 select-none">
                  {line.type === "added" && "+"}
                  {line.type === "removed" && "-"}
                  {line.type === "unchanged" && " "}
                </span>
                {line.content || " "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SideBySideViewProps {
  groups: Array<{
    left: { lineNumber: number; content: string; type: "removed" | "unchanged" | "empty" } | null;
    right: { lineNumber: number; content: string; type: "added" | "unchanged" | "empty" } | null;
  }>;
  copiedSide: string | null;
  onCopyOriginal: (side: string) => void;
  onCopyNew: (side: string) => void;
  getRowBgClass: (type: string) => string;
}

function SideBySideView({
  groups,
  copiedSide,
  onCopyOriginal,
  onCopyNew,
  getRowBgClass,
}: SideBySideViewProps) {
  return (
    <div className="h-full flex">
      {/* Original content */}
      <div className="flex-1 overflow-auto border-r border-neutral-700">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
          <span className="text-xs font-medium text-neutral-400">Original</span>
          <button
            onClick={() => onCopyOriginal("original")}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-700"
            type="button"
          >
            {copiedSide === "original" ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {groups.map((group, idx) => {
              const left = group.left;
              return (
                <tr
                  key={`left-${idx}`}
                  className={`${left ? getRowBgClass(left.type) : "bg-neutral-800/20"} border-b border-neutral-700/50`}
                >
                  <td className="w-12 px-2 py-0.5 text-right text-neutral-600 text-xs font-mono select-none border-r border-neutral-700/50">
                    {left?.lineNumber ?? ""}
                  </td>
                  <td className={`px-3 py-0.5 font-mono ${left?.type === "removed" ? "text-red-300" : left?.type === "unchanged" ? "text-neutral-200" : "text-neutral-600"}`}>
                    {left ? (
                      <>
                        <span className="inline-block w-4 mr-2 select-none">
                          {left.type === "removed" ? "-" : " "}
                        </span>
                        {left.content || " "}
                      </>
                    ) : (
                      <span className="text-neutral-700">&nbsp;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New content */}
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
          <span className="text-xs font-medium text-neutral-400">Modified</span>
          <button
            onClick={() => onCopyNew("new")}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-700"
            type="button"
          >
            {copiedSide === "new" ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {groups.map((group, idx) => {
              const right = group.right;
              return (
                <tr
                  key={`right-${idx}`}
                  className={`${right ? getRowBgClass(right.type) : "bg-neutral-800/20"} border-b border-neutral-700/50`}
                >
                  <td className="w-12 px-2 py-0.5 text-right text-neutral-600 text-xs font-mono select-none border-r border-neutral-700/50">
                    {right?.lineNumber ?? ""}
                  </td>
                  <td className={`px-3 py-0.5 font-mono ${right?.type === "added" ? "text-emerald-300" : right?.type === "unchanged" ? "text-neutral-200" : "text-neutral-600"}`}>
                    {right ? (
                      <>
                        <span className="inline-block w-4 mr-2 select-none">
                          {right.type === "added" ? "+" : " "}
                        </span>
                        {right.content || " "}
                      </>
                    ) : (
                      <span className="text-neutral-700">&nbsp;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon, FileTextIcon, CodeIcon, FileJsonIcon } from "lucide-react";

export type ExportFormat = "json" | "markdown" | "text";

export interface ExportDialogProps {
  /** Title of the session to export (optional if exporting all) */
  sessionTitle?: string;
  /** Session ID to export (undefined = export all) */
  sessionId?: string;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when user confirms export */
  onExport: (format: ExportFormat, includeAttachments: boolean) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether export is in progress */
  isExporting?: boolean;
}

const formatOptions: Array<{
  value: ExportFormat;
  label: string;
  description: string;
  extension: string;
  icon: React.ReactNode;
}> = [
  {
    value: "markdown",
    label: "Markdown",
    description: "Formatted markdown with syntax highlighting support",
    extension: ".md",
    icon: <FileTextIcon size={18} />,
  },
  {
    value: "text",
    label: "Plain Text",
    description: "Simple text format, compatible with any text editor",
    extension: ".txt",
    icon: <FileTextIcon size={18} />,
  },
  {
    value: "json",
    label: "JSON",
    description: "Machine-readable format with all metadata",
    extension: ".json",
    icon: <FileJsonIcon size={18} />,
  },
];

export function ExportDialog({
  sessionTitle,
  sessionId,
  isOpen,
  onExport,
  onCancel,
  isExporting = false,
}: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("markdown");
  const [includeAttachments, setIncludeAttachments] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFormat("markdown");
      setIncludeAttachments(false);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!isExporting) {
          onCancel();
        }
      } else if (e.key === "Enter" && !isExporting) {
        e.preventDefault();
        handleExport();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, isExporting]);

  const handleExport = () => {
    onExport(selectedFormat, includeAttachments);
  };

  if (!isOpen) return null;

  const title = sessionTitle || "All Conversations";
  const baseFilename = sessionTitle?.replace(/[^a-z0-9]/gi, '_') || 'all_chats';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={isExporting ? undefined : onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-neutral-800 rounded-lg shadow-xl max-w-lg w-full mx-4 animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <DownloadIcon size={18} className="text-blue-400" />
            </div>
            <h2 id="export-dialog-title" className="text-lg font-semibold text-white">
              Export Conversation
            </h2>
          </div>
          <button
            type="button"
            onClick={isExporting ? undefined : onCancel}
            className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close"
            disabled={isExporting}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Session info */}
          <div className="bg-neutral-700/50 rounded-md px-3 py-2">
            <p className="text-sm text-neutral-400">
              Exporting: <span className="text-white font-medium">{title}</span>
            </p>
          </div>

          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Export Format
            </label>
            <div className="space-y-2" role="radiogroup" aria-label="Export format">
              {formatOptions.map((format) => (
                <button
                  key={format.value}
                  type="button"
                  onClick={() => !isExporting && setSelectedFormat(format.value)}
                  disabled={isExporting}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all
                    ${selectedFormat === format.value
                      ? "bg-blue-600/20 border border-blue-500/50"
                      : "bg-neutral-700/30 border border-transparent hover:bg-neutral-700/50"
                    }
                    ${isExporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                  role="radio"
                  aria-checked={selectedFormat === format.value}
                >
                  <div className={`
                    p-2 rounded-md
                    ${selectedFormat === format.value ? "bg-blue-600/30" : "bg-neutral-700"}
                  `}>
                    {format.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {format.label}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {format.extension}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {format.description}
                    </p>
                  </div>
                  {selectedFormat === format.value && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Attachments checkbox */}
          <div className="flex items-start gap-3 p-3 bg-neutral-700/30 rounded-lg">
            <input
              type="checkbox"
              id="include-attachments"
              checked={includeAttachments}
              onChange={(e) => !isExporting && setIncludeAttachments(e.target.checked)}
              disabled={isExporting}
              className="mt-0.5 w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50"
            />
            <div className="flex-1">
              <label
                htmlFor="include-attachments"
                className="text-sm font-medium text-neutral-300 cursor-pointer"
              >
                Include file attachment references
              </label>
              <p className="text-xs text-neutral-500 mt-0.5">
                Add file paths and metadata for attachments in the conversation
              </p>
            </div>
          </div>

          {/* Filename preview */}
          <div className="bg-neutral-900/50 rounded-md px-3 py-2">
            <p className="text-xs text-neutral-500 mb-1">Preview filename:</p>
            <p className="text-sm font-mono text-neutral-300 truncate">
              {baseFilename}_{new Date().toISOString().slice(0, 10)}{formatOptions.find(f => f.value === selectedFormat)?.extension}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isExporting}
            className="px-4 py-2 bg-neutral-700 text-white rounded-md hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <DownloadIcon size={16} />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

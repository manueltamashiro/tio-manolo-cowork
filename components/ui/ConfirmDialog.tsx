"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export interface ConfirmDialogProps {
  /** Title of the dialog */
  title: string;
  /** Message to display in the dialog */
  message: string | ReactNode;
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Variant of the dialog (default: "info") */
  variant?: "danger" | "warning" | "info";
  /** Called when user confirms */
  onConfirm: () => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the dialog is open */
  isOpen: boolean;
}

const variantStyles = {
  danger: {
    confirmBg: "bg-red-600 hover:bg-red-700",
    iconColor: "text-red-500",
    iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  warning: {
    confirmBg: "bg-amber-600 hover:bg-amber-700",
    iconColor: "text-amber-500",
    iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  info: {
    confirmBg: "bg-blue-600 hover:bg-blue-700",
    iconColor: "text-blue-500",
    iconPath: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "info",
  onConfirm,
  onCancel,
  isOpen,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Handle focus trap and keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    // Focus the confirm button when dialog opens
    confirmButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Tab") {
        // Trap focus within dialog
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div ref={dialogRef} className="relative bg-neutral-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Icon */}
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className={`h-6 w-6 ${styles.iconColor}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={styles.iconPath}
              />
            </svg>
          </div>

          {/* Content */}
          <div className="ml-3 flex-1">
            <h3 id="dialog-title" className="text-lg font-semibold text-white">{title}</h3>
            <p id="dialog-description" className="mt-2 text-sm text-neutral-300">{message}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex flex-row-reverse gap-3">
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-md transition-colors ${styles.confirmBg}`}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-neutral-700 text-white rounded-md hover:bg-neutral-600 transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface FileOverwriteConfirmProps {
  /** Path of the file to be overwritten */
  filePath: string;
  /** Called when user confirms overwrite */
  onConfirm: () => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the dialog is open */
  isOpen: boolean;
}

/**
 * Specialized confirmation dialog for file overwrite operations
 */
export function FileOverwriteConfirm({
  filePath,
  onConfirm,
  onCancel,
  isOpen,
}: FileOverwriteConfirmProps) {
  const fileName = filePath.split("/").pop() || filePath.split("\\").pop() || filePath;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Overwrite File?"
      message={
        <span>
          The file <span className="font-mono text-white bg-neutral-700 px-1 rounded">{fileName}</span> already exists.
          A backup will be created before overwriting. Do you want to continue?
        </span>
      }
      confirmLabel="Overwrite"
      cancelLabel="Cancel"
      variant="warning"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export interface FileDeleteConfirmProps {
  /** Path of the file/directory to be deleted */
  filePath: string;
  /** Whether the item is a directory */
  isDirectory?: boolean;
  /** Whether recursive deletion is needed */
  requiresRecursive?: boolean;
  /** Called when user confirms deletion */
  onConfirm: () => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the dialog is open */
  isOpen: boolean;
}

/**
 * Specialized confirmation dialog for file deletion operations
 * Shows clear warnings about the permanent nature of deletion
 */
export function FileDeleteConfirm({
  filePath,
  isDirectory = false,
  requiresRecursive = false,
  onConfirm,
  onCancel,
  isOpen,
}: FileDeleteConfirmProps) {
  const fileName = filePath.split("/").pop() || filePath.split("\\").pop() || filePath;

  // Build warning message based on file type
  const getMessage = () => {
    if (isDirectory && requiresRecursive) {
      return (
        <div className="space-y-2">
          <p>
            You are about to delete the directory{" "}
            <span className="font-mono text-white bg-neutral-700 px-1 rounded">{fileName}</span>.
          </p>
          <p className="text-amber-400 font-medium">
            This will delete all files and subdirectories inside. This action cannot be undone.
          </p>
          <p className="text-sm">Are you sure you want to continue?</p>
        </div>
      );
    }

    if (isDirectory) {
      return (
        <div className="space-y-2">
          <p>
            You are about to delete the directory{" "}
            <span className="font-mono text-white bg-neutral-700 px-1 rounded">{fileName}</span>.
          </p>
          <p className="text-red-400 font-medium">This action cannot be undone.</p>
          <p className="text-sm">Are you sure you want to continue?</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p>
          You are about to delete the file{" "}
          <span className="font-mono text-white bg-neutral-700 px-1 rounded">{fileName}</span>.
        </p>
        <p className="text-red-400 font-medium">This action cannot be undone.</p>
        <p className="text-sm">Are you sure you want to continue?</p>
      </div>
    );
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={isDirectory ? "Delete Directory?" : "Delete File?"}
      message={getMessage()}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Toast as ToastType, ToastAction } from '@/lib/context/ToastContext';

// ==================== Types ====================

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
  onActionClick?: (action: ToastAction, toastId: string) => void;
}

// ==================== Variant Styles ====================

const variantStyles = {
  success: {
    container: 'border-claude-success-500 bg-neutral-800/95 dark:bg-neutral-800/95 light:bg-white/95',
    iconColor: 'text-claude-success-500',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  error: {
    container: 'border-claude-error-500 bg-neutral-800/95 dark:bg-neutral-800/95 light:bg-white/95',
    iconColor: 'text-claude-error-500',
    iconPath: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  warning: {
    container: 'border-claude-warning-500 bg-neutral-800/95 dark:bg-neutral-800/95 light:bg-white/95',
    iconColor: 'text-claude-warning-500',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  info: {
    container: 'border-claude-info-500 bg-neutral-800/95 dark:bg-neutral-800/95 light:bg-white/95',
    iconColor: 'text-claude-info-500',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

// ==================== Toast Component ====================

export function Toast({ toast, onDismiss, onActionClick }: ToastProps) {
  const { container, iconColor, iconPath } = variantStyles[toast.type];

  // Auto-dismiss progress bar
  const hasAutoDismiss = toast.duration && toast.duration > 0;

  const handleActionClick = (action: ToastAction) => {
    action.onClick();
    onActionClick?.(action, toast.id);
  };

  return (
    <div
      className={`
        relative flex items-start gap-3 min-w-[320px] max-w-md p-4
        border-l-4 rounded-r shadow-claude-md
        animate-fade-in
        ${container}
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <svg
          className={`w-5 h-5 ${iconColor}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={iconPath}
          />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white dark:text-white light:text-neutral-900 break-words">{toast.message}</p>

        {/* Actions */}
        {toast.actions && toast.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {toast.actions.map((action, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleActionClick(action)}
                className="text-xs px-2 py-1 rounded bg-neutral-700 dark:bg-neutral-700 light:bg-neutral-200 text-white dark:text-white light:text-neutral-700 hover:bg-neutral-600 dark:hover:bg-neutral-600 light:hover:bg-neutral-300 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Close Button */}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-neutral-400 dark:text-neutral-400 light:text-neutral-500 hover:text-white dark:hover:text-white light:hover:text-neutral-700 transition-colors p-0.5 rounded hover:bg-neutral-700/50 dark:hover:bg-neutral-700/50 light:hover:bg-neutral-200/50"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress Bar for Auto-dismiss */}
      {hasAutoDismiss && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-700 dark:bg-neutral-700 light:bg-neutral-300 rounded-b overflow-hidden">
          <div
            className="h-full bg-current opacity-30"
            style={{
              animation: `toastProgress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ==================== Toast Container ====================

interface ToastContainerProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
  onActionClick?: (action: ToastAction, toastId: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const positionStyles = {
  'top-right': 'top-4 right-4 flex-col',
  'top-left': 'top-4 left-4 flex-col',
  'bottom-right': 'bottom-4 right-4 flex-col-reverse',
  'bottom-left': 'bottom-4 left-4 flex-col-reverse',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 flex-col',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 flex-col-reverse',
};

export function ToastContainer({
  toasts,
  onDismiss,
  onActionClick,
  position = 'top-right',
}: ToastContainerProps) {
  // Handle Escape key to dismiss all toasts
  useEffect(() => {
    if (toasts.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Dismiss the most recent toast (first in the array)
        onDismiss(toasts[0].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  const positionClass = positionStyles[position];

  return (
    <div
      className={`fixed z-claude-toast flex gap-2 pointer-events-none ${positionClass}`}
      role="region"
      aria-label="Toast notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={onDismiss} onActionClick={onActionClick} />
        </div>
      ))}
    </div>
  );
}

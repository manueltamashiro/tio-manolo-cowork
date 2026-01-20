'use client';

/**
 * Toast Context - Provides global state management for toast notifications
 * Supports success, error, warning, and info variants with auto-dismiss and stacking
 */

import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import { ToastContainer } from '@/components/ui/Toast';

// ==================== Types ====================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // Auto-dismiss duration in ms (0 for no auto-dismiss)
  actions?: ToastAction[];
  createdAt: number;
}

export interface ToastOptions {
  type?: ToastType;
  message: string;
  duration?: number;
  actions?: ToastAction[];
}

export interface ToastContextValue {
  toasts: Toast[];
  show: (options: ToastOptions) => string;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// ==================== Constants ====================

const DEFAULT_DURATION = 5000; // 5 seconds
const MAX_TOASTS = 5; // Maximum number of toasts to show at once

// ==================== Provider ====================

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  defaultDuration?: number;
}

export function ToastProvider({
  children,
  maxToasts = MAX_TOASTS,
  defaultDuration = DEFAULT_DURATION,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  // Dismiss a toast
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));

    // Clear any pending timeout
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  // Dismiss all toasts
  const dismissAll = useCallback(() => {
    setToasts([]);

    // Clear all timeouts
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current.clear();
  }, []);

  // Show a new toast
  const show = useCallback(
    (options: ToastOptions): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const duration = options.duration ?? defaultDuration;

      const newToast: Toast = {
        id,
        type: options.type ?? 'info',
        message: options.message,
        duration,
        actions: options.actions,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        const updated = [newToast, ...prev];

        // Remove oldest toasts if we exceed the max
        if (updated.length > maxToasts) {
          const toRemove = updated.slice(maxToasts);
          toRemove.forEach((t) => {
            const timeout = timeoutRefs.current.get(t.id);
            if (timeout) {
              clearTimeout(timeout);
              timeoutRefs.current.delete(t.id);
            }
          });

          return updated.slice(0, maxToasts);
        }

        return updated;
      });

      // Set up auto-dismiss
      if (duration > 0) {
        const timeout = setTimeout(() => {
          dismiss(id);
        }, duration);

        timeoutRefs.current.set(id, timeout);
      }

      return id;
    },
    [defaultDuration, maxToasts, dismiss]
  );

  // Convenience methods
  const success = useCallback(
    (message: string, duration?: number) => show({ type: 'success', message, duration }),
    [show]
  );

  const error = useCallback(
    (message: string, duration?: number) => show({ type: 'error', message, duration }),
    [show]
  );

  const warning = useCallback(
    (message: string, duration?: number) => show({ type: 'warning', message, duration }),
    [show]
  );

  const info = useCallback(
    (message: string, duration?: number) => show({ type: 'info', message, duration }),
    [show]
  );

  const value: ToastContextValue = {
    toasts,
    show,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

// ==================== Hook ====================

/**
 * Hook to access the toast context
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ==================== Toast Host Component ====================

/**
 * ToastHost - Renders the toast container
 * This component should be placed once in the app layout
 */
export function ToastHost({ position = 'top-right' }: { position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center' }) {
  const { toasts, dismiss } = useToast();

  return (
    <ToastContainer
      toasts={toasts}
      onDismiss={dismiss}
      position={position}
    />
  );
}

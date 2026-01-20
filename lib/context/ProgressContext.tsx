'use client';

/**
 * Progress Context - Provides global state management for tracking operation progress
 * Displays real-time progress of operations like file reads, writes, and API calls
 */

import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';

// ==================== Types ====================

export type ProgressOperationType = 'file-read' | 'file-write' | 'api-call' | 'chat-stream' | 'file-delete' | 'other';

export type ProgressStatus = 'pending' | 'in-progress' | 'completed' | 'error';

export interface ProgressOperation {
  id: string;
  type: ProgressOperationType;
  status: ProgressStatus;
  title: string;
  message?: string;
  progress: number; // 0-100
  timestamp: number;
  error?: string;
  metadata?: {
    filePath?: string;
    fileName?: string;
    endpoint?: string;
    [key: string]: string | undefined;
  };
}

export interface ProgressContextValue {
  operations: ProgressOperation[];
  activeCount: number;
  // Start tracking a new operation
  startOperation: (
    type: ProgressOperationType,
    title: string,
    metadata?: ProgressOperation['metadata']
  ) => string;
  // Update operation progress
  updateProgress: (id: string, progress: number, message?: string) => void;
  // Mark operation as complete
  completeOperation: (id: string, message?: string) => void;
  // Mark operation as failed
  failOperation: (id: string, error: string) => void;
  // Remove an operation
  removeOperation: (id: string) => void;
  // Clear all completed operations
  clearCompleted: () => void;
  // Clear all operations
  clearAll: () => void;
}

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

// ==================== Constants ====================

const OPERATION_RETENTION_MS = 5000; // Keep completed operations for 5 seconds
const MAX_OPERATIONS = 20; // Maximum operations to track

// ==================== Provider ====================

interface ProgressProviderProps {
  children: React.ReactNode;
  retentionMs?: number;
  maxOperations?: number;
}

export function ProgressProvider({
  children,
  retentionMs = OPERATION_RETENTION_MS,
  maxOperations = MAX_OPERATIONS,
}: ProgressProviderProps) {
  const [operations, setOperations] = useState<ProgressOperation[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  // Remove an operation (internal)
  const removeOperation = useCallback((id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id));

    // Clear any pending timeout
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  // Clear all completed operations
  const clearCompleted = useCallback(() => {
    setOperations((prev) => prev.filter((op) => op.status !== 'completed'));
  }, []);

  // Clear all operations
  const clearAll = useCallback(() => {
    setOperations([]);

    // Clear all timeouts
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current.clear();
  }, []);

  // Start tracking a new operation
  const startOperation = useCallback(
    (
      type: ProgressOperationType,
      title: string,
      metadata?: ProgressOperation['metadata']
    ): string => {
      const id = `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newOperation: ProgressOperation = {
        id,
        type,
        status: 'in-progress',
        title,
        progress: 0,
        timestamp: Date.now(),
        metadata,
      };

      setOperations((prev) => {
        const updated = [newOperation, ...prev];

        // Remove oldest operations if we exceed the max
        if (updated.length > maxOperations) {
          const toRemove = updated.slice(maxOperations);
          toRemove.forEach((op) => {
            const timeout = timeoutRefs.current.get(op.id);
            if (timeout) {
              clearTimeout(timeout);
              timeoutRefs.current.delete(op.id);
            }
          });

          return updated.slice(0, maxOperations);
        }

        return updated;
      });

      return id;
    },
    [maxOperations]
  );

  // Update operation progress
  const updateProgress = useCallback(
    (id: string, progress: number, message?: string) => {
      setOperations((prev) =>
        prev.map((op) =>
          op.id === id
            ? {
                ...op,
                progress: Math.min(100, Math.max(0, progress)),
                ...(message && { message }),
                status: progress >= 100 ? 'completed' : op.status,
              }
            : op
        )
      );

      // If progress is 100%, schedule removal
      if (progress >= 100) {
        const timeout = setTimeout(() => {
          removeOperation(id);
        }, retentionMs);

        timeoutRefs.current.set(id, timeout);
      }
    },
    [retentionMs, removeOperation]
  );

  // Mark operation as complete
  const completeOperation = useCallback(
    (id: string, message?: string) => {
      setOperations((prev) =>
        prev.map((op) =>
          op.id === id
            ? {
                ...op,
                status: 'completed' as const,
                progress: 100,
                ...(message && { message }),
              }
            : op
        )
      );

      // Schedule removal after retention period
      const timeout = setTimeout(() => {
        removeOperation(id);
      }, retentionMs);

      timeoutRefs.current.set(id, timeout);
    },
    [retentionMs, removeOperation]
  );

  // Mark operation as failed
  const failOperation = useCallback(
    (id: string, error: string) => {
      setOperations((prev) =>
        prev.map((op) =>
          op.id === id
            ? {
                ...op,
                status: 'error' as const,
                error,
              }
            : op
        )
      );

      // Schedule removal after retention period
      const timeout = setTimeout(() => {
        removeOperation(id);
      }, retentionMs);

      timeoutRefs.current.set(id, timeout);
    },
    [retentionMs, removeOperation]
  );

  // Count active operations
  const activeCount = operations.filter(
    (op) => op.status === 'in-progress' || op.status === 'pending'
  ).length;

  const value: ProgressContextValue = {
    operations,
    activeCount,
    startOperation,
    updateProgress,
    completeOperation,
    failOperation,
    removeOperation,
    clearCompleted,
    clearAll,
  };

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

// ==================== Hook ====================

/**
 * Hook to access the progress context
 */
export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
}

// ==================== Utility Hooks ====================

/**
 * Hook for tracking a file read operation
 */
export function useFileReadProgress() {
  const { startOperation, updateProgress, completeOperation, failOperation } = useProgress();

  const trackFileRead = useCallback(
    async (
      filePath: string,
      operation: () => Promise<{ content: string; fileName?: string }>
    ): Promise<{ content: string; fileName?: string } | null> => {
      const fileName = filePath.split('/').pop() || filePath;
      const opId = startOperation('file-read', `Reading ${fileName}`, { filePath, fileName });

      try {
        updateProgress(opId, 10, 'Starting file read...');

        const result = await operation();

        updateProgress(opId, 100, 'File read complete');
        completeOperation(opId, `Read ${fileName}`);

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failOperation(opId, errorMessage);
        return null;
      }
    },
    [startOperation, updateProgress, completeOperation, failOperation]
  );

  return { trackFileRead };
}

/**
 * Hook for tracking a file write operation
 */
export function useFileWriteProgress() {
  const { startOperation, updateProgress, completeOperation, failOperation } = useProgress();

  const trackFileWrite = useCallback(
    async (
      filePath: string,
      operation: () => Promise<void>
    ): Promise<boolean> => {
      const fileName = filePath.split('/').pop() || filePath;
      const opId = startOperation('file-write', `Writing ${fileName}`, { filePath, fileName });

      try {
        updateProgress(opId, 10, 'Starting file write...');

        await operation();

        updateProgress(opId, 100, 'File write complete');
        completeOperation(opId, `Wrote ${fileName}`);

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failOperation(opId, errorMessage);
        return false;
      }
    },
    [startOperation, updateProgress, completeOperation, failOperation]
  );

  return { trackFileWrite };
}

/**
 * Hook for tracking an API call operation
 */
export function useApiCallProgress() {
  const { startOperation, updateProgress, completeOperation, failOperation } = useProgress();

  const trackApiCall = useCallback(
    async <T,>(
      endpoint: string,
      method: string,
      operation: () => Promise<T>
    ): Promise<T | null> => {
      const opId = startOperation('api-call', `${method} ${endpoint}`, { endpoint, method });

      try {
        updateProgress(opId, 10, 'Sending request...');

        const result = await operation();

        updateProgress(opId, 100, 'Request complete');
        completeOperation(opId, `${method} ${endpoint} succeeded`);

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failOperation(opId, errorMessage);
        return null;
      }
    },
    [startOperation, updateProgress, completeOperation, failOperation]
  );

  return { trackApiCall };
}

/**
 * Hook for tracking a chat streaming operation
 */
export function useChatStreamProgress() {
  const { startOperation, updateProgress, completeOperation, failOperation } = useProgress();

  const trackChatStream = useCallback(
    async (
      operation: (onProgress: (progress: number, message: string) => void) => Promise<void>
    ): Promise<boolean> => {
      const opId = startOperation('chat-stream', 'AI Response', {});

      try {
        await operation((progress, message) => {
          updateProgress(opId, progress, message);
        });

        completeOperation(opId, 'Response complete');
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failOperation(opId, errorMessage);
        return false;
      }
    },
    [startOperation, updateProgress, completeOperation, failOperation]
  );

  return { trackChatStream };
}

'use client';

/**
 * Queue Context - Provides global state management for the operation queue
 * Manages file operation queue state and provides methods to interact with it
 */

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import type { QueuedOperation, QueueStats, OperationResult } from '@/types/queue';
import { getOperationQueue, type OperationQueue } from '@/lib/queue/operation-queue';

// ==================== Types ====================

export interface QueueContextValue {
  // State
  operations: QueuedOperation[];
  stats: QueueStats;
  isProcessing: boolean;

  // Operations
  addOperation: <T = unknown>(
    type: QueuedOperation['type'],
    displayName: string,
    filePath: string,
    handler: (signal: AbortSignal, onProgress?: (progress: number) => void) => Promise<OperationResult<T>>,
    options?: {
      priority?: 'low' | 'normal' | 'high';
      abortSignal?: AbortSignal;
    }
  ) => Promise<OperationResult<T>>;
  cancelOperation: (id: string) => boolean;
  cancelAllOperations: () => void;
  retryOperation: (id: string) => Promise<boolean>;
  removeOperation: (id: string) => boolean;
  clearHistory: () => void;
  pauseQueue: () => void;
  resumeQueue: () => void;
}

const QueueContext = createContext<QueueContextValue | undefined>(undefined);

// ==================== Provider ====================

interface QueueProviderProps {
  children: React.ReactNode;
  maxConcurrent?: number;
  maxHistory?: number;
}

export function QueueProvider({ children, maxConcurrent = 3, maxHistory = 50 }: QueueProviderProps) {
  const [queue] = useState<OperationQueue>(() =>
    getOperationQueue({
      maxConcurrent,
      maxHistory,
    })
  );

  const [operations, setOperations] = useState<QueuedOperation[]>([]);
  const [stats, setStats] = useState<QueueStats>(queue.getStats());
  const [isProcessing, setIsProcessing] = useState(false);

  // Subscribe to queue events
  useEffect(() => {
    const unsubscribe = queue.subscribe(() => {
      // Update operations and stats on any event
      setOperations(queue.getAllOperations());
      setStats(queue.getStats());
      setIsProcessing(queue.getState().isProcessing);
    });

    // Initial state
    setOperations(queue.getAllOperations());
    setStats(queue.getStats());

    return () => {
      unsubscribe();
    };
  }, [queue]);

  /**
   * Add a new operation to the queue
   */
  const addOperation = useCallback(
    async <T = unknown>(
      type: QueuedOperation['type'],
      displayName: string,
      filePath: string,
      handler: (signal: AbortSignal, onProgress?: (progress: number) => void) => Promise<OperationResult<T>>,
      options?: {
        priority?: 'low' | 'normal' | 'high';
        abortSignal?: AbortSignal;
      }
    ): Promise<OperationResult<T>> => {
      return queue.add<T>(type, displayName, filePath, handler, options);
    },
    [queue]
  );

  /**
   * Cancel an operation
   */
  const cancelOperation = useCallback(
    (id: string): boolean => {
      const result = queue.cancel(id);
      if (result) {
        setOperations(queue.getAllOperations());
        setStats(queue.getStats());
      }
      return result;
    },
    [queue]
  );

  /**
   * Cancel all queued operations
   */
  const cancelAllOperations = useCallback(() => {
    queue.cancelAll();
    setOperations(queue.getAllOperations());
    setStats(queue.getStats());
  }, [queue]);

  /**
   * Retry a failed operation
   */
  const retryOperation = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await queue.retry(id);
      if (result) {
        setOperations(queue.getAllOperations());
        setStats(queue.getStats());
      }
      return result;
    },
    [queue]
  );

  /**
   * Remove an operation from history
   */
  const removeOperation = useCallback(
    (id: string): boolean => {
      const result = queue.remove(id);
      if (result) {
        setOperations(queue.getAllOperations());
        setStats(queue.getStats());
      }
      return result;
    },
    [queue]
  );

  /**
   * Clear all completed operations from history
   */
  const clearHistory = useCallback(() => {
    queue.clearHistory();
    setOperations(queue.getAllOperations());
    setStats(queue.getStats());
  }, [queue]);

  /**
   * Pause the queue
   */
  const pauseQueue = useCallback(() => {
    queue.pause();
    setIsProcessing(false);
  }, [queue]);

  /**
   * Resume the queue
   */
  const resumeQueue = useCallback(() => {
    queue.resume();
    setIsProcessing(true);
  }, [queue]);

  // ==================== Context Value ====================

  const value: QueueContextValue = {
    operations,
    stats,
    isProcessing,
    addOperation,
    cancelOperation,
    cancelAllOperations,
    retryOperation,
    removeOperation,
    clearHistory,
    pauseQueue,
    resumeQueue,
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

// ==================== Hooks ====================

/**
 * Hook to access the queue context
 */
export function useQueueContext(): QueueContextValue {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueueContext must be used within a QueueProvider');
  }
  return context;
}

/**
 * Hook to access the queue context safely (returns null if not within provider)
 */
export function useQueueContextSafe(): QueueContextValue | null {
  return useContext(QueueContext) ?? null;
}

/**
 * Hook to get queue statistics
 */
export function useQueueStats(): QueueStats {
  const context = useQueueContext();
  return context.stats;
}

/**
 * Hook to get all operations
 */
export function useQueueOperations(): QueuedOperation[] {
  const context = useQueueContext();
  return context.operations;
}

/**
 * Hook to get operations by status
 */
export function useOperationsByStatus(status: QueuedOperation['status']): QueuedOperation[] {
  const operations = useQueueOperations();
  return operations.filter((op) => op.status === status);
}

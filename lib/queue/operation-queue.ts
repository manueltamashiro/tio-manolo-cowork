/**
 * Operation Queue Manager - Manages concurrent file operations
 * Prevents conflicts by controlling the number of simultaneous operations
 */

import type {
  QueuedOperation,
  QueueOptions,
  QueueStats,
  QueueEvent,
  OperationHandler,
  OperationResult,
  OperationStatus,
  OperationPriority,
} from '@/types/queue';

// Default configuration
const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_MAX_HISTORY = 50;

/**
 * Generate a unique operation ID
 */
function generateId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Priority ordering for queue sorting
 */
const PRIORITY_ORDER: Record<OperationPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

/**
 * Operation Queue Manager Class
 */
export class OperationQueue {
  private operations: Map<string, QueuedOperation> = new Map();
  private handlers: Map<string, OperationHandler> = new Map();
  private listeners: Set<(event: QueueEvent) => void> = new Set();
  private runningCount = 0;
  private maxConcurrent: number;
  private maxHistory: number;
  private isProcessing = false;

  constructor(options: QueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.maxHistory = options.maxHistory ?? DEFAULT_MAX_HISTORY;
  }

  /**
   * Subscribe to queue events
   */
  subscribe(listener: (event: QueueEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: QueueEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in queue event listener:', error);
      }
    });
  }

  /**
   * Get all operations
   */
  getAllOperations(): QueuedOperation[] {
    return Array.from(this.operations.values())
      .sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime());
  }

  /**
   * Get operations by status
   */
  getOperationsByStatus(status: OperationStatus): QueuedOperation[] {
    return this.getAllOperations().filter((op) => op.status === status);
  }

  /**
   * Get a specific operation by ID
   */
  getOperation(id: string): QueuedOperation | undefined {
    return this.operations.get(id);
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    const allOps = this.getAllOperations();
    return {
      total: allOps.length,
      running: allOps.filter((op) => op.status === 'running').length,
      queued: allOps.filter((op) => op.status === 'queued').length,
      completed: allOps.filter((op) => op.status === 'completed').length,
      failed: allOps.filter((op) => op.status === 'failed').length,
      cancelled: allOps.filter((op) => op.status === 'cancelled').length,
    };
  }

  /**
   * Get the current queue state
   */
  getState() {
    return {
      operations: this.getAllOperations(),
      stats: this.getStats(),
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Update an operation's status
   */
  private updateOperation(
    id: string,
    updates: Partial<QueuedOperation>
  ): QueuedOperation | undefined {
    const operation = this.operations.get(id);
    if (!operation) return undefined;

    const updated = { ...operation, ...updates };
    this.operations.set(id, updated);
    return updated;
  }

  /**
   * Update operation progress
   */
  private updateProgress(id: string, progress: number): void {
    const operation = this.updateOperation(id, { progress });
    if (operation) {
      this.emit({
        type: 'operation_progress',
        operation,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Clean up old completed/failed operations
   */
  private cleanupHistory(): void {
    const completedOps = this.getAllOperations().filter(
      (op) => op.status === 'completed' || op.status === 'failed'
    );

    if (completedOps.length > this.maxHistory) {
      const toRemove = completedOps
        .sort((a, b) => (a.completedAt?.getTime() || 0) - (b.completedAt?.getTime() || 0))
        .slice(0, completedOps.length - this.maxHistory);

      toRemove.forEach((op) => this.operations.delete(op.id));
    }
  }

  /**
   * Add a new operation to the queue
   */
  async add<T = unknown>(
    type: QueuedOperation['type'],
    displayName: string,
    filePath: string,
    handler: OperationHandler<T>,
    options: {
      priority?: OperationPriority;
      abortSignal?: AbortSignal;
    } = {}
  ): Promise<OperationResult<T>> {
    const id = generateId();
    const now = new Date();

    const operation: QueuedOperation = {
      id,
      type,
      status: 'queued',
      priority: options.priority ?? 'normal',
      displayName,
      filePath,
      progress: 0,
      queuedAt: now,
      abortSignal: options.abortSignal,
    };

    this.operations.set(id, operation);
    this.handlers.set(id, handler);

    this.emit({
      type: 'operation_added',
      operation,
      timestamp: now,
    });

    // Process the queue
    this.processQueue();

    // Wait for this operation to complete
    return new Promise((resolve) => {
      const checkCompletion = () => {
        const op = this.operations.get(id);
        if (!op) {
          resolve({ success: false, error: 'Operation not found' });
          return;
        }

        if (op.status === 'completed') {
          resolve({ success: true });
        } else if (op.status === 'failed') {
          resolve({ success: false, error: op.error });
        } else if (op.status === 'cancelled') {
          resolve({ success: false, error: 'Operation cancelled' });
        } else {
          // Still running or queued, check again
          setTimeout(checkCompletion, 100);
        }
      };

      checkCompletion();
    });
  }

  /**
   * Cancel an operation
   */
  cancel(id: string): boolean {
    const operation = this.operations.get(id);
    if (!operation) return false;

    if (operation.status === 'queued') {
      this.updateOperation(id, {
        status: 'cancelled',
        completedAt: new Date(),
        progress: 0,
      });

      this.emit({
        type: 'operation_cancelled',
        operation: this.operations.get(id)!,
        timestamp: new Date(),
      });

      return true;
    }

    if (operation.status === 'running') {
      // For running operations, just mark as cancelled
      // The handler should check the signal's aborted property
      const updatedOp = this.updateOperation(id, { status: 'cancelled', completedAt: new Date() });
      if (updatedOp) {
        this.emit({ type: 'operation_cancelled', operation: updatedOp, timestamp: new Date() });
      }
      return true;
    }

    return false;
  }

  /**
   * Cancel all queued operations
   */
  cancelAll(): void {
    const queuedOps = this.getOperationsByStatus('queued');
    queuedOps.forEach((op) => this.cancel(op.id));

    // Also mark running operations as cancelled
    const runningOps = this.getOperationsByStatus('running');
    runningOps.forEach((op) => {
      const updatedOp = this.updateOperation(op.id, { status: 'cancelled', completedAt: new Date() });
      if (updatedOp) {
        this.emit({ type: 'operation_cancelled', operation: updatedOp, timestamp: new Date() });
      }
    });
  }

  /**
   * Retry a failed operation
   */
  async retry(id: string): Promise<boolean> {
    const operation = this.operations.get(id);
    if (!operation || operation.status !== 'failed') return false;

    // Reset operation to queued
    this.updateOperation(id, {
      status: 'queued',
      progress: 0,
      error: undefined,
      queuedAt: new Date(),
    });

    this.processQueue();
    return true;
  }

  /**
   * Remove an operation from history
   */
  remove(id: string): boolean {
    const operation = this.operations.get(id);
    if (!operation) return false;

    if (operation.status === 'running' || operation.status === 'queued') {
      return false; // Cannot remove active operations
    }

    this.operations.delete(id);
    return true;
  }

  /**
   * Clear all completed operations from history
   */
  clearHistory(): void {
    const completedOps = this.getOperationsByStatus('completed');
    const failedOps = this.getOperationsByStatus('failed');
    const cancelledOps = this.getOperationsByStatus('cancelled');

    [...completedOps, ...failedOps, ...cancelledOps].forEach((op) => {
      this.operations.delete(op.id);
    });

    this.emit({
      type: 'queue_cleared',
      operation: {
        id: 'clear',
        type: 'read_file',
        status: 'completed',
        priority: 'normal',
        displayName: 'Clear Queue',
        filePath: '',
        progress: 100,
        queuedAt: new Date(),
      },
      timestamp: new Date(),
    });
  }

  /**
   * Get the next operation to execute
   */
  private getNextOperation(): QueuedOperation | undefined {
    const queuedOps = this.getOperationsByStatus('queued');

    if (queuedOps.length === 0) return undefined;

    // Sort by priority, then by queue time
    queuedOps.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });

    return queuedOps[0];
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(operation: QueuedOperation): Promise<void> {
    const startTime = new Date();

    this.updateOperation(operation.id, {
      status: 'running',
      startedAt: startTime,
    });

    this.emit({
      type: 'operation_started',
      operation: this.operations.get(operation.id)!,
      timestamp: startTime,
    });

    try {
      // Create a new abort controller for this operation if not provided
      const abortController = operation.abortSignal
        ? undefined
        : new AbortController();

      const signal = operation.abortSignal || abortController!.signal;

      // Execute the handler with progress callback
      const handler = this.handlers.get(operation.id);
      if (!handler) {
        throw new Error(`Handler not found for operation ${operation.id}`);
      }

      const result = await handler(
        signal,
        (progress) => this.updateProgress(operation.id, progress)
      );

      // Check if operation was cancelled during execution
      if (signal.aborted) {
        this.updateOperation(operation.id, {
          status: 'cancelled',
          progress: 0,
          completedAt: new Date(),
        });

        this.emit({
          type: 'operation_cancelled',
          operation: this.operations.get(operation.id)!,
          timestamp: new Date(),
        });

        return;
      }

      if (result.success) {
        this.updateOperation(operation.id, {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
        });

        this.emit({
          type: 'operation_completed',
          operation: this.operations.get(operation.id)!,
          timestamp: new Date(),
        });
      } else {
        throw new Error(result.error || 'Operation failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.updateOperation(operation.id, {
        status: 'failed',
        error: message,
        completedAt: new Date(),
      });

      this.emit({
        type: 'operation_failed',
        operation: this.operations.get(operation.id)!,
        timestamp: new Date(),
      });
    } finally {
      this.runningCount--;
      // Clean up the handler after operation completes
      this.handlers.delete(operation.id);
    }
  }

  /**
   * Process the queue - execute operations based on concurrency limit
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (true) {
      // Check if we can start more operations
      if (this.runningCount >= this.maxConcurrent) {
        break;
      }

      const nextOp = this.getNextOperation();
      if (!nextOp) {
        break;
      }

      // Check if operation was cancelled before starting
      if (nextOp.abortSignal?.aborted) {
        this.updateOperation(nextOp.id, {
          status: 'cancelled',
          completedAt: new Date(),
        });
        this.emit({
          type: 'operation_cancelled',
          operation: this.operations.get(nextOp.id)!,
          timestamp: new Date(),
        });
        continue;
      }

      // Start the operation
      this.runningCount++;
      this.executeOperation(nextOp).catch((err) => {
        console.error('Error executing operation:', err);
      });
    }

    this.isProcessing = false;

    // Clean up old history
    this.cleanupHistory();
  }

  /**
   * Pause the queue (no new operations will start)
   */
  pause(): void {
    this.maxConcurrent = 0;
  }

  /**
   * Resume the queue with previous concurrency limit
   */
  resume(): void {
    this.maxConcurrent = DEFAULT_MAX_CONCURRENT;
    this.processQueue();
  }

  /**
   * Destroy the queue and clean up
   */
  destroy(): void {
    this.cancelAll();
    this.listeners.clear();
    this.operations.clear();
  }
}

// Global singleton instance
let globalQueue: OperationQueue | null = null;

/**
 * Get the global operation queue instance
 */
export function getOperationQueue(options?: QueueOptions): OperationQueue {
  if (!globalQueue) {
    globalQueue = new OperationQueue(options);
  }
  return globalQueue;
}

/**
 * Reset the global queue (mainly for testing)
 */
export function resetGlobalQueue(): void {
  if (globalQueue) {
    globalQueue.destroy();
    globalQueue = null;
  }
}

/**
 * Operation Queue Types - File operation queue system
 */

/**
 * Operation types that can be queued
 */
export type OperationType =
  | 'read_file'
  | 'write_file'
  | 'create_file'
  | 'delete_file'
  | 'list_directory';

/**
 * Operation status in the queue
 */
export type OperationStatus =
  | 'queued'       // Operation is waiting in queue
  | 'running'      // Operation is currently executing
  | 'completed'    // Operation completed successfully
  | 'failed'       // Operation failed
  | 'cancelled';   // Operation was cancelled

/**
 * Priority levels for queued operations
 */
export type OperationPriority = 'low' | 'normal' | 'high';

/**
 * A queued file operation
 */
export interface QueuedOperation {
  /** Unique identifier for this operation */
  id: string;
  /** Type of operation */
  type: OperationType;
  /** Current status */
  status: OperationStatus;
  /** Priority level */
  priority: OperationPriority;
  /** Display name for UI */
  displayName: string;
  /** File path being operated on */
  filePath: string;
  /** Operation progress (0-100) */
  progress: number;
  /** Error message if failed */
  error?: string;
  /** When the operation was queued */
  queuedAt: Date;
  /** When the operation started running */
  startedAt?: Date;
  /** When the operation completed */
  completedAt?: Date;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Total number of operations in queue */
  total: number;
  /** Number of operations currently running */
  running: number;
  /** Number of operations waiting */
  queued: number;
  /** Number of completed operations (retained in history) */
  completed: number;
  /** Number of failed operations */
  failed: number;
  /** Number of cancelled operations */
  cancelled: number;
}

/**
 * Queue configuration options
 */
export interface QueueOptions {
  /** Maximum number of concurrent operations (default: 3) */
  maxConcurrent?: number;
  /** Maximum number of completed operations to keep in history (default: 50) */
  maxHistory?: number;
  /** Whether to automatically retry failed operations (default: false) */
  autoRetry?: boolean;
  /** Maximum retry attempts (default: 2) */
  maxRetries?: number;
}

/**
 * Result of a queued operation execution
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Queue event types
 */
export type QueueEventType =
  | 'operation_added'
  | 'operation_started'
  | 'operation_progress'
  | 'operation_completed'
  | 'operation_failed'
  | 'operation_cancelled'
  | 'queue_cleared';

/**
 * Queue event payload
 */
export interface QueueEvent {
  type: QueueEventType;
  operation: QueuedOperation;
  timestamp: Date;
}

/**
 * Queue state snapshot
 */
export interface QueueState {
  operations: QueuedOperation[];
  stats: QueueStats;
  isProcessing: boolean;
}

/**
 * Operation handler function type
 */
export type OperationHandler<T = unknown> = (
  signal: AbortSignal,
  onProgress?: (progress: number) => void
) => Promise<OperationResult<T>>;

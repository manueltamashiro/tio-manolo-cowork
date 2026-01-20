'use client';

/**
 * Queue Status Component - Displays the current state of the operation queue
 * Shows active operations, progress, and provides controls for cancellation
 */

import React, { useState } from 'react';
import { X, Play, Pause, Trash2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import type { QueuedOperation, QueueStats } from '@/types/queue';

// ==================== Types ====================

export interface QueueStatusProps {
  stats: QueueStats;
  operations: QueuedOperation[];
  isProcessing: boolean;
  onCancelOperation: (id: string) => void;
  onCancelAll: () => void;
  onRetryOperation?: (id: string) => Promise<boolean>;
  onRemoveOperation?: (id: string) => boolean;
  onClearHistory?: () => void;
  onPauseQueue?: () => void;
  onResumeQueue?: () => void;
}

// ==================== Helper Components ====================

interface OperationItemProps {
  operation: QueuedOperation;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => Promise<boolean>;
  onRemove?: (id: string) => boolean;
}

function OperationItem({ operation, onCancel, onRetry, onRemove }: OperationItemProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (onRetry) {
      setRetrying(true);
      await onRetry(operation.id);
      setRetrying(false);
    }
  };

  const statusConfig = {
    queued: {
      icon: '⋯',
      color: 'text-neutral-400',
      bg: 'bg-neutral-700/50',
      label: 'Queued',
    },
    running: {
      icon: '⟳',
      color: 'text-claude-primary-400',
      bg: 'bg-claude-primary-500/10',
      label: 'Running',
    },
    completed: {
      icon: '✓',
      color: 'text-claude-success-500',
      bg: 'bg-claude-success-500/10',
      label: 'Completed',
    },
    failed: {
      icon: '✕',
      color: 'text-claude-error-500',
      bg: 'bg-claude-error-500/10',
      label: 'Failed',
    },
    cancelled: {
      icon: '—',
      color: 'text-neutral-500',
      bg: 'bg-neutral-700/30',
      label: 'Cancelled',
    },
  };

  const config = statusConfig[operation.status];
  const canCancel = operation.status === 'queued' || operation.status === 'running';
  const canRetry = operation.status === 'failed';
  const canRemove = operation.status === 'completed' || operation.status === 'failed' || operation.status === 'cancelled';

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg border
        ${config.bg}
        ${operation.status === 'running' ? 'border-claude-primary-500/30' : 'border-neutral-700/50'}
        transition-colors
      `}
    >
      {/* Status Icon */}
      <div className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center ${config.bg} ${config.color}`}>
        {operation.status === 'running' ? (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <span className="text-sm font-medium">{config.icon}</span>
        )}
      </div>

      {/* Operation Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{operation.displayName}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>{config.label}</span>
        </div>
        <div className="text-xs text-neutral-400 truncate font-mono">{operation.filePath}</div>

        {/* Progress Bar */}
        {operation.status === 'running' && operation.progress > 0 && (
          <div className="mt-1.5 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-claude-primary-500 transition-all duration-300"
              style={{ width: `${operation.progress}%` }}
            />
          </div>
        )}

        {/* Error Message */}
        {operation.status === 'failed' && operation.error && (
          <div className="mt-1 text-xs text-claude-error-400 truncate">{operation.error}</div>
        )}

        {/* Timestamp for completed operations */}
        {(operation.status === 'completed' || operation.status === 'failed' || operation.status === 'cancelled') && operation.completedAt && (
          <div className="mt-1 text-xs text-neutral-500">
            {operation.completedAt.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {canRetry && onRetry && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
            title="Retry operation"
          >
            <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
          </button>
        )}
        {canCancel && onCancel && (
          <button
            type="button"
            onClick={() => onCancel(operation.id)}
            className="p-1.5 rounded text-neutral-400 hover:text-claude-error-400 hover:bg-neutral-700 transition-colors"
            title="Cancel operation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {canRemove && onRemove && (
          <button
            type="button"
            onClick={() => onRemove(operation.id)}
            className="p-1.5 rounded text-neutral-500 hover:text-white hover:bg-neutral-700 transition-colors"
            title="Remove from history"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ==================== Main Component ====================

export function QueueStatus({
  stats,
  operations,
  isProcessing,
  onCancelOperation,
  onCancelAll,
  onRetryOperation,
  onRemoveOperation,
  onClearHistory,
  onPauseQueue,
  onResumeQueue,
}: QueueStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'history'>('active');

  // Active operations: queued or running
  const activeOperations = operations.filter((op) => op.status === 'queued' || op.status === 'running');

  // History operations: completed, failed, or cancelled
  const historyOperations = operations.filter((op) => op.status === 'completed' || op.status === 'failed' || op.status === 'cancelled');

  const displayOperations = filter === 'active' ? activeOperations : filter === 'history' ? historyOperations : operations;
  const hasActive = activeOperations.length > 0;

  // Auto-expand when there are active operations
  React.useEffect(() => {
    if (hasActive && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasActive, isExpanded]);

  // Don't render if nothing to show
  if (stats.total === 0 && !hasActive) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-h-[50vh] flex flex-col">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          flex items-center justify-between gap-3 px-4 py-3 rounded-t-lg
          bg-neutral-800 border border-neutral-700 border-b-0
          text-white shadow-claude-lg
          ${isExpanded ? '' : 'rounded-b-lg'}
          hover:bg-neutral-750 transition-colors
        `}
      >
        <div className="flex items-center gap-2">
          {hasActive ? (
            <>
              <div className="relative">
                <div className="w-3 h-3 bg-claude-primary-500 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-3 h-3 bg-claude-primary-500 rounded-full animate-ping opacity-75" />
              </div>
              <span className="text-sm font-medium">{stats.running} running</span>
              {stats.queued > 0 && <span className="text-xs text-neutral-400">+ {stats.queued} queued</span>}
            </>
          ) : (
            <>
              <span className="text-sm font-medium">Queue</span>
              <span className="text-xs text-neutral-400">{stats.completed} completed</span>
            </>
          )}
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="flex flex-col bg-neutral-800 border border-neutral-700 rounded-b-lg shadow-claude-lg overflow-hidden">
          {/* Controls */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-700 bg-neutral-850">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilter('active')}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  filter === 'active'
                    ? 'bg-claude-primary-500/20 text-claude-primary-400'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                }`}
              >
                Active ({stats.running + stats.queued})
              </button>
              <button
                type="button"
                onClick={() => setFilter('history')}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  filter === 'history'
                    ? 'bg-claude-primary-500/20 text-claude-primary-400'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                }`}
              >
                History ({stats.completed + stats.failed + stats.cancelled})
              </button>
            </div>
            <div className="flex items-center gap-1">
              {(onPauseQueue || onResumeQueue) && isProcessing && (
                <button
                  type="button"
                  onClick={onPauseQueue}
                  className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                  title="Pause queue"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
              )}
              {(onPauseQueue || onResumeQueue) && !isProcessing && stats.queued > 0 && (
                <button
                  type="button"
                  onClick={onResumeQueue}
                  className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                  title="Resume queue"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              )}
              {hasActive && (
                <button
                  type="button"
                  onClick={onCancelAll}
                  className="p-1.5 rounded text-neutral-400 hover:text-claude-error-400 hover:bg-neutral-700 transition-colors"
                  title="Cancel all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {historyOperations.length > 0 && onClearHistory && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Operations List */}
          <div className="flex-1 overflow-y-auto max-h-[300px] p-2 space-y-2">
            {displayOperations.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-sm">
                {filter === 'active' ? 'No active operations' : filter === 'history' ? 'No history yet' : 'No operations'}
              </div>
            ) : (
              displayOperations.map((operation) => (
                <OperationItem
                  key={operation.id}
                  operation={operation}
                  onCancel={onCancelOperation}
                  onRetry={onRetryOperation}
                  onRemove={onRemoveOperation}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Compact Badge Component ====================

interface QueueBadgeProps {
  stats: QueueStats;
  operations: QueuedOperation[];
  onClick?: () => void;
}

export function QueueBadge({ stats, operations, onClick }: QueueBadgeProps) {
  const activeCount = stats.running + stats.queued;

  if (activeCount === 0) return null;

  const runningOperation = operations.find((op) => op.status === 'running');

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 text-white hover:bg-neutral-750 transition-colors"
    >
      <div className="relative">
        <div className="w-2 h-2 bg-claude-primary-500 rounded-full" />
        {stats.running > 0 && <div className="absolute inset-0 w-2 h-2 bg-claude-primary-500 rounded-full animate-ping" />}
      </div>
      <span className="text-xs font-medium">
        {stats.running > 0 && `${stats.running} running`}
        {stats.running > 0 && stats.queued > 0 && ' · '}
        {stats.queued > 0 && `${stats.queued} queued`}
      </span>
      {runningOperation && (
        <span className="text-xs text-neutral-400 truncate max-w-[120px]">{runningOperation.displayName}</span>
      )}
    </button>
  );
}

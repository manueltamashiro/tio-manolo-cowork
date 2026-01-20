'use client';

import { useProgress, type ProgressOperation } from '@/lib/context/ProgressContext';
import { File, Loader2, CheckCircle2, XCircle, Server, MessageSquare, Trash2 } from 'lucide-react';

// ==================== Types ====================

interface ProgressPanelProps {
  className?: string;
}

// ==================== Operation Icons ====================

const operationIcons = {
  'file-read': File,
  'file-write': File,
  'file-delete': Trash2,
  'api-call': Server,
  'chat-stream': MessageSquare,
  'other': Loader2,
};

const operationColors = {
  'file-read': 'text-claude-info-500',
  'file-write': 'text-claude-accent.amber',
  'file-delete': 'text-claude-error-500',
  'api-call': 'text-claude-accent.purple',
  'chat-stream': 'text-claude-primary-400',
  'other': 'text-neutral-400',
};

// ==================== Progress Item Component ====================

interface ProgressItemProps {
  operation: ProgressOperation;
  onRemove: (id: string) => void;
}

function ProgressItem({ operation, onRemove }: ProgressItemProps) {
  const IconComponent = operationIcons[operation.type];
  const colorClass = operationColors[operation.type];

  const isInProgress = operation.status === 'in-progress';
  const isCompleted = operation.status === 'completed';
  const isError = operation.status === 'error';

  const handleRemove = () => {
    onRemove(operation.id);
  };

  return (
    <div
      className={`
        relative flex items-start gap-3 p-3 rounded-lg
        transition-all duration-200
        ${isInProgress ? 'bg-neutral-800/80' : ''}
        ${isCompleted ? 'bg-neutral-800/50' : ''}
        ${isError ? 'bg-claude-error-500/10 border border-claude-error-500/30' : ''}
      `}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 ${colorClass}`}>
        {isCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-claude-success-500" />
        ) : isError ? (
          <XCircle className="w-4 h-4 text-claude-error-500" />
        ) : (
          <IconComponent className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className="text-sm font-medium text-white truncate">{operation.title}</p>

        {/* Message or Error */}
        {operation.message && !isError && (
          <p className="text-xs text-neutral-400 truncate mt-0.5">{operation.message}</p>
        )}
        {isError && operation.error && (
          <p className="text-xs text-claude-error-400 truncate mt-0.5">{operation.error}</p>
        )}

        {/* Progress Bar for in-progress operations */}
        {isInProgress && operation.progress < 100 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span>Progress</span>
              <span>{operation.progress}%</span>
            </div>
            <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${operation.progress}%` }}
              >
                {/* Shimmer effect on progress bar */}
                <div className="h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </div>
            </div>
          </div>
        )}

        {/* Metadata (file name, etc.) */}
        {operation.metadata?.fileName && (
          <p className="text-xs text-neutral-500 truncate mt-1">
            {operation.metadata.fileName}
          </p>
        )}
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={handleRemove}
        className="flex-shrink-0 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700/50 rounded transition-all p-1"
        aria-label="Remove"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ==================== Animated Active Indicator ====================

interface ActiveIndicatorProps {
  activeCount: number;
}

function ActiveIndicator({ activeCount }: ActiveIndicatorProps) {
  if (activeCount === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 rounded-full">
      <div className="relative">
        <div className="w-2 h-2 bg-blue-400 rounded-full" />
        <div className="absolute inset-0 w-2 h-2 bg-blue-400 rounded-full animate-ping opacity-75" />
      </div>
      <span className="text-xs font-medium text-blue-300">{activeCount} active</span>
    </div>
  );
}

// ==================== Progress Panel Component ====================

export function ProgressPanel({ className = '' }: ProgressPanelProps) {
  const { operations, activeCount, removeOperation, clearCompleted } = useProgress();

  const completedCount = operations.filter((op) => op.status === 'completed').length;
  const errorCount = operations.filter((op) => op.status === 'error').length;

  const hasOperations = operations.length > 0;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Activity</h2>
          {activeCount > 0 && <ActiveIndicator activeCount={activeCount} />}
        </div>
        {completedCount > 0 && (
          <button
            type="button"
            onClick={clearCompleted}
            className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Clear completed
          </button>
        )}
      </div>

      {/* Operations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!hasOperations ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500">
            <Loader2 className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          operations.map((operation) => (
            <ProgressItem
              key={operation.id}
              operation={operation}
              onRemove={removeOperation}
            />
          ))
        )}
      </div>

      {/* Footer with stats */}
      {hasOperations && (
        <div className="px-4 py-2 border-t border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Total: {operations.length}</span>
            {errorCount > 0 && (
              <span className="text-claude-error-400">{errorCount} error{errorCount > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Mini Progress Indicator ====================

interface MiniProgressIndicatorProps {
  className?: string;
}

export function MiniProgressIndicator({ className = '' }: MiniProgressIndicatorProps) {
  const { activeCount } = useProgress();

  if (activeCount === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="relative w-2 h-2">
        <div className="absolute inset-0 w-2 h-2 bg-blue-400 rounded-full" />
        <div className="absolute inset-0 w-2 h-2 bg-blue-400 rounded-full animate-ping opacity-75" />
      </div>
      <span className="text-xs font-medium text-blue-300">{activeCount}</span>
    </div>
  );
}

// ==================== Floating Progress Panel ====================

interface FloatingProgressPanelProps {
  className?: string;
  position?: 'bottom-right' | 'bottom-left';
}

export function FloatingProgressPanel({
  className = '',
  position = 'bottom-right',
}: FloatingProgressPanelProps) {
  const { operations } = useProgress();

  if (operations.length === 0) return null;

  const positionClass = position === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4';

  return (
    <div
      className={`
        fixed z-claude-toast w-80 max-h-96
        bg-neutral-900 border border-neutral-700 rounded-lg shadow-claude-lg
        animate-slide-in
        ${positionClass} ${className}
      `}
    >
      <ProgressPanel />
    </div>
  );
}

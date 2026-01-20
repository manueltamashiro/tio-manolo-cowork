'use client';

/**
 * PerformanceDebugPanel - A debug panel showing real-time performance metrics
 * Displays memory usage, CPU usage, FPS, and API response times
 */

import { useState, useEffect, useMemo } from 'react';
import { usePerformance, type PerformanceRecord } from '@/lib/context/PerformanceContext';

interface PerformanceDebugPanelProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  defaultOpen?: boolean;
  showToggle?: boolean;
  compact?: boolean;
}

const positionClasses: Record<string, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
};

export function PerformanceDebugPanel({
  position = 'bottom-right',
  defaultOpen = false,
  showToggle = true,
  compact = false,
}: PerformanceDebugPanelProps) {
  const { metrics, records, isMonitoring, startMonitoring, stopMonitoring, toggleMonitoring, clearHistory } = usePerformance();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'history'>('overview');

  // Auto-open if there are performance issues
  useEffect(() => {
    if (metrics.memory?.percentage && metrics.memory.percentage > 80) {
      setIsOpen(true);
    }
    if (metrics.fps > 0 && metrics.fps < 30) {
      setIsOpen(true);
    }
  }, [metrics.memory?.percentage, metrics.fps]);

  // Get status color based on metric value
  const getStatusColor = (value: number, thresholds: { warning: number; danger: number }) => {
    if (value >= thresholds.danger) return 'text-rose-500';
    if (value >= thresholds.warning) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getStatusBgColor = (value: number, thresholds: { warning: number; danger: number }) => {
    if (value >= thresholds.danger) return 'bg-rose-500';
    if (value >= thresholds.warning) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  // Calculate statistics for records
  const recordStats = useMemo(() => {
    if (records.length === 0) return null;

    const durations = records.map((r) => r.duration);
    const byType = records.reduce((acc, r) => {
      acc[r.type] = acc[r.type] || [];
      acc[r.type].push(r.duration);
      return acc;
    }, {} as Record<string, number[]>);

    return {
      total: records.length,
      avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      byType: Object.entries(byType).map(([type, durations]) => ({
        type,
        count: durations.length,
        avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      })),
    };
  }, [records]);

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1) return `${Math.round(ms * 1000)}μs`;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Format bytes
  const formatBytes = (mb: number): string => {
    if (mb < 1024) return `${mb}MB`;
    return `${(mb / 1024).toFixed(1)}GB`;
  };

  // Toggle button (shown when panel is closed)
  if (showToggle && !isOpen) {
    return (
      <div className={`fixed ${positionClasses[position]} z-50`}>
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 bg-neutral-800/90 dark:bg-neutral-900/90 backdrop-blur text-neutral-400 hover:text-white rounded-lg shadow-lg border border-neutral-700 transition-colors"
          title="Show performance panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 ${compact ? 'w-72' : 'w-96'}`}>
      <div className="bg-neutral-800/95 dark:bg-neutral-900/95 backdrop-blur rounded-lg shadow-xl border border-neutral-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-claude-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="font-semibold text-white text-sm">Performance</h3>
            {isMonitoring && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-neutral-400">Live</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Toggle monitoring */}
            <button
              onClick={toggleMonitoring}
              className={`p-1.5 rounded transition-colors ${
                isMonitoring
                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                  : 'text-neutral-500 hover:bg-neutral-700'
              }`}
              title={isMonitoring ? 'Stop monitoring' : 'Start monitoring'}
            >
              {isMonitoring ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            {/* Clear history */}
            <button
              onClick={clearHistory}
              className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-700 rounded transition-colors"
              title="Clear history"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            {/* Close */}
            {showToggle && (
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-700 rounded transition-colors"
                title="Close panel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-claude-primary-400 border-b-2 border-claude-primary-400'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'records'
                ? 'text-claude-primary-400 border-b-2 border-claude-primary-400'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Records ({records.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-claude-primary-400 border-b-2 border-claude-primary-400'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            API History
          </button>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="p-4 space-y-4">
              {/* Memory */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-neutral-400">Memory</span>
                  {metrics.memory ? (
                    <span className={`text-sm font-medium ${getStatusColor(metrics.memory.percentage, { warning: 70, danger: 85 })}`}>
                      {metrics.memory.used}MB / {metrics.memory.total}MB ({metrics.memory.percentage}%)
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">Not available</span>
                  )}
                </div>
                {metrics.memory && (
                  <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getStatusBgColor(metrics.memory.percentage, { warning: 70, danger: 85 })} transition-all duration-300`}
                      style={{ width: `${metrics.memory.percentage}%` }}
                    />
                  </div>
                )}
              </div>

              {/* CPU */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-neutral-400">CPU (Est.)</span>
                  {metrics.cpu ? (
                    <span className={`text-sm font-medium ${getStatusColor(metrics.cpu.usage, { warning: 60, danger: 80 })}`}>
                      {metrics.cpu.usage}%
                      {metrics.cpu.cores && <span className="text-neutral-500 text-xs ml-1">({metrics.cpu.cores} cores)</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">Not available</span>
                  )}
                </div>
                {metrics.cpu && (
                  <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getStatusBgColor(metrics.cpu.usage, { warning: 60, danger: 80 })} transition-all duration-300`}
                      style={{ width: `${metrics.cpu.usage}%` }}
                    />
                  </div>
                )}
              </div>

              {/* FPS */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-neutral-400">Frame Rate</span>
                  {metrics.fps > 0 ? (
                    <span className={`text-sm font-medium ${getStatusColor(100 - metrics.fps, { warning: 40, danger: 60 })}`}>
                      {metrics.fps} FPS
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">Monitoring...</span>
                  )}
                </div>
                {metrics.fps > 0 && (
                  <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getStatusBgColor(100 - metrics.fps, { warning: 40, danger: 60 })} transition-all duration-300`}
                      style={{ width: `${Math.min(100, (metrics.fps / 60) * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* API Response Times */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-neutral-400">Avg API Response</span>
                  {metrics.apiResponseTimes.count > 0 ? (
                    <span className={`text-sm font-medium ${getStatusColor(metrics.apiResponseTimes.average, { warning: 500, danger: 1000 })}`}>
                      {formatDuration(metrics.apiResponseTimes.average)}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">No data</span>
                  )}
                </div>
                {metrics.apiResponseTimes.count > 0 && (
                  <div className="flex gap-2 text-xs text-neutral-500 mt-1">
                    <span>Min: {formatDuration(metrics.apiResponseTimes.min)}</span>
                    <span>Max: {formatDuration(metrics.apiResponseTimes.max)}</span>
                    <span>Count: {metrics.apiResponseTimes.count}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              {recordStats && (
                <div className="pt-2 border-t border-neutral-700">
                  <div className="text-xs text-neutral-400 mb-2">Record Statistics</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-neutral-700/50 rounded px-2 py-1">
                      <span className="text-neutral-400">Total:</span> {recordStats.total}
                    </div>
                    <div className="bg-neutral-700/50 rounded px-2 py-1">
                      <span className="text-neutral-400">Avg:</span> {formatDuration(recordStats.avgDuration)}
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {recordStats.byType.map(({ type, count, avgDuration }) => (
                      <div key={type} className="flex items-center justify-between text-xs bg-neutral-700/50 rounded px-2 py-1">
                        <span className="text-neutral-300 capitalize">{type}</span>
                        <span className="text-neutral-400">
                          {count} × {formatDuration(avgDuration)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'records' && (
            <div className="divide-y divide-neutral-700">
              {records.length === 0 ? (
                <div className="p-4 text-center text-neutral-500 text-sm">No records yet</div>
              ) : (
                records.slice(0, 20).map((record) => (
                  <RecordItem key={record.id} record={record} formatDuration={formatDuration} />
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="divide-y divide-neutral-700">
              {metrics.apiResponseTimes.history.length === 0 ? (
                <div className="p-4 text-center text-neutral-500 text-sm">No API calls recorded</div>
              ) : (
                metrics.apiResponseTimes.history
                  .slice(-20)
                  .reverse()
                  .map((item, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 flex items-center justify-between text-xs hover:bg-neutral-700/30"
                    >
                      <span className="text-neutral-400 truncate max-w-[200px]">{item.endpoint || 'Unknown'}</span>
                      <span className={getStatusColor(item.duration, { warning: 500, danger: 1000 })}>
                        {formatDuration(item.duration)}
                      </span>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Record item component
interface RecordItemProps {
  record: PerformanceRecord;
  formatDuration: (ms: number) => string;
}

function RecordItem({ record, formatDuration }: RecordItemProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'api-call':
        return (
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        );
      case 'render':
        return (
          <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  };

  return (
    <div className="px-4 py-2 flex items-center justify-between text-xs hover:bg-neutral-700/30">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {getIcon(record.type)}
        <span className="text-neutral-400 truncate">
          {record.metadata?.endpoint || record.metadata?.component || record.metadata?.operation || record.type}
        </span>
      </div>
      <span className="ml-2 font-medium">{formatDuration(record.duration)}</span>
    </div>
  );
}

// A more compact version that shows just key metrics inline
export function PerformanceMiniStats() {
  const { metrics, isMonitoring, toggleMonitoring } = usePerformance();

  return (
    <div className="flex items-center gap-3 text-xs text-neutral-500">
      {metrics.memory && (
        <span className={getStatusColorClass(metrics.memory.percentage, 70, 85)}>
          {metrics.memory.used}MB
        </span>
      )}
      {metrics.fps > 0 && (
        <span className={getStatusColorClass(100 - metrics.fps, 40, 60)}>
          {metrics.fps}fps
        </span>
      )}
      {metrics.apiResponseTimes.count > 0 && (
        <span>{metrics.apiResponseTimes.average}ms avg</span>
      )}
      <button
        onClick={toggleMonitoring}
        className={`p-1 rounded ${isMonitoring ? 'text-emerald-500' : 'text-neutral-600'}`}
        title={isMonitoring ? 'Monitoring on' : 'Monitoring off'}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          {isMonitoring ? (
            <rect x="6" y="6" width="12" height="12" rx="1" />
          ) : (
            <path d="M8 5v14l11-7z" />
          )}
        </svg>
      </button>
    </div>
  );
}

function getStatusColorClass(value: number, warning: number, danger: number): string {
  if (value >= danger) return 'text-rose-500';
  if (value >= warning) return 'text-amber-500';
  return 'text-emerald-500';
}

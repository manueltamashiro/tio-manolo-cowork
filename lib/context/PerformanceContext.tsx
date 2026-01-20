'use client';

/**
 * Performance Context - Provides global state management for app performance metrics
 * Tracks memory usage, CPU usage, API response times, and frame rate
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// ==================== Types ====================

export interface PerformanceMetrics {
  // Memory metrics (in MB)
  memory: {
    used: number;
    total: number;
    percentage: number;
    limit?: number;
  } | null;

  // CPU metrics (estimated, 0-100)
  cpu: {
    usage: number;
    cores?: number;
  } | null;

  // Frame rate
  fps: number;

  // API response times (ms)
  apiResponseTimes: {
    average: number;
    min: number;
    max: number;
    count: number;
    history: Array<{ timestamp: number; duration: number; endpoint?: string }>;
  };

  // Last updated timestamp
  lastUpdate: number;
}

export interface PerformanceRecord {
  id: string;
  type: 'api-call' | 'render' | 'operation';
  timestamp: number;
  duration: number;
  metadata?: {
    endpoint?: string;
    method?: string;
    component?: string;
    operation?: string;
    [key: string]: string | number | undefined;
  };
}

export interface PerformanceContextValue {
  metrics: PerformanceMetrics;
  records: PerformanceRecord[];
  isMonitoring: boolean;

  // Control monitoring
  startMonitoring: () => void;
  stopMonitoring: () => void;
  toggleMonitoring: () => void;

  // Record metrics
  recordApiCall: (endpoint: string, duration: number, method?: string) => void;
  recordRender: (component: string, duration: number) => void;
  recordOperation: (operation: string, duration: number, metadata?: Record<string, string | number | undefined>) => void;

  // Data management
  clearRecords: () => void;
  clearHistory: () => void;
}

const PerformanceContext = createContext<PerformanceContextValue | undefined>(undefined);

// ==================== Constants ====================

const UPDATE_INTERVAL_MS = 1000; // Update metrics every second
const FPS_HISTORY_SIZE = 60; // Keep last 60 frames for FPS calculation
const API_RESPONSE_HISTORY_SIZE = 50; // Keep last 50 API response times
const MAX_RECORDS = 100; // Maximum records to keep

// ==================== Provider ====================

interface PerformanceProviderProps {
  children: React.ReactNode;
  autoStart?: boolean;
  updateInterval?: number;
}

const initialMetrics: PerformanceMetrics = {
  memory: null,
  cpu: null,
  fps: 0,
  apiResponseTimes: {
    average: 0,
    min: 0,
    max: 0,
    count: 0,
    history: [],
  },
  lastUpdate: 0,
};

export function PerformanceProvider({
  children,
  autoStart = false,
  updateInterval = UPDATE_INTERVAL_MS,
}: PerformanceProviderProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(initialMetrics);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(autoStart);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const animationFrameRef = useRef<number | null>(null);

  // Calculate memory metrics
  const getMemoryMetrics = useCallback((): PerformanceMetrics['memory'] => {
    if (typeof performance === 'undefined' || !(performance as any).memory) {
      return null;
    }

    const memory = (performance as any).memory;
    const used = memory.usedJSHeapSize;
    const total = memory.totalJSHeapSize;
    const limit = memory.jsHeapSizeLimit;

    return {
      used: Math.round(used / 1024 / 1024),
      total: Math.round(total / 1024 / 1024),
      percentage: Math.round((used / total) * 100),
      limit: limit ? Math.round(limit / 1024 / 1024) : undefined,
    };
  }, []);

  // Estimate CPU usage (basic approximation based on frame time variance)
  const getCPUMetrics = useCallback((): PerformanceMetrics['cpu'] => {
    // This is a rough approximation - real CPU measurement isn't available in browsers
    // We'll use the inverse of frame time consistency as a proxy
    if (frameTimesRef.current.length < 5) return null;

    const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
    const variance = frameTimesRef.current.reduce((sum, time) => sum + Math.pow(time - avgFrameTime, 2), 0) / frameTimesRef.current.length;
    const stdDev = Math.sqrt(variance);

    // Map standard deviation to a 0-100 scale (heuristic)
    const estimatedCpu = Math.min(100, Math.round((stdDev / 16) * 100));

    return {
      usage: estimatedCpu,
      cores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
    };
  }, []);

  // Calculate FPS
  const calculateFPS = useCallback((): number => {
    const now = performance.now();
    const frameTime = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    frameTimesRef.current.push(frameTime);
    if (frameTimesRef.current.length > FPS_HISTORY_SIZE) {
      frameTimesRef.current.shift();
    }

    if (frameTimesRef.current.length < 2) return 0;

    const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
    const fps = Math.round(1000 / avgFrameTime);

    return Math.min(120, fps); // Cap at 120 FPS
  }, []);

  // Update all metrics
  const updateMetrics = useCallback(() => {
    setMetrics((prev) => ({
      ...prev,
      memory: getMemoryMetrics(),
      cpu: getCPUMetrics(),
      fps: calculateFPS(),
      lastUpdate: Date.now(),
    }));
  }, [getMemoryMetrics, getCPUMetrics, calculateFPS]);

  // FPS tracking loop
  const trackFPS = useCallback(() => {
    calculateFPS();
    animationFrameRef.current = requestAnimationFrame(trackFPS);
  }, [calculateFPS]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);

    // Start periodic metric updates
    intervalRef.current = setInterval(updateMetrics, updateInterval);

    // Start FPS tracking
    lastFrameTimeRef.current = performance.now();
    frameTimesRef.current = [];
    animationFrameRef.current = requestAnimationFrame(trackFPS);
  }, [isMonitoring, updateInterval, updateMetrics, trackFPS]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    setIsMonitoring(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isMonitoring]);

  // Toggle monitoring
  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  }, [isMonitoring, startMonitoring, stopMonitoring]);

  // Record an API call
  const recordApiCall = useCallback((endpoint: string, duration: number, method = 'GET') => {
    const record: PerformanceRecord = {
      id: `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'api-call',
      timestamp: Date.now(),
      duration,
      metadata: { endpoint, method },
    };

    setRecords((prev) => {
      const updated = [record, ...prev];
      return updated.slice(0, MAX_RECORDS);
    });

    setMetrics((prev) => {
      const history = [...prev.apiResponseTimes.history, { timestamp: Date.now(), duration, endpoint }];
      const limitedHistory = history.slice(-API_RESPONSE_HISTORY_SIZE);

      const durations = limitedHistory.map((h) => h.duration);
      return {
        ...prev,
        apiResponseTimes: {
          average: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          min: Math.min(...durations),
          max: Math.max(...durations),
          count: prev.apiResponseTimes.count + 1,
          history: limitedHistory,
        },
      };
    });
  }, []);

  // Record a render time
  const recordRender = useCallback((component: string, duration: number) => {
    const record: PerformanceRecord = {
      id: `render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'render',
      timestamp: Date.now(),
      duration,
      metadata: { component },
    };

    setRecords((prev) => {
      const updated = [record, ...prev];
      return updated.slice(0, MAX_RECORDS);
    });
  }, []);

  // Record an operation
  const recordOperation = useCallback((
    operation: string,
    duration: number,
    metadata?: Record<string, string | number | undefined>
  ) => {
    const record: PerformanceRecord = {
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'operation',
      timestamp: Date.now(),
      duration,
      metadata: { operation, ...metadata },
    };

    setRecords((prev) => {
      const updated = [record, ...prev];
      return updated.slice(0, MAX_RECORDS);
    });
  }, []);

  // Clear all records
  const clearRecords = useCallback(() => {
    setRecords([]);
  }, []);

  // Clear history (reset metrics)
  const clearHistory = useCallback(() => {
    setMetrics((prev) => ({
      ...prev,
      apiResponseTimes: {
        average: 0,
        min: 0,
        max: 0,
        count: 0,
        history: [],
      },
    }));
    setRecords([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !isMonitoring) {
      startMonitoring();
    } else if (!autoStart && isMonitoring) {
      stopMonitoring();
    }
  }, [autoStart]); // Only run on mount/prop change

  const value: PerformanceContextValue = {
    metrics,
    records,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    toggleMonitoring,
    recordApiCall,
    recordRender,
    recordOperation,
    clearRecords,
    clearHistory,
  };

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
}

// ==================== Hook ====================

/**
 * Hook to access the performance context
 */
export function usePerformance(): PerformanceContextValue {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
}

// ==================== Utility Hooks ====================

/**
 * Hook to track API call performance
 */
export function usePerformanceApiCall() {
  const { recordApiCall } = usePerformance();

  const trackApiCall = useCallback(async <T,>(
    endpoint: string,
    method: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    try {
      const result = await operation();
      const duration = Math.round(performance.now() - startTime);
      recordApiCall(endpoint, duration, method);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      recordApiCall(endpoint, duration, method);
      throw error;
    }
  }, [recordApiCall]);

  return { trackApiCall };
}

/**
 * Hook to track render performance
 */
export function usePerformanceRender() {
  const { recordRender } = usePerformance();

  useEffect(() => {
    const startTime = performance.now();
    return () => {
      const duration = Math.round(performance.now() - startTime);
      // Only record if duration is significant (> 16ms = ~60fps threshold)
      if (duration > 16) {
        const componentName = 'Component';
        recordRender(componentName, duration);
      }
    };
  }, [recordRender]);
}

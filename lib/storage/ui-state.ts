/**
 * UI State Storage
 * Provides persistent storage for UI state using localStorage
 * Works in both web and Electron environments
 * Supports window-specific state for multi-window environments
 */

// ==================== Types ====================

import type { ModelId } from "@/types/claude";

export type Theme = 'dark' | 'light' | 'system';
export type FontSize = 'small' | 'medium' | 'large';

export interface UIState {
  // Sidebar state
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  activeTab: 'sessions' | 'files' | 'activity';

  // Chat state
  currentSessionId: string | null;
  selectedModel: ModelId;
  selectedSystemPromptId: string | null;

  // File tree state
  fileTreeRootPath: string | null;
  fileTreeExpandedPaths: string[];
  fileTreeSelectedPath: string | null;

  // Onboarding state
  hasCompletedOnboarding: boolean;

  // Appearance settings
  theme: Theme;
  fontSize: FontSize;
  streamResponses: boolean;
  showTokenUsage: boolean;
}

const DEFAULT_STATE: UIState = {
  sidebarWidth: 280,
  isSidebarCollapsed: false,
  activeTab: 'sessions',
  currentSessionId: null,
  selectedModel: 'claude-3-7-sonnet-20250219',
  selectedSystemPromptId: null,
  fileTreeRootPath: null,
  fileTreeExpandedPaths: [],
  fileTreeSelectedPath: null,
  hasCompletedOnboarding: false,
  theme: 'system',
  fontSize: 'medium',
  streamResponses: true,
  showTokenUsage: false,
};

const STORAGE_KEY = 'tio_manolo_ui_state';

// Window-specific storage key (for multi-window support)
let currentWindowId: string | null = null;

/**
 * Get the window ID for multi-window support
 * - In Electron with window management: uses the assigned window ID
 * - In browser: uses a per-tab ID generated on first load
 * - Falls back to 'main' for single-window scenarios
 */
function getWindowId(): string {
  if (currentWindowId) {
    return currentWindowId;
  }

  // Check for Electron window ID from URL params
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const windowIdParam = urlParams.get('windowId');
    if (windowIdParam) {
      currentWindowId = windowIdParam;
      return currentWindowId;
    }

    // Check for session ID in URL (for opened sessions)
    const sessionIdParam = urlParams.get('sessionId');
    if (sessionIdParam) {
      // Generate a window ID based on the session for browser mode
      currentWindowId = `session_${sessionIdParam}`;
      return currentWindowId;
    }

    // For browser mode without session, generate a unique ID per tab
    let browserWindowId = sessionStorage.getItem('tio_manolo_window_id');
    if (!browserWindowId) {
      browserWindowId = `window_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('tio_manolo_window_id', browserWindowId);
    }
    currentWindowId = browserWindowId;
    return currentWindowId;
  }

  return 'main';
}

/**
 * Set the window ID explicitly (for Electron-managed windows)
 */
export function setWindowId(windowId: string): void {
  currentWindowId = windowId;
}

/**
 * Get the storage key for the current window
 * Window-specific keys isolate state per window, except for global settings
 */
function getStorageKey(key: string): string {
  const windowId = getWindowId();

  // Global settings that are shared across all windows
  const globalKeys = ['hasCompletedOnboarding', 'theme', 'fontSize', 'streamResponses', 'showTokenUsage'];
  if (globalKeys.includes(key)) {
    return `${STORAGE_KEY}_${key}`;
  }

  // Window-specific settings
  return `${STORAGE_KEY}_${windowId}_${key}`;
}

// ==================== Storage Class ====================

class UIStateStorage {
  private state: UIState;
  private listeners: Set<(state: UIState) => void> = new Set();
  private saveTimeout: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    this.state = this.load();
  }

  /**
   * Load state from localStorage
   */
  private load(): UIState {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_STATE };
    }

    const loadedState: UIState = { ...DEFAULT_STATE };

    // Load each property individually using window-aware keys
    for (const key of Object.keys(DEFAULT_STATE) as Array<keyof UIState>) {
      try {
        const storageKey = getStorageKey(key);
        const stored = localStorage.getItem(storageKey);
        if (stored !== null) {
          (loadedState as any)[key] = JSON.parse(stored);
        }
      } catch (e) {
        console.warn(`Failed to load UI state key "${key}":`, e);
      }
    }

    return loadedState;
  }

  /**
   * Save a single state property to localStorage (debounced per key)
   */
  private saveKey(key: string): void {
    const storageKey = getStorageKey(key);

    // Clear existing timeout for this key
    const existingTimeout = this.saveTimeout.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, JSON.stringify((this.state as any)[key]));
        } catch (e) {
          console.warn(`Failed to save UI state key "${key}":`, e);
        }
      }
      this.saveTimeout.delete(key);
    }, 300); // Debounce saves to 300ms

    this.saveTimeout.set(key, timeout);
  }

  /**
   * Save state to localStorage immediately (no debounce)
   */
  private saveImmediate(): void {
    if (typeof window !== 'undefined') {
      for (const key of Object.keys(this.state) as Array<keyof UIState>) {
        const storageKey = getStorageKey(key);
        try {
          localStorage.setItem(storageKey, JSON.stringify(this.state[key]));
        } catch (e) {
          console.warn(`Failed to save UI state key "${key}":`, e);
        }
      }
    }
    // Clear all pending timeouts
    for (const timeout of this.saveTimeout.values()) {
      clearTimeout(timeout);
    }
    this.saveTimeout.clear();
  }

  /**
   * Get current state
   */
  getState(): UIState {
    return { ...this.state };
  }

  /**
   * Update state (partial update)
   */
  setState(updates: Partial<UIState>, immediate = false): void {
    this.state = { ...this.state, ...updates };

    if (immediate) {
      this.saveImmediate();
    } else {
      // Save only the updated keys
      for (const key of Object.keys(updates) as Array<keyof UIState>) {
        this.saveKey(key);
      }
    }
    this.notifyListeners();
  }

  /**
   * Reset state to defaults
   */
  reset(): void {
    this.state = { ...DEFAULT_STATE };
    this.saveImmediate();
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: UIState) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('Error in UI state listener:', e);
      }
    });
  }
}

// ==================== Singleton Instance ====================

let storageInstance: UIStateStorage | null = null;

/**
 * Get the singleton UIStateStorage instance
 */
export function getUIStateStorage(): UIStateStorage {
  if (!storageInstance) {
    storageInstance = new UIStateStorage();
  }
  return storageInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetUIStateStorage(): void {
  if (storageInstance) {
    storageInstance.reset();
  }
  storageInstance = null;
}

// ==================== Convenience Hooks ====================

/**
 * Hook to access and persist sidebar state
 */
export function useSidebarState() {
  const storage = getUIStateStorage();

  return {
    get: () => ({
      width: storage.getState().sidebarWidth,
      isCollapsed: storage.getState().isSidebarCollapsed,
    }),
    setWidth: (width: number) => storage.setState({ sidebarWidth: width }),
    toggleCollapsed: () => storage.setState({
      isSidebarCollapsed: !storage.getState().isSidebarCollapsed,
    }),
    subscribe: (callback: (width: number, isCollapsed: boolean) => void) => {
      return storage.subscribe((state) => {
        callback(state.sidebarWidth, state.isSidebarCollapsed);
      });
    },
  };
}

/**
 * Hook to access and persist active tab state
 */
export function useActiveTabState() {
  const storage = getUIStateStorage();

  return {
    get: () => storage.getState().activeTab,
    set: (tab: 'sessions' | 'files' | 'activity') => storage.setState({ activeTab: tab }),
    subscribe: (callback: (tab: 'sessions' | 'files' | 'activity') => void) => {
      return storage.subscribe((state) => {
        callback(state.activeTab);
      });
    },
  };
}

/**
 * Hook to access and persist current session ID
 */
export function useCurrentSessionState() {
  const storage = getUIStateStorage();

  return {
    get: () => storage.getState().currentSessionId,
    set: (sessionId: string | null) => storage.setState({ currentSessionId: sessionId }),
    subscribe: (callback: (sessionId: string | null) => void) => {
      return storage.subscribe((state) => {
        callback(state.currentSessionId);
      });
    },
  };
}

/**
 * Hook to access and persist file tree state
 */
export function useFileTreeState() {
  const storage = getUIStateStorage();

  return {
    get: () => ({
      rootPath: storage.getState().fileTreeRootPath,
      expandedPaths: new Set(storage.getState().fileTreeExpandedPaths),
      selectedPath: storage.getState().fileTreeSelectedPath,
    }),
    setRootPath: (path: string | null) => storage.setState({ fileTreeRootPath: path }),
    setExpandedPaths: (paths: Set<string> | string[]) => {
      const pathArray = Array.isArray(paths) ? paths : Array.from(paths);
      storage.setState({ fileTreeExpandedPaths: pathArray });
    },
    setSelectedPath: (path: string | null) => storage.setState({ fileTreeSelectedPath: path }),
    subscribe: (callback: (state: {
      rootPath: string | null;
      expandedPaths: Set<string>;
      selectedPath: string | null;
    }) => void) => {
      return storage.subscribe((state) => {
        callback({
          rootPath: state.fileTreeRootPath,
          expandedPaths: new Set(state.fileTreeExpandedPaths),
          selectedPath: state.fileTreeSelectedPath,
        });
      });
    },
  };
}

/**
 * Hook to access and persist onboarding state
 */
export function useOnboardingState() {
  const storage = getUIStateStorage();

  return {
    get: () => storage.getState().hasCompletedOnboarding,
    setCompleted: () => storage.setState({ hasCompletedOnboarding: true }, true), // Immediate save for onboarding
    reset: () => storage.setState({ hasCompletedOnboarding: false }),
    subscribe: (callback: (hasCompleted: boolean) => void) => {
      return storage.subscribe((state) => {
        callback(state.hasCompletedOnboarding);
      });
    },
  };
}

/**
 * Hook to access and persist model preference
 */
export function useModelPreference() {
  const storage = getUIStateStorage();

  return {
    get: () => storage.getState().selectedModel,
    set: (model: ModelId, immediate = false) => storage.setState({ selectedModel: model }, immediate),
    subscribe: (callback: (model: ModelId) => void) => {
      return storage.subscribe((state) => {
        callback(state.selectedModel);
      });
    },
  };
}

/**
 * Hook to access and persist theme preference
 */
export function useThemePreference() {
  const storage = getUIStateStorage();

  return {
    get: () => storage.getState().theme,
    set: (theme: Theme, immediate = false) => storage.setState({ theme }, immediate),
    subscribe: (callback: (theme: Theme) => void) => {
      return storage.subscribe((state) => {
        callback(state.theme);
      });
    },
  };
}

/**
 * Hook to access and persist font size preference
 */
export function useFontSizePreference() {
  const storage = getUIStateStorage();

  return {
    get: () => storage.getState().fontSize,
    set: (fontSize: FontSize, immediate = false) => storage.setState({ fontSize }, immediate),
    subscribe: (callback: (fontSize: FontSize) => void) => {
      return storage.subscribe((state) => {
        callback(state.fontSize);
      });
    },
  };
}

/**
 * Hook to access and persist stream responses preference
 */
export function useStreamResponsesPreference() {
  const storage = getUIStateStorage();

  return {
    get: () => storage.getState().streamResponses,
    set: (streamResponses: boolean, immediate = false) => storage.setState({ streamResponses }, immediate),
    subscribe: (callback: (streamResponses: boolean) => void) => {
      return storage.subscribe((state) => {
        callback(state.streamResponses);
      });
    },
  };
}

/**
 * Hook to access and persist show token usage preference
 */
export function useShowTokenUsagePreference() {
  const storage = getUIStateStorage();

  return {
    get: () => storage.getState().showTokenUsage,
    set: (showTokenUsage: boolean, immediate = false) => storage.setState({ showTokenUsage }, immediate),
    subscribe: (callback: (showTokenUsage: boolean) => void) => {
      return storage.subscribe((state) => {
        callback(state.showTokenUsage);
      });
    },
  };
}

/**
 * Hook to access and persist selected system prompt template
 */
export function useSystemPromptPreference() {
  const storage = getUIStateStorage();

  return {
    get: () => storage.getState().selectedSystemPromptId,
    set: (selectedSystemPromptId: string | null, immediate = false) => storage.setState({ selectedSystemPromptId }, immediate),
    subscribe: (callback: (selectedSystemPromptId: string | null) => void) => {
      return storage.subscribe((state) => {
        callback(state.selectedSystemPromptId);
      });
    },
  };
}

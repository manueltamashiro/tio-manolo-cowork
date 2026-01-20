'use client';

/**
 * Theme Context - Provides theme management with light/dark/system modes
 * Handles theme persistence and system preference detection
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useThemePreference, type Theme } from '../storage/ui-state';

// Re-export Theme for convenience
export type { Theme } from '../storage/ui-state';

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  // Current theme setting (user preference)
  theme: Theme;
  // Actual resolved theme (after applying system preference)
  resolvedTheme: ResolvedTheme;
  // Set theme preference
  setTheme: (theme: Theme) => void;
  // Toggle between light and dark (ignoring system)
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ==================== Helper Functions ====================+

/**
 * Get the system theme preference
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolve theme from preference and system setting
 */
function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

// ==================== Provider ====================

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themePreference = useThemePreference();
  const [theme, setThemeState] = useState<Theme>(() => themePreference.get());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));
  const [isClient, setIsClient] = useState(false);

  // Update theme when preference changes
  useEffect(() => {
    const unsubscribe = themePreference.subscribe((newTheme) => {
      setThemeState(newTheme);
    });
    return unsubscribe;
  }, [themePreference]);

  // Listen for system theme changes when using system preference
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme === 'system') {
        setResolvedTheme(getSystemTheme());
      }
    };

    // Add listener
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  // Update resolved theme when theme preference changes
  useEffect(() => {
    setResolvedTheme(resolveTheme(theme));
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    if (!isClient) {
      setIsClient(true);
      return;
    }

    const root = document.documentElement;
    const body = document.body;

    // Remove both classes first
    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');

    // Add the current theme class
    root.classList.add(resolvedTheme);
    body.classList.add(resolvedTheme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        resolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff'
      );
    }
  }, [resolvedTheme, isClient]);

  const setTheme = useCallback((newTheme: Theme) => {
    themePreference.set(newTheme, true);
  }, [themePreference]);

  const toggleTheme = useCallback(() => {
    // Toggle between light and dark, ignoring system
    const newTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ==================== Hook ====================

/**
 * Hook to access the theme context
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// ==================== Server-Side Helper ====================

/**
 * Get the initial theme script to prevent flash of unstyled content
 * This should be placed in the head of the document
 */
export function getThemeScript(): string {
  return `
    (function() {
      function getPreference() {
        try {
          const stored = localStorage.getItem('tio_manolo_ui_state');
          if (stored) {
            const parsed = JSON.parse(stored);
            return parsed.theme || 'system';
          }
        } catch (e) {}
        return 'system';
      }

      function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      function resolveTheme(theme) {
        return theme === 'system' ? getSystemTheme() : theme;
      }

      const theme = getPreference();
      const resolved = resolveTheme(theme);

      document.documentElement.classList.add(resolved);
      document.body.classList.add(resolved);

      // Set initial theme-color
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#ffffff');
      }
    })();
  `.replace(/\s+/g, ' ').trim();
}

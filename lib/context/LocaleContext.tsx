"use client";

/**
 * Locale Context Provider
 * Manages the current language/locale for internationalization
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Locale, defaultLocale, localeNames, localeFlags } from '@/lib/i18n/config';
import { getTranslation, getTranslationWithParams, getMessages, formatRelativeTime, pluralize, type Messages } from '@/lib/i18n/client';

// Re-export Locale type for convenience
export type { Locale } from '@/lib/i18n/config';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  messages: Messages;
  localeNames: typeof localeNames;
  localeFlags: typeof localeFlags;
  formatRelativeTime: (timestamp: number) => string;
  pluralize: (key: string, count: number, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const STORAGE_KEY = 'tio_manolo_locale';

interface LocaleProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? defaultLocale);
  const [messages, setMessages] = useState<Messages>(getMessages(initialLocale ?? defaultLocale));

  // Load saved locale preference on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'en' || saved === 'es')) {
        setLocaleState(saved as Locale);
        setMessages(getMessages(saved as Locale));
      }
    } catch (e) {
      console.warn('Failed to load locale preference:', e);
    }
  }, []);

  // Update HTML lang attribute when locale changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setMessages(getMessages(newLocale));

    // Save to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, newLocale);
      } catch (e) {
        console.warn('Failed to save locale preference:', e);
      }
    }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    return getTranslationWithParams(locale, key, params);
  }, [locale]);

  const formatRelative = useCallback((timestamp: number) => {
    return formatRelativeTime(locale, timestamp);
  }, [locale]);

  const plural = useCallback((key: string, count: number, params?: Record<string, string | number>) => {
    return pluralize(locale, key, count, params);
  }, [locale]);

  const value: LocaleContextValue = {
    locale,
    setLocale,
    t,
    messages,
    localeNames,
    localeFlags,
    formatRelativeTime: formatRelative,
    pluralize: plural,
  };

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Hook to access the locale context
 * Throws an error if used outside of LocaleProvider
 */
export function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocaleContext must be used within a LocaleProvider');
  }
  return context;
}

/**
 * Hook to get translation function
 * Convenience wrapper around useLocaleContext
 */
export function useTranslations() {
  const { t, locale, messages, formatRelativeTime, pluralize } = useLocaleContext();
  return { t, locale, messages, formatRelativeTime, pluralize };
}

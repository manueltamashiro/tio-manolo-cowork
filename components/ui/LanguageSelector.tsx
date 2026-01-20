"use client";

/**
 * Language Selector Component
 * Allows users to switch between available languages
 */

import { useState, useRef, useEffect } from 'react';
import { useLocaleContext, Locale } from '@/lib/context/LocaleContext';
import { localeNames, localeFlags } from '@/lib/i18n/config';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'button';
  showLabel?: boolean;
}

export function LanguageSelector({ variant = 'dropdown', showLabel = false }: LanguageSelectorProps) {
  const { locale, setLocale, localeNames, localeFlags } = useLocaleContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (variant === 'button') {
    // Cycle through locales on button click
    const locales: Locale[] = ['en', 'es'];
    const currentIndex = locales.indexOf(locale);
    const nextLocale = locales[(currentIndex + 1) % locales.length];

    return (
      <button
        onClick={() => setLocale(nextLocale)}
        className="p-2 text-neutral-500 hover:text-neutral-300 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center gap-2"
        title={`Current: ${localeNames[locale]}. Click to switch.`}
        aria-label={`Language: ${localeNames[locale]}. Click to change.`}
      >
        <span className="text-lg" aria-hidden="true">
          {localeFlags[locale]}
        </span>
        {showLabel && (
          <span className="text-sm hidden md:inline">
            {localeNames[locale]}
          </span>
        )}
      </button>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-neutral-500 hover:text-neutral-300 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center gap-2"
        aria-label={`Language: ${localeNames[locale]}. Click to change.`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-lg" aria-hidden="true">
          {localeFlags[locale]}
        </span>
        {showLabel && (
          <span className="text-sm hidden md:inline">
            {localeNames[locale]}
          </span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[140px] z-50 animate-fade-in"
          role="listbox"
          aria-label="Language options"
        >
          {(Object.keys(localeNames) as Locale[]).map((localeKey) => (
            <button
              key={localeKey}
              onClick={() => {
                setLocale(localeKey);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                ${
                  locale === localeKey
                    ? 'bg-claude-primary-500/10 text-claude-primary-400'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }
              `}
              role="option"
              aria-selected={locale === localeKey}
            >
              <span className="text-lg" aria-hidden="true">
                {localeFlags[localeKey]}
              </span>
              <span>{localeNames[localeKey]}</span>
              {locale === localeKey && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="ml-auto"
                >
                  <path
                    d="M2 6L4.5 8.5L10 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

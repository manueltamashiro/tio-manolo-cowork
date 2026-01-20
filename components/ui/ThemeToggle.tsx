'use client';

import { useTheme, type Theme } from '@/lib/context/ThemeContext';
import { useTranslations } from '@/lib/context/LocaleContext';
import { useEffect, useState, useRef } from 'react';

interface ThemeOption {
  value: Theme;
  label: string;
  icon: React.ReactNode;
}

const sunIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M2.9 13.1l1.4-1.4M11.7 4.3l1.4-1.4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const moonIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13.5 8A5.5 5.5 0 0 0 8 2.5c-.4 0-.8 0-1.1.1A5.5 5.5 0 0 1 11 12.9c.4.1.8.1 1.1.1h1.4z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const systemIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2"
      y="3"
      width="9"
      height="7"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M5 10v3a1 1 0 001 1h7a1 1 0 001-1V6a1 1 0 00-1-1h-2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface ThemeToggleProps {
  variant?: 'dropdown' | 'button';
  showLabel?: boolean;
}

export function ThemeToggle({ variant = 'dropdown', showLabel = false }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get theme options dynamically based on translations
  const themeOptions: ThemeOption[] = [
    { value: 'system', label: t('theme.themeOptions.system'), icon: systemIcon },
    { value: 'dark', label: t('theme.themeOptions.dark'), icon: moonIcon },
    { value: 'light', label: t('theme.themeOptions.light'), icon: sunIcon },
  ];

  // Get current icon based on resolved theme
  const getCurrentIcon = () => {
    if (theme === 'system') {
      return systemIcon;
    }
    return theme === 'dark' ? moonIcon : sunIcon;
  };

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
    const targetTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    return (
      <button
        onClick={() => {
          // Toggle between light and dark when in button mode
          const newTheme: Theme = targetTheme as Theme;
          setTheme(newTheme);
        }}
        className="p-2 text-neutral-500 hover:text-neutral-300 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label={t('theme.switchTo', { theme: targetTheme })}
        title={t('theme.currentTheme', { theme: resolvedTheme })}
      >
        {getCurrentIcon()}
      </button>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-neutral-500 hover:text-neutral-300 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center gap-2"
        aria-label={`${t('theme.themeOptions')}: ${theme}.`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {getCurrentIcon()}
        {showLabel && <span className="text-sm hidden md:inline">{theme}</span>}
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
          aria-label={t('theme.themeOptions')}
        >
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setTheme(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                ${
                  theme === option.value
                    ? 'bg-claude-primary-500/10 text-claude-primary-400'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }
              `}
              role="option"
              aria-selected={theme === option.value}
            >
              <span className="flex-shrink-0">{option.icon}</span>
              <span>{option.label}</span>
              {theme === option.value && (
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

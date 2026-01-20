/**
 * Client-side internationalization utilities
 * Provides translation functions for use in client components
 */

import { Locale } from './config';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';

const messages = {
  en: enMessages,
  es: esMessages,
} as const;

export type Messages = typeof enMessages;

/**
 * Get translated message by key path
 * Supports nested keys like 'chat.sendMessage'
 */
export function getTranslation(locale: Locale, key: string): string {
  const keys = key.split('.');
  let value: any = messages[locale];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English if translation not found
      value = messages.en;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return key; // Return key if not found
        }
      }
      break;
    }
  }

  return typeof value === 'string' ? value : key;
}

/**
 * Get translated message with parameters
 * Supports simple variable interpolation like {count}
 */
export function getTranslationWithParams(
  locale: Locale,
  key: string,
  params: Record<string, string | number> = {}
): string {
  let translation = getTranslation(locale, key);

  // Replace {param} placeholders with actual values
  for (const [param, value] of Object.entries(params)) {
    translation = translation.replace(
      new RegExp(`\\{${param}\\}`, 'g'),
      String(value)
    );
  }

  return translation;
}

/**
 * Get all messages for a locale
 */
export function getMessages(locale: Locale): Messages {
  return messages[locale];
}

/**
 * Format a relative timestamp
 */
export function formatRelativeTime(locale: Locale, timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  // Less than a minute
  if (diff < 60 * 1000) {
    return getTranslation(locale, 'time.justNow');
  }

  // Less than an hour
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return getTranslationWithParams(locale, 'time.minutesAgo', { m: minutes });
  }

  // Less than a day
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return getTranslationWithParams(locale, 'time.hoursAgo', { h: hours });
  }

  // Less than a week
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return getTranslationWithParams(locale, 'time.daysAgo', { d: days });
  }

  // Format as date
  const date = new Date(timestamp);
  const localeCode = locale === 'es' ? 'es-ES' : 'en-US';
  return date.toLocaleDateString(localeCode, { month: 'short', day: 'numeric' });
}

/**
 * Pluralization helper for English and Spanish
 */
export function pluralize(
  locale: Locale,
  key: string,
  count: number,
  params: Record<string, string | number> = {}
): string {
  const fullKey = `${key}.${count === 1 ? 'one' : 'other'}`;
  return getTranslationWithParams(locale, fullKey, { ...params, count });
}

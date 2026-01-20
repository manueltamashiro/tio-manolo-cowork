/**
 * Encryption module with backward compatibility.
 *
 * This module provides encryption functions that maintain compatibility with
 * existing encrypted data while also supporting the new secure encryption.
 *
 * For new data, prefer using the secure encryption from secure-encryption.ts.
 */

import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY_PREFIX = 'tio-manolo-';

/**
 * Derives a consistent encryption key from a machine-specific identifier.
 * In a browser environment, this uses available identifiers.
 * In Electron, this could use machine-specific IDs for better security.
 *
 * @deprecated For new implementations, use secure-encryption.ts instead
 */
function getEncryptionKey(): string {
  // Try to get a consistent machine-specific identifier
  let identifier = '';

  if (typeof window !== 'undefined') {
    try {
      // In browser/Electron renderer, use a combination of available identifiers
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Tio Manolo', 2, 2);
        identifier += canvas.toDataURL() || '';
      }
    } catch {
      // Canvas operations may fail in some test environments
      // Fall through to use navigator.userAgent
    }
  }

  // Add user agent as additional entropy
  identifier += typeof navigator !== 'undefined' ? navigator.userAgent : '';

  // Fallback to a static key if no identifier available (not ideal, but prevents crashes)
  if (!identifier) {
    identifier = 'default-tio-manolo-key';
  }

  return ENCRYPTION_KEY_PREFIX + identifier;
}

/**
 * Encrypts a plaintext string using AES encryption.
 * @param plaintext - The string to encrypt
 * @returns The encrypted ciphertext (base64 encoded)
 * @deprecated For new implementations, use encryptSecure from secure-encryption.ts instead
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  const key = getEncryptionKey();
  const encrypted = CryptoJS.AES.encrypt(plaintext, key);
  return encrypted.toString();
}

/**
 * Decrypts a ciphertext string that was encrypted with the encrypt function.
 * @param ciphertext - The encrypted string (base64 encoded)
 * @returns The decrypted plaintext
 * @throws Error if decryption fails
 * @deprecated For new implementations, use decryptSecure from secure-encryption.ts instead
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    throw new Error('Cannot decrypt empty string');
  }

  try {
    const key = getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      throw new Error('Decryption failed - invalid data or key');
    }

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates if a string could be a valid encrypted value.
 * This is a basic check and doesn't guarantee the value is decryptable.
 */
export function isValidEncryptedFormat(value: string): boolean {
  try {
    // Encrypted values should be base64-like
    return /^[A-Za-z0-9+/=]+$/.test(value) && value.length > 20;
  } catch {
    return false;
  }
}

// Re-export secure encryption functions for convenience
export {
  encryptSecure,
  decryptSecure,
  isValidEncryptedFormat as isValidSecureEncryptedFormat,
  generateSalt,
  hashValue,
} from './secure-encryption';


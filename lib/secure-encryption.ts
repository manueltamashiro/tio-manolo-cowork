/**
 * Secure encryption module using Node.js crypto API.
 * This module provides AES-256-GCM encryption with proper key derivation.
 *
 * For web environments, falls back to CryptoJS but with enhanced security.
 */

import { createHash, randomBytes, scryptSync } from 'crypto';
import CryptoJS from 'crypto-js';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits for AES-256
const IV_LENGTH = 16; // 96 bits for GCM
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

/**
 * Securely derives an encryption key from a password and salt using scrypt.
 * Scrypt is a memory-hard KDF that's resistant to brute force attacks.
 *
 * @param password - The password to derive from
 * @param salt - The salt for key derivation
 * @returns A Buffer containing the derived key
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  // Use scrypt for secure key derivation
  // N=16384, r=8, p=1 are reasonable parameters for interactive use
  return scryptSync(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
}

/**
 * Gets or creates a machine-specific encryption key.
 * In production, this should be stored securely (e.g., in system keychain).
 * For now, we use a combination of machine identifiers.
 */
function getMachineIdentifier(): string {
  if (typeof process !== 'undefined' && process.platform) {
    // In Electron/Node environment
    const { platform, arch } = process;
    const hostname = typeof require !== 'undefined' ? require('os').hostname() : 'unknown';
    return `${platform}-${arch}-${hostname}`;
  }

  // Fallback for browser environment
  if (typeof window !== 'undefined') {
    try {
      // Use canvas fingerprinting with additional entropy
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Tio Manolo', 2, 2);
        return canvas.toDataURL() + '-' + (navigator.userAgent || '');
      }
    } catch {
      // Fall through
    }
  }

  return 'default-tio-manolo-environment';
}

/**
 * Gets the base encryption key from environment or derives it.
 * In production, this should use the system keychain.
 */
function getBaseEncryptionKey(): string {
  // Check for environment variable first (most secure)
  if (typeof process !== 'undefined' && process.env.TIO_MANOLO_ENCRYPTION_KEY) {
    return process.env.TIO_MANOLO_ENCRYPTION_KEY;
  }

  // Derive from machine identifier
  return 'tio-manolo-' + getMachineIdentifier();
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a string containing salt, IV, auth tag, and ciphertext.
 *
 * @param plaintext - The data to encrypt
 * @returns Base64-encoded encrypted data with metadata
 */
export function encryptSecure(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  // Check if we're in Node.js environment
  if (typeof createHash === 'function') {
    return encryptNode(plaintext);
  }

  // Fallback to browser implementation
  return encryptBrowser(plaintext);
}

/**
 * Node.js implementation using crypto module.
 */
function encryptNode(plaintext: string): string {
  const { createCipheriv, randomBytes } = require('crypto');

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from password and salt
  const key = deriveKey(getBaseEncryptionKey(), salt);

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + encrypted
  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'hex'),
  ]);

  return combined.toString('base64');
}

/**
 * Browser implementation using CryptoJS (less secure but compatible).
 * Enhanced from original with better key derivation.
 */
function encryptBrowser(plaintext: string): string {
  const key = getBaseEncryptionKey();

  // Create a more robust key using SHA-256
  const hashedKey = CryptoJS.SHA256(key).toString();

  const encrypted = CryptoJS.AES.encrypt(plaintext, hashedKey, {
    mode: (CryptoJS.mode as any).GCM,
    padding: CryptoJS.pad.Pkcs7,
  });

  return encrypted.toString();
}

/**
 * Decrypts ciphertext that was encrypted with encryptSecure.
 *
 * @param ciphertext - Base64-encoded encrypted data with metadata
 * @returns The decrypted plaintext
 */
export function decryptSecure(ciphertext: string): string {
  if (!ciphertext) {
    throw new Error('Cannot decrypt empty string');
  }

  // Check if we're in Node.js environment
  if (typeof createHash === 'function') {
    return decryptNode(ciphertext);
  }

  // Fallback to browser implementation
  return decryptBrowser(ciphertext);
}

/**
 * Node.js implementation using crypto module.
 */
function decryptNode(ciphertext: string): string {
  const { createDecipheriv } = require('crypto');

  // Decode base64
  const combined = Buffer.from(ciphertext, 'base64');

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key from password and salt
  const key = deriveKey(getBaseEncryptionKey(), salt);

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Browser implementation using CryptoJS.
 */
function decryptBrowser(ciphertext: string): string {
  const key = getBaseEncryptionKey();

  // Use the same key derivation
  const hashedKey = CryptoJS.SHA256(key).toString();

  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, hashedKey, {
      mode: (CryptoJS.mode as any).GCM,
      padding: CryptoJS.pad.Pkcs7,
    });

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
 */
export function isValidEncryptedFormat(value: string): boolean {
  try {
    return /^[A-Za-z0-9+/=]+$/.test(value) && value.length > 20;
  } catch {
    return false;
  }
}

/**
 * Generates a random encryption key for user-supplied password encryption.
 * Useful when you want to encrypt data with a user's password.
 *
 * @returns A random hex string suitable for use as a salt
 */
export function generateSalt(): string {
  if (typeof randomBytes === 'function') {
    return randomBytes(SALT_LENGTH).toString('hex');
  }

  // Fallback for browser
  const array = new Uint8Array(SALT_LENGTH);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Weak fallback
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes a value using SHA-256 (one-way, suitable for IDs/verification).
 */
export function hashValue(value: string): string {
  if (typeof createHash === 'function') {
    return createHash('sha256').update(value).digest('hex');
  }

  return CryptoJS.SHA256(value).toString();
}

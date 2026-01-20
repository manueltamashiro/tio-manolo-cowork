"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.isValidEncryptedFormat = isValidEncryptedFormat;
const crypto_js_1 = __importDefault(require("crypto-js"));
const ENCRYPTION_KEY_PREFIX = 'tio-manolo-';
/**
 * Derives a consistent encryption key from a machine-specific identifier.
 * In a browser environment, this uses available identifiers.
 * In Electron, this could use machine-specific IDs for better security.
 */
function getEncryptionKey() {
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
        }
        catch {
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
 */
function encrypt(plaintext) {
    if (!plaintext) {
        throw new Error('Cannot encrypt empty string');
    }
    const key = getEncryptionKey();
    const encrypted = crypto_js_1.default.AES.encrypt(plaintext, key);
    return encrypted.toString();
}
/**
 * Decrypts a ciphertext string that was encrypted with the encrypt function.
 * @param ciphertext - The encrypted string (base64 encoded)
 * @returns The decrypted plaintext
 * @throws Error if decryption fails
 */
function decrypt(ciphertext) {
    if (!ciphertext) {
        throw new Error('Cannot decrypt empty string');
    }
    try {
        const key = getEncryptionKey();
        const bytes = crypto_js_1.default.AES.decrypt(ciphertext, key);
        const decrypted = bytes.toString(crypto_js_1.default.enc.Utf8);
        if (!decrypted) {
            throw new Error('Decryption failed - invalid data or key');
        }
        return decrypted;
    }
    catch (error) {
        throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Validates if a string could be a valid encrypted value.
 * This is a basic check and doesn't guarantee the value is decryptable.
 */
function isValidEncryptedFormat(value) {
    try {
        // Encrypted values should be base64-like
        return /^[A-Za-z0-9+/=]+$/.test(value) && value.length > 20;
    }
    catch {
        return false;
    }
}

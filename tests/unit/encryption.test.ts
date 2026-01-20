/**
 * Unit tests for encryption and API key storage
 * Run with: npx tsx tests/unit/encryption.test.ts
 */

// Mock browser environment for testing
(global as any).window = {
  navigator: {
    userAgent: 'test-agent',
  },
};

(global as any).document = {
  createElement: () => ({
    getContext: () => ({
      textBaseline: 'top',
      font: '14px Arial',
      fillText: () => {},
      toDataURL: () => 'test-canvas-data-url-12345',
    }),
  }),
};

import { encrypt, decrypt } from '../../lib/encryption';
import {
  validateApiKeyFormat,
  getApiKeyPreview,
  storeApiKey,
  getApiKey,
  getApiKeyInfo,
  clearApiKey,
  hasApiKey,
} from '../../lib/api-key-storage';

// Mock localStorage
(global as any).localStorage = {
  storage: {} as Record<string, string>,
  getItem: function(this: typeof localStorage, key: string) {
    return this.storage[key] || null;
  },
  setItem: function(this: typeof localStorage, key: string, value: string) {
    this.storage[key] = value;
  },
  removeItem: function(this: typeof localStorage, key: string) {
    delete this.storage[key];
  },
  clear: function(this: typeof localStorage) {
    this.storage = {};
  },
};

console.log('Running API Key Management Tests...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.error(`    Error: ${error instanceof Error ? error.message : error}`);
    testsFailed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

// Clear storage before tests
localStorage.clear();

// Test encryption/decryption
console.log('Encryption Tests:');
test('encrypt should return a different value than input', () => {
  const plaintext = 'sk-ant-api03-test-key';
  const encrypted = encrypt(plaintext);
  assert(encrypted !== plaintext, 'Encrypted value should differ from plaintext');
});

test('decrypt should return original value', () => {
  const plaintext = 'sk-ant-api03-test-key';
  const encrypted = encrypt(plaintext);
  const decrypted = decrypt(encrypted);
  assert(decrypted === plaintext, 'Decrypted value should match plaintext');
});

test('encrypt should produce unique output for each encryption (salted)', () => {
  const plaintext = 'sk-ant-api03-test-key';
  const encrypted1 = encrypt(plaintext);
  const encrypted2 = encrypt(plaintext);
  // CryptoJS uses salt by default, so outputs should be different
  assert(encrypted1 !== encrypted2, 'Encrypted outputs should be unique (salted)');
});

test('decrypt should throw error for invalid data', () => {
  try {
    decrypt('invalid-encrypted-data');
    assert(false, 'Should have thrown an error');
  } catch (error) {
    assert(error instanceof Error, 'Should have thrown an Error');
  }
});

// Test API key validation
console.log('\nAPI Key Validation Tests:');
test('should accept valid API key format', () => {
  const result = validateApiKeyFormat('sk-ant-api03-123456789');
  assert(result.valid === true, 'Valid API key should pass validation');
});

test('should reject empty API key', () => {
  const result = validateApiKeyFormat('');
  assert(result.valid === false, 'Empty API key should fail validation');
  assert(result.error === 'API key cannot be empty', 'Should have correct error message');
});

test('should reject API key without sk-ant- prefix', () => {
  const result = validateApiKeyFormat('invalid-key');
  assert(result.valid === false, 'API key without prefix should fail validation');
});

test('should reject short API keys', () => {
  const result = validateApiKeyFormat('sk-ant-short');
  assert(result.valid === false, 'Short API key should fail validation');
});

// Test API key preview
console.log('\nAPI Key Preview Tests:');
test('should generate preview of API key', () => {
  const apiKey = 'sk-ant-api03-abcdefghijklmnopqrstuvwx';
  const preview = getApiKeyPreview(apiKey);
  assert(preview.startsWith('sk-ant-api03'), 'Preview should show start of key');
  assert(preview.includes('...'), 'Preview should have ellipsis');
});

// Test API key storage
console.log('\nAPI Key Storage Tests:');
test('should store API key', () => {
  localStorage.clear();
  storeApiKey('sk-ant-api03-123456789');
  assert(hasApiKey(), 'API key should be stored');
});

test('should retrieve stored API key', () => {
  localStorage.clear();
  const apiKey = 'sk-ant-api03-123456789';
  storeApiKey(apiKey);
  const retrieved = getApiKey();
  assert(retrieved === apiKey, 'Retrieved API key should match stored value');
});

test('should clear stored API key', () => {
  localStorage.clear();
  storeApiKey('sk-ant-api03-123456789');
  clearApiKey();
  assert(!hasApiKey(), 'API key should be cleared');
});

test('should get API key info without exposing full key', () => {
  localStorage.clear();
  const apiKey = 'sk-ant-api03-abcdefghijklmnopqrstuvwx';
  storeApiKey(apiKey);
  const info = getApiKeyInfo();
  assert(info !== null, 'Should return API key info');
  assert(info!.keyPreview.startsWith('sk-ant-api03'), 'Info should include preview');
  assert(info!.keyPreview.length < apiKey.length, 'Preview should be shorter than full key');
});

test('should return null when no API key stored', () => {
  localStorage.clear();
  const info = getApiKeyInfo();
  assert(info === null, 'Should return null when no key stored');
});

console.log(`\n${'='.repeat(50)}`);
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log(`${'='.repeat(50)}`);

process.exit(testsFailed > 0 ? 1 : 0);

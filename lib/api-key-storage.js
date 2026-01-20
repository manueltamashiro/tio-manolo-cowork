"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApiKeyFormat = validateApiKeyFormat;
exports.getApiKeyPreview = getApiKeyPreview;
exports.storeApiKey = storeApiKey;
exports.getApiKey = getApiKey;
exports.getApiKeyInfo = getApiKeyInfo;
exports.clearApiKey = clearApiKey;
exports.hasApiKey = hasApiKey;
exports.validateApiKeyWithApi = validateApiKeyWithApi;
const encryption_1 = require("./encryption");
const STORAGE_KEY = 'tio-manolo-api-key';
/**
 * Validates an Anthropic API key format.
 * Anthropic API keys start with 'sk-ant-' followed by alphanumeric characters.
 */
function validateApiKeyFormat(apiKey) {
    if (!apiKey || apiKey.trim().length === 0) {
        return { valid: false, error: 'API key cannot be empty' };
    }
    const trimmedKey = apiKey.trim();
    // Anthropic API keys format: sk-ant-api03-...
    if (!trimmedKey.startsWith('sk-ant-')) {
        return { valid: false, error: 'Invalid API key format. Anthropic API keys start with "sk-ant-"' };
    }
    if (trimmedKey.length < 20) {
        return { valid: false, error: 'API key is too short' };
    }
    // Check for valid characters (alphanumeric, dashes, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedKey)) {
        return { valid: false, error: 'API key contains invalid characters' };
    }
    return { valid: true };
}
/**
 * Gets a preview of the API key (first few chars for identification).
 */
function getApiKeyPreview(apiKey) {
    if (!apiKey)
        return '';
    return `${apiKey.slice(0, 12)}...${apiKey.slice(-4)}`;
}
/**
 * Stores the API key encrypted in localStorage.
 * @throws Error if validation fails
 */
function storeApiKey(apiKey) {
    const validation = validateApiKeyFormat(apiKey);
    if (!validation.valid) {
        throw new Error(validation.error);
    }
    const trimmedKey = apiKey.trim();
    const encrypted = (0, encryption_1.encrypt)(trimmedKey);
    localStorage.setItem(STORAGE_KEY, encrypted);
}
/**
 * Retrieves and decrypts the API key from storage.
 * @returns The decrypted API key or null if not found
 */
function getApiKey() {
    try {
        const encrypted = localStorage.getItem(STORAGE_KEY);
        if (!encrypted) {
            return null;
        }
        return (0, encryption_1.decrypt)(encrypted);
    }
    catch {
        // If decryption fails, the storage might be corrupted
        // Clear the invalid data
        clearApiKey();
        return null;
    }
}
/**
 * Gets API key info without exposing the actual key.
 */
function getApiKeyInfo() {
    try {
        const encrypted = localStorage.getItem(STORAGE_KEY);
        if (!encrypted) {
            return null;
        }
        const decrypted = (0, encryption_1.decrypt)(encrypted);
        const validation = validateApiKeyFormat(decrypted);
        return {
            keyPreview: getApiKeyPreview(decrypted),
            isValid: validation.valid,
        };
    }
    catch {
        return null;
    }
}
/**
 * Clears the stored API key.
 */
function clearApiKey() {
    localStorage.removeItem(STORAGE_KEY);
}
/**
 * Checks if an API key is currently stored.
 */
function hasApiKey() {
    const encrypted = localStorage.getItem(STORAGE_KEY);
    return encrypted !== null && encrypted.length > 0;
}
/**
 * Validates an API key by making a test request to the Anthropic API.
 * This is optional - basic format validation is usually sufficient for storage.
 */
async function validateApiKeyWithApi(apiKey) {
    const formatValidation = validateApiKeyFormat(apiKey);
    if (!formatValidation.valid) {
        return formatValidation;
    }
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey.trim(),
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'test' }],
            }),
        });
        if (response.status === 401) {
            return { valid: false, error: 'Invalid API key' };
        }
        if (response.status === 429) {
            // Rate limited but key is valid
            return { valid: true };
        }
        if (response.ok) {
            return { valid: true };
        }
        return { valid: false, error: `API returned status ${response.status}` };
    }
    catch {
        // Network error - can't validate
        return { valid: true, error: 'Could not validate with API (network error)' };
    }
}

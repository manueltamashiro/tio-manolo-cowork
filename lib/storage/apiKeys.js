"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiKey = getApiKey;
exports.validateApiKeyFormat = validateApiKeyFormat;
exports.setApiKey = setApiKey;
exports.removeApiKey = removeApiKey;
exports.getApiKeyFromHeaders = getApiKeyFromHeaders;
const headers_1 = require("next/headers");
const API_KEY_COOKIE_NAME = "claude_api_key";
const API_KEY_HEADER = "x-api-key";
/**
 * Get the API key from either the request header or cookie
 */
async function getApiKey() {
    const cookieStore = await (0, headers_1.cookies)();
    // Check cookie first
    const cookieKey = cookieStore.get(API_KEY_COOKIE_NAME);
    if (cookieKey?.value) {
        return cookieKey.value;
    }
    return null;
}
/**
 * Validate an API key format (basic check for Anthropic API key format)
 */
function validateApiKeyFormat(apiKey) {
    // Anthropic API keys start with "sk-ant-" and are typically 40+ characters
    const anthropicKeyPattern = /^sk-ant-api[\w-]{40,}$/;
    return anthropicKeyPattern.test(apiKey);
}
/**
 * Set the API key in a secure cookie
 */
async function setApiKey(apiKey) {
    const cookieStore = await (0, headers_1.cookies)();
    cookieStore.set(API_KEY_COOKIE_NAME, apiKey, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: "/",
    });
}
/**
 * Remove the API key from cookies
 */
async function removeApiKey() {
    const cookieStore = await (0, headers_1.cookies)();
    cookieStore.delete(API_KEY_COOKIE_NAME);
}
/**
 * Get API key from request headers (for API routes)
 */
function getApiKeyFromHeaders(headers) {
    return headers.get(API_KEY_HEADER) || null;
}

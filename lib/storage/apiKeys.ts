import { cookies } from "next/headers";

const API_KEY_COOKIE_NAME = "claude_api_key";
const API_KEY_HEADER = "x-api-key";

/**
 * Get the API key from either the request header or cookie
 */
export async function getApiKey(): Promise<string | null> {
  const cookieStore = await cookies();

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
export function validateApiKeyFormat(apiKey: string): boolean {
  // Anthropic API keys start with "sk-ant-" and are typically 40+ characters
  const anthropicKeyPattern = /^sk-ant-api[\w-]{40,}$/;
  return anthropicKeyPattern.test(apiKey);
}

/**
 * Set the API key in a secure cookie
 */
export async function setApiKey(apiKey: string): Promise<void> {
  const cookieStore = await cookies();
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
export async function removeApiKey(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(API_KEY_COOKIE_NAME);
}

/**
 * Get API key from request headers (for API routes)
 */
export function getApiKeyFromHeaders(headers: Headers): string | null {
  return headers.get(API_KEY_HEADER) || null;
}

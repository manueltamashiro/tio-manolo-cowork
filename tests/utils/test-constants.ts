/**
 * Test constants for Playwright tests
 */

export const TEST_TIMEOUTS = {
  /** Default timeout for most operations */
  DEFAULT: 5000,
  /** Timeout for navigation operations */
  NAVIGATION: 15000,
  /** Timeout for API calls */
  API_CALL: 10000,
  /** Timeout for app startup */
  APP_STARTUP: 30000,
  /** Timeout for file operations */
  FILE_OPERATION: 10000,
} as const;

export const TEST_SELECTORS = {
  /** Main app container */
  APP_CONTAINER: "#app-root",
  /** Chat interface container */
  CHAT_INTERFACE: "[data-testid='chat-interface']",
  /** Message input */
  MESSAGE_INPUT: "#message-input",
  /** Send message button */
  SEND_BUTTON: "[data-testid='send-message']",
  /** API key input */
  API_KEY_INPUT: "#apiKey",
  /** Settings page */
  SETTINGS_PAGE: "/settings",
  /** Messages container */
  MESSAGES_CONTAINER: "[data-testid='messages']",
  /** Individual message */
  MESSAGE: "[data-testid='message']",
  /** Error display */
  ERROR_DISPLAY: "[data-testid='error']",
  /** Loading indicator */
  LOADING_INDICATOR: "[data-testid='loading']",
} as const;

export const TEST_DATA = {
  /** Valid test API key format */
  VALID_API_KEY: "sk-ant-api03-test-key-for-validation-12345",
  /** Invalid API key */
  INVALID_API_KEY: "invalid-key-format",
  /** Test message */
  TEST_MESSAGE: "Hello, this is a test message",
  /** Test user message */
  TEST_USER_MESSAGE: {
    role: "user" as const,
    content: "Test user message",
  },
  /** Test assistant message */
  TEST_ASSISTANT_MESSAGE: {
    role: "assistant" as const,
    content: "Test assistant response",
  },
} as const;

export const TEST_ERRORS = {
  /** API key required error */
  API_KEY_REQUIRED: "API key is required",
  /** Invalid API key format error */
  INVALID_API_KEY_FORMAT: "Invalid API key format",
  /** Network error */
  NETWORK_ERROR: "Network error",
  /** Validation error */
  VALIDATION_ERROR: "Validation error",
} as const;

export const LOCAL_STORAGE_KEYS = {
  /** API key storage key */
  API_KEY: "encrypted_api_key",
  /** Chat history key */
  CHAT_HISTORY: "chat_history",
  /** Settings key */
  SETTINGS: "app_settings",
} as const;

export const API_ENDPOINTS = {
  /** Chat API endpoint */
  CHAT: "/api/chat",
  /** API key validation endpoint */
  API_KEY_VALIDATE: "/api/api-key/validate",
  /** Health check endpoint */
  HEALTH: "/api/health",
} as const;

export const IPC_CHANNELS = {
  /** API key storage channel */
  API_KEY_STORAGE: "api-key:storage",
  /** Chat messages channel */
  CHAT_MESSAGE: "chat:message",
  /** Settings channel */
  SETTINGS: "settings:update",
  /** File operations channel */
  FILE_OPERATION: "file:operation",
  /** Window control channel */
  WINDOW_CONTROL: "window:control",
} as const;

export type TestTimeout = (typeof TEST_TIMEOUTS)[keyof typeof TEST_TIMEOUTS];
export type TestSelector = (typeof TEST_SELECTORS)[keyof typeof TEST_SELECTORS];
export type TestError = (typeof TEST_ERRORS)[keyof typeof TEST_ERRORS];
export type LocalStorageKey = (typeof LOCAL_STORAGE_KEYS)[keyof typeof LOCAL_STORAGE_KEYS];
export type ApiEndpoint = (typeof API_ENDPOINTS)[keyof typeof API_ENDPOINTS];
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

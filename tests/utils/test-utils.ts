import { Page, ElectronApplication } from "@playwright/test";
import {
  TEST_TIMEOUTS,
  LOCAL_STORAGE_KEYS,
  TEST_DATA,
  type TestTimeout,
} from "./test-constants";

/**
 * Clear all local storage
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Set an API key in local storage (for testing purposes)
 */
export async function setTestApiKey(page: Page, apiKey = TEST_DATA.VALID_API_KEY): Promise<void> {
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: LOCAL_STORAGE_KEYS.API_KEY, value: apiKey }
  );
}

/**
 * Get a value from local storage
 */
export async function getLocalStorageItem(
  page: Page,
  key: string
): Promise<string | null> {
  return await page.evaluate((k) => localStorage.getItem(k), key);
}

/**
 * Wait for a specific timeout
 */
export async function wait(ms: TestTimeout = TEST_TIMEOUTS.DEFAULT): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const delay = baseDelay * Math.pow(2, attempt);
      await wait(delay as TestTimeout);
    }
  }

  throw lastError || new Error("Operation failed after retries");
}

/**
 * Wait for an element to appear and be visible
 */
export async function waitForElementVisible(
  page: Page,
  selector: string,
  timeout = TEST_TIMEOUTS.DEFAULT
): Promise<void> {
  await page.waitForSelector(selector, { state: "visible", timeout });
}

/**
 * Wait for an element to be removed or hidden
 */
export async function waitForElementHidden(
  page: Page,
  selector: string,
  timeout = TEST_TIMEOUTS.DEFAULT
): Promise<void> {
  await page.waitForSelector(selector, { state: "hidden", timeout });
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  fullPage = true
): Promise<Buffer> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `test-results/screenshots/${name}-${timestamp}.png`;
  return await page.screenshot({ path, fullPage });
}

/**
 * Mock the Claude API response
 */
export function mockClaudeApiResponse(response: {
  content?: string;
  error?: string;
  status?: number;
}): { body: string; status: number } {
  const body = JSON.stringify({
    content: response.content || "This is a mocked response from Claude.",
    error: response.error,
  });

  return {
    body,
    status: response.status || 200,
  };
}

/**
 * Create a mock streaming response
 */
export function* createMockStreamResponse(chunks: string[]): Generator<string> {
  for (const chunk of chunks) {
    yield `data: ${JSON.stringify({ content: chunk })}\n\n`;
  }
  yield "data: [DONE]\n\n";
}

/**
 * Get console logs from the page
 */
export async function getConsoleLogs(page: Page): Promise<string[]> {
  const logs: string[] = [];

  page.on("console", (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Wait a bit to collect any pending logs
  await wait(100);

  return logs;
}

/**
 * Wait for console message containing text
 */
export async function waitForConsoleMessage(
  page: Page,
  text: string | RegExp,
  timeout = TEST_TIMEOUTS.DEFAULT
): Promise<void> {
  await page.waitForConsoleMessage(
    (msg) => typeof text === "string" ? msg.text().includes(text) : text.test(msg.text()),
    { timeout }
  );
}

/**
 * Check if an element exists in the DOM
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  return await page.evaluate((sel) => {
    return document.querySelector(sel) !== null;
  }, selector);
}

/**
 * Get element text content
 */
export async function getElementText(
  page: Page,
  selector: string
): Promise<string> {
  const element = await page.locator(selector);
  return (await element.textContent()) || "";
}

/**
 * Click element with wait
 */
export async function clickAndWait(
  page: Page,
  selector: string,
  waitForSelector?: string
): Promise<void> {
  await page.click(selector);
  if (waitForSelector) {
    await waitForElementVisible(page, waitForSelector);
  } else {
    await page.waitForLoadState("networkidle");
  }
}

/**
 * Fill input with clear
 */
export async function fillInput(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  await page.fill(selector, "");
  await page.fill(selector, value);
}

/**
 * Get Electron app version info
 */
export async function getAppInfo(electronApp: ElectronApplication): Promise<{
  name: string;
  version: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
}> {
  return await electronApp.evaluate(async ({ app, process }) => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    };
  });
}

/**
 * Mock an API route in the page
 */
export async function mockApiRoute(
  page: Page,
  path: string,
  responseData: unknown,
  status = 200
): Promise<void> {
  await page.route(
    (url) => url.pathname === path || url.href.includes(path),
    async (route) => {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(responseData),
      });
    }
  );
}

/**
 * Check if the app is running in Electron
 */
export async function isElectron(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return typeof window !== "undefined" && window.process?.type === "renderer";
  });
}

/**
 * Generate a random test ID
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a delay for testing animations/transitions
 */
export async function waitForTransition(
  page: Page,
  selector: string,
  timeout = TEST_TIMEOUTS.DEFAULT
): Promise<void> {
  await page.waitForSelector(selector, { state: "attached", timeout });
  await wait(300); // Wait for CSS transitions
}

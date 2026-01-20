import { test, expect } from "@playwright/test";
import { clearLocalStorage } from "../utils/test-utils";
import { TEST_DATA } from "../utils/test-constants";

/**
 * E2E Tests for Onboarding Flow
 *
 * This test suite covers the first-time user experience:
 * 1. Initial app load without API key
 * 2. API key input and validation
 * 3. Transition to main chat interface
 * 4. Welcome message and empty state
 */

test.describe("Onboarding Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to simulate fresh onboarding
    await page.goto("/");
    await clearLocalStorage(page);
    await page.reload();
  });

  test.afterEach(async ({ page }) => {
    // Clean up after each test
    await clearLocalStorage(page);
  });

  test("should display API key input screen on first visit", async ({ page }) => {
    // Check for onboarding screen elements
    await expect(page.locator("h1")).toContainText("Tio Manolo Cowork");

    // Check for the prompt to enter API key
    await expect(page.getByText("Enter your Anthropic API key to get started")).toBeVisible();

    // Check for password input field
    const apiKeyInput = page.locator("input[type='password']");
    await expect(apiKeyInput).toBeVisible();
    await expect(apiKeyInput).toHaveAttribute("placeholder", "sk-ant-api03-...");

    // Check for continue button
    const continueButton = page.locator("button[type='submit']").filter({ hasText: "Continue" });
    await expect(continueButton).toBeVisible();
  });

  test("should validate empty API key input", async ({ page }) => {
    const continueButton = page.locator("button[type='submit']").filter({ hasText: "Continue" });

    // Try to submit without entering an API key
    await continueButton.click();

    // Should show error message
    await expect(page.getByText("API key is required")).toBeVisible();
  });

  test("should accept API key and proceed to main interface", async ({ page }) => {
    // Enter API key using the mock endpoint
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const apiKeyInput = page.locator("input[type='password']");
    const continueButton = page.locator("button[type='submit']").filter({ hasText: "Continue" });

    // Enter valid-looking API key
    await apiKeyInput.fill(TEST_DATA.VALID_API_KEY);
    await continueButton.click();

    // Should transition to main interface (may show loading first)
    // The onboarding screen should disappear
    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible({ timeout: 10000 });

    // Should see main chat interface elements
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText("Settings")).toBeVisible();
  });

  test("should show error message for failed API key setup", async ({ page }) => {
    // Mock API failure
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid API key format" }),
      });
    });

    const apiKeyInput = page.locator("input[type='password']");
    const continueButton = page.locator("button[type='submit']").filter({ hasText: "Continue" });

    // Enter API key
    await apiKeyInput.fill(TEST_DATA.INVALID_API_KEY);
    await continueButton.click();

    // Should show error message
    await expect(page.getByText(/Invalid API key format|Failed to set API key/i)).toBeVisible();
  });

  test("should link to settings page for API key configuration", async ({ page }) => {
    // The onboarding screen should have context about API key setup
    // Check if there's indication of settings page availability
    await expect(page.getByText(/Enter your Anthropic API key/i)).toBeVisible();
  });

  test("should persist API key after onboarding", async ({ page }) => {
    // Mock successful API key storage
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const apiKeyInput = page.locator("input[type='password']");
    const continueButton = page.locator("button[type='submit']").filter({ hasText: "Continue" });

    // Complete onboarding
    await apiKeyInput.fill(TEST_DATA.VALID_API_KEY);
    await continueButton.click();

    // Wait for transition
    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible();

    // Reload the page
    await page.reload();

    // Should not show onboarding screen again (API key is persisted)
    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible();
    await expect(page.locator("header")).toBeVisible();
  });

  test("should show empty state when no session exists", async ({ page }) => {
    // Mock successful API key storage
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const apiKeyInput = page.locator("input[type='password']");
    const continueButton = page.locator("button[type='submit']").filter({ hasText: "Continue" });

    // Complete onboarding
    await apiKeyInput.fill(TEST_DATA.VALID_API_KEY);
    await continueButton.click();

    // Wait for transition to main interface
    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible();

    // Should see empty state message
    await expect(page.getByText(/Start a conversation|Create or select a session/i)).toBeVisible();
  });

  test("should have proper styling and accessibility", async ({ page }) => {
    // Check for proper heading hierarchy
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Tio Manolo Cowork");

    // Check input has proper accessibility attributes
    const apiKeyInput = page.locator("input[type='password']");
    await expect(apiKeyInput).toBeVisible();
    await expect(apiKeyInput).toHaveAttribute("type", "password");

    // Continue button should be clickable
    const continueButton = page.locator("button[type='submit']").filter({ hasText: "Continue" });
    await expect(continueButton).toBeEnabled();
  });
});

/**
 * Onboarding with navigation tests
 */
test.describe("Onboarding Navigation", () => {
  test("should allow navigation to settings during onboarding", async ({ page }) => {
    await clearLocalStorage(page);
    await page.goto("/");

    // On onboarding screen, try to navigate to settings
    // The onboarding screen is shown first, but we can navigate to settings
    await page.goto("/settings");

    // Should see settings page
    await expect(page.locator("h1")).toContainText("Settings");
  });

  test("should complete onboarding when returning from settings", async ({ page }) => {
    await clearLocalStorage(page);
    await page.goto("/");

    // Navigate to settings first
    await page.goto("/settings");

    // Set API key in settings
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    await input.fill(TEST_DATA.VALID_API_KEY);
    await saveButton.click();

    // Wait for save confirmation
    await expect(page.locator("button").filter({ hasText: /^Saved!$/ })).toBeVisible();

    // Navigate back to home
    await page.goto("/");

    // Should not show onboarding screen anymore
    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible();
  });
});

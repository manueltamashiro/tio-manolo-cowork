import { test, expect } from "@playwright/test";

/**
 * Temporary verification test for API Key Management feature
 *
 * This test verifies:
 * 1. Settings page loads correctly
 * 2. API key input field is present
 * 3. Show/hide password toggle works
 * 4. Validation button works
 * 5. Save functionality works
 * 6. Encrypted storage persists across page reloads
 * 7. Clear button works
 */

test.describe("API Key Management", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("/settings");
    await page.evaluate(() => localStorage.clear());
  });

  test.afterEach(async ({ page }) => {
    // Clean up after each test
    await page.evaluate(() => localStorage.clear());
  });

  test("should load settings page", async ({ page }) => {
    // Already on settings page from beforeEach
    // Check that the settings page loads
    await expect(page.locator("h1")).toContainText("Settings");
    await expect(page.locator("h2")).toContainText("API Configuration");
  });

  test("should have API key input field", async ({ page }) => {
    // Already on settings page from beforeEach
    // Check for input field
    const input = page.locator("#apiKey");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "password");
    await expect(input).toHaveAttribute("placeholder", "sk-ant-...");
  });

  test("should toggle password visibility", async ({ page }) => {
    // Already on settings page from beforeEach
    const input = page.locator("#apiKey");
    const toggleButton = page.locator("button[aria-label='Show API key']").or(
      page.locator("button[aria-label='Hide API key']")
    );

    // Initially should be password type
    await expect(input).toHaveAttribute("type", "password");

    // Click to show
    await toggleButton.first().click();
    await expect(input).toHaveAttribute("type", "text");

    // Click to hide
    await toggleButton.first().click();
    await expect(input).toHaveAttribute("type", "password");
  });

  test("should validate API key format", async ({ page }) => {
    // Already on settings page from beforeEach
    const input = page.locator("#apiKey");
    const validateButton = page.locator("button").filter({ hasText: /^Validate$/ });

    // Test invalid format
    await input.fill("invalid-key");
    await validateButton.click();

    // Wait for validation to complete
    await page.waitForTimeout(2000);

    // Should show validation error
    const validationMessage = page.getByText(/Invalid API key format/i);
    await expect(validationMessage).toBeVisible();
  });

  test("should save API key", async ({ page }) => {
    // Already on settings page from beforeEach
    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    // Enter a valid-looking API key
    const testApiKey = "sk-ant-api03-test-key-for-validation-12345";
    await input.fill(testApiKey);

    // Save
    await saveButton.click();

    // Should show saved message
    await expect(page.locator("button").filter({ hasText: /^Saved!$/ })).toBeVisible();

    // Should show the saved key info (using the monospace font class)
    await expect(page.locator(".font-mono")).toContainText("sk-ant-api03");
  });

  test("should clear stored API key", async ({ page }) => {
    // Already on settings page from beforeEach
    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    // Save an API key first
    const testApiKey = "sk-ant-api03-clear-test-key-12345";
    await input.fill(testApiKey);
    await saveButton.click();

    // Wait for save to complete
    await expect(page.locator("button").filter({ hasText: /^Saved!$/ })).toBeVisible();

    // Click clear button
    const clearButton = page.locator("button").filter({ hasText: "Clear" });
    await clearButton.click();

    // The saved key section should be gone
    await expect(page.locator("button").filter({ hasText: "Clear" })).not.toBeVisible();

    // Input should be empty
    await expect(input).toHaveValue("");
  });

  test("should show security notice", async ({ page }) => {
    // Already on settings page from beforeEach
    // Check for security notice (use exact selector for the heading)
    await expect(page.getByText("Security Notice")).toBeVisible();
    await expect(page.getByText(/encrypted using AES encryption/i)).toBeVisible();
  });

  test("should have link to Anthropic console", async ({ page }) => {
    // Already on settings page from beforeEach
    // Check for the link
    const link = page.locator("a[href='https://console.anthropic.com/']");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

// Separate test for persistence that doesn't clear on reload
test.describe("API Key Persistence", () => {
  test("should persist API key across page reloads", async ({ page }) => {
    // Start fresh - clear localStorage
    await page.goto("/settings");
    await page.evaluate(() => localStorage.clear());

    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    // Save an API key
    const testApiKey = "sk-ant-api03-persist-test-key-12345";
    await input.fill(testApiKey);
    await saveButton.click();

    // Wait for save to complete
    await expect(page.locator("button").filter({ hasText: /^Saved!$/ })).toBeVisible();

    // Reload the page (without clearing localStorage first)
    await page.reload();

    // The saved key should still be displayed (in the monospace element)
    await expect(page.locator(".font-mono")).toContainText("sk-ant-api03");

    // The clear button should be visible
    await expect(page.locator("button").filter({ hasText: "Clear" })).toBeVisible();

    // Clean up
    await page.evaluate(() => localStorage.clear());
  });
});

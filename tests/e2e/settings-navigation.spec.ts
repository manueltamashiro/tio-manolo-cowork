import { test, expect } from "@playwright/test";
import { clearLocalStorage } from "../utils/test-utils";
import { TEST_DATA } from "../utils/test-constants";

/**
 * E2E Tests for Settings Changes and Navigation
 *
 * This test suite covers:
 * 1. Navigating to settings from the main app
 * 2. API key updates while logged in
 * 3. Settings persistence
 * 4. Navigation back to chat from settings
 * 5. Settings changes taking effect immediately
 */

test.describe("Settings Navigation and Changes", () => {
  // Helper function to complete onboarding
  async function completeOnboarding(page: any) {
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const apiKeyInput = page.locator("input[type='password']");
    const continueButton = page.locator("button[type='submit']").filter({ hasText: "Continue" });

    await apiKeyInput.fill(TEST_DATA.VALID_API_KEY);
    await continueButton.click();

    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible({ timeout: 10000 });
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearLocalStorage(page);
    await page.reload();
  });

  test.afterEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test("should navigate to settings from main app", async ({ page }) => {
    // Complete onboarding first
    await completeOnboarding(page);

    // Mock sessions list
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [] }),
      });
    });

    // Click settings link in header
    const settingsLink = page.locator("a[href='/settings']");
    await settingsLink.click();

    // Should be on settings page
    await expect(page).toHaveURL("/settings");
    await expect(page.locator("h1")).toContainText("Settings");
  });

  test("should navigate back to chat from settings", async ({ page }) => {
    // Go directly to settings (skip onboarding)
    await page.goto("/settings");

    // Navigate back to home
    await page.goto("/");

    // Should complete onboarding first
    await completeOnboarding(page);

    // Should be on main chat page
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText("Settings")).toBeVisible();
  });

  test("should update API key from settings page", async ({ page }) => {
    await page.goto("/settings");

    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    // Mock API call
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // Save an API key
    await input.fill(TEST_DATA.VALID_API_KEY);
    await saveButton.click();

    // Should show saved confirmation
    await expect(page.locator("button").filter({ hasText: /^Saved!$/ })).toBeVisible();
  });

  test("should reflect API key changes across the app", async ({ page }) => {
    // Complete onboarding with first API key
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await completeOnboarding(page);

    // Navigate to settings
    await page.goto("/settings");

    // Update API key with a different one
    const newApiKey = "sk-ant-api03-new-key-54321";
    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    await input.fill(newApiKey);
    await saveButton.click();

    await expect(page.locator("button").filter({ hasText: /^Saved!$/ })).toBeVisible();

    // Go back to main app
    await page.goto("/");

    // Should not show onboarding (API key is still set)
    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible();
  });

  test("should show current API key preview in settings", async ({ page }) => {
    await page.goto("/settings");

    // Mock API key save
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    // Save an API key
    await input.fill(TEST_DATA.VALID_API_KEY);
    await saveButton.click();

    // Should show key preview (first few characters)
    await expect(page.locator(".font-mono")).toContainText("sk-ant-api03");
  });

  test("should clear API key and return to onboarding", async ({ page }) => {
    await page.goto("/settings");

    // Mock API calls
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    // Save an API key
    await input.fill(TEST_DATA.VALID_API_KEY);
    await saveButton.click();

    await expect(page.locator("button").filter({ hasText: /^Saved!$/ })).toBeVisible();

    // Clear the API key
    const clearButton = page.locator("button").filter({ hasText: "Clear" });
    await clearButton.click();

    // The saved key display should be gone
    await expect(page.locator("button").filter({ hasText: "Clear" })).not.toBeVisible();

    // Navigate to home - should show onboarding again
    await page.goto("/");

    await expect(page.getByText("Enter your Anthropic API key")).toBeVisible();
  });

  test("should show security notice in settings", async ({ page }) => {
    await page.goto("/settings");

    // Security notice should be visible
    await expect(page.getByText("Security Notice")).toBeVisible();
    await expect(page.getByText(/encrypted using AES encryption/i)).toBeVisible();
  });

  test("should have link to Anthropic console", async ({ page }) => {
    await page.goto("/settings");

    const link = page.locator("a[href='https://console.anthropic.com/']");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("should validate API key format before saving", async ({ page }) => {
    await page.goto("/settings");

    // Mock validation API
    await page.route("*/**/api/api-key/validate", async (route) => {
      const requestBody = await route.request().postData();
      const data = JSON.parse(requestBody || "{}");

      if (data.apiKey && !data.apiKey.startsWith("sk-ant-")) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Invalid API key format" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ valid: true }),
        });
      }
    });

    const input = page.locator("#apiKey");
    const validateButton = page.locator("button").filter({ hasText: /^Validate$/ });

    // Test with invalid key
    await input.fill("invalid-key-format");
    await validateButton.click();

    // Should show validation error
    await expect(page.getByText(/Invalid API key format/i)).toBeVisible({ timeout: 5000 });
  });

  test("should handle settings page errors gracefully", async ({ page }) => {
    await page.goto("/settings");

    // Mock API error
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    await input.fill(TEST_DATA.VALID_API_KEY);
    await saveButton.click();

    // Should show error indication (button text changes back)
    await expect(page.locator("button").filter({ hasText: "Save API Key" })).toBeVisible();
  });

  test("should toggle API key visibility", async ({ page }) => {
    await page.goto("/settings");

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

  test("should persist settings across browser sessions", async ({ page }) => {
    await page.goto("/settings");

    // Mock API save
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    // Save API key
    await input.fill(TEST_DATA.VALID_API_KEY);
    await saveButton.click();

    await expect(page.locator("button").filter({ hasText: /^Saved!$/ })).toBeVisible();

    // Close and reopen page (simulate browser restart by using a new context)
    const newPage = await page.context().newPage();
    await newPage.goto("/settings");

    // Should still show the saved key
    await expect(newPage.locator(".font-mono")).toContainText("sk-ant-api03");

    await newPage.close();
  });

  test("should show correct page title and heading", async ({ page }) => {
    await page.goto("/settings");

    // Check heading
    await expect(page.locator("h1")).toContainText("Settings");

    // Check subheading
    await expect(page.locator("h2")).toContainText("API Configuration");
  });

  test("should have proper accessibility attributes", async ({ page }) => {
    await page.goto("/settings");

    // Input should have proper label
    const input = page.locator("#apiKey");
    await expect(input).toHaveAttribute("type", "password");

    // Buttons should have accessible labels
    const toggleButton = page.locator("button[aria-label='Show API key']").or(
      page.locator("button[aria-label='Hide API key']")
    );
    await expect(toggleButton.first()).toBeVisible();
  });

  test("should navigate settings using browser back button", async ({ page }) => {
    // Complete onboarding
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await completeOnboarding(page);

    // Navigate to settings
    await page.goto("/settings");

    // Use browser back
    await page.goBack();

    // Should be back on home page
    await expect(page).toHaveURL("/");
  });
});

/**
 * Settings Integration Tests
 */
test.describe("Settings Integration with Chat", () => {
  // Helper function to complete onboarding
  async function completeOnboarding(page: any) {
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const apiKeyInput = page.locator("input[type='password']");
    const continueButton = page.locator("button[type='submit']").filter({ hasText: "Continue" });

    await apiKeyInput.fill(TEST_DATA.VALID_API_KEY);
    await continueButton.click();

    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible({ timeout: 10000 });
  }

  test("should allow updating API key during active session", async ({ page }) => {
    await page.goto("/");

    // Complete onboarding
    await page.route("*/**/api/api-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await completeOnboarding(page);

    // Create a session
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "session-test-" + Date.now(),
            title: "Test Session",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: [] }),
        });
      }
    });

    const newChatButton = page.getByText("New Chat");
    if (await newChatButton.isVisible()) {
      await newChatButton.click();
    }

    // Navigate to settings and update API key
    await page.goto("/settings");

    const input = page.locator("#apiKey");
    const saveButton = page.locator("button").filter({ hasText: "Save API Key" });

    await input.fill("sk-ant-api03-updated-key-98765");
    await saveButton.click();

    await expect(page.locator("button").filter({ hasText: /^Saved!$/ })).toBeVisible();

    // Navigate back - should still be able to use the app
    await page.goto("/");
    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible();
  });
});

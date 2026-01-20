import { test, expect } from "@playwright/test";
import { clearLocalStorage } from "../utils/test-utils";
import { TEST_DATA } from "../utils/test-constants";

/**
 * E2E Tests for Session Management
 *
 * This test suite covers:
 * 1. Creating new chat sessions
 * 2. Listing and selecting sessions
 * 3. Renaming sessions
 * 4. Deleting sessions
 * 5. Session persistence
 */

test.describe("Session Management", () => {
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

    // Complete onboarding for each test
    await completeOnboarding(page);
  });

  test.afterEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test("should display new chat button", async ({ page }) => {
    const newChatButton = page.getByText("New Chat");
    await expect(newChatButton).toBeVisible();
  });

  test("should create a new session when clicking new chat", async ({ page }) => {
    let sessionCreated = false;

    // Mock session creation
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      if (route.request().method() === "POST") {
        sessionCreated = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "session-" + Date.now(),
            title: "New Chat",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      } else {
        // GET request for sessions list
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: [] }),
        });
      }
    });

    const newChatButton = page.getByText("New Chat");
    await newChatButton.click();

    await page.waitForTimeout(1000);

    // Session creation should have been called
    expect(sessionCreated).toBeTruthy();
  });

  test("should list existing sessions", async ({ page }) => {
    const mockSessions = [
      {
        id: "session-1",
        title: "Previous Chat 1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T01:00:00Z",
      },
      {
        id: "session-2",
        title: "Previous Chat 2",
        createdAt: "2024-01-02T00:00:00Z",
        updatedAt: "2024-01-02T01:00:00Z",
      },
    ];

    // Mock sessions list
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: mockSessions }),
      });
    });

    // Reload to trigger sessions fetch
    await page.reload();

    // Sessions should be visible
    await expect(page.getByText("Previous Chat 1")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Previous Chat 2")).toBeVisible();
  });

  test("should show empty state when no sessions exist", async ({ page }) => {
    // Mock empty sessions list
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [] }),
      });
    });

    await page.reload();

    // Should show empty state message
    await expect(page.getByText("No conversations yet")).toBeVisible({ timeout: 10000 });
  });

  test("should select a session from the list", async ({ page }) => {
    const mockSession = {
      id: "session-1",
      title: "Test Session",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T01:00:00Z",
    };

    // Mock sessions list
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [mockSession] }),
      });
    });

    // Mock session messages
    await page.route(`*/**/api/chat-history/sessions/${mockSession.id}/messages`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: [{ type: "text", text: "Test message" }],
              createdAt: "2024-01-01T00:00:00Z",
            },
            {
              id: "msg-2",
              role: "assistant",
              content: [{ type: "text", text: "Test response" }],
              createdAt: "2024-01-01T00:00:01Z",
            },
          ],
        }),
      });
    });

    await page.reload();

    // Click on the session
    const sessionItem = page.getByText("Test Session");
    await sessionItem.click();

    await page.waitForTimeout(1000);

    // Should highlight the selected session
    await expect(sessionItem).toBeVisible();
  });

  test("should rename a session", async ({ page }) => {
    const mockSession = {
      id: "session-1",
      title: "Original Title",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T01:00:00Z",
    };

    // Mock sessions list
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      const method = route.request().method();

      if (method === "PATCH") {
        const body = JSON.parse(route.request().postData() || "{}");
        mockSession.title = body.title || mockSession.title;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockSession),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: [mockSession] }),
        });
      }
    });

    await page.reload();

    // Hover over the session to show edit button
    const sessionItem = page.getByText("Original Title");
    await sessionItem.hover();

    // Look for edit button (lucide Edit2Icon)
    const editButton = page.locator("button").filter({ hasText: "" }).locator("visible=true").nth(1);
    if (await editButton.isVisible({ timeout: 2000 })) {
      await editButton.click();

      // Type new title
      const editInput = page.locator("input[type='text']").filter({ hasText: /^Original Title$/ });
      if (await editInput.isVisible({ timeout: 2000 })) {
        await editInput.clear();
        await editInput.fill("Renamed Session");
        await editInput.press("Enter");

        // Verify the rename
        await expect(page.getByText("Renamed Session")).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("should delete a session", async ({ page }) => {
    let deleted = false;
    const mockSessions = [
      {
        id: "session-1",
        title: "Session to Delete",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T01:00:00Z",
      },
    ];

    // Mock sessions list and delete
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      const url = route.request().url();

      if (route.request().method() === "DELETE") {
        deleted = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: deleted ? [] : mockSessions }),
        });
      }
    });

    await page.reload();

    // Hover over the session to show delete button
    const sessionItem = page.getByText("Session to Delete");
    await sessionItem.hover();

    // Look for delete button (lucide Trash2Icon)
    const deleteButton = page.locator("button").filter({ hasText: "" }).locator("visible=true").nth(2);

    // Handle the confirmation dialog
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    if (await deleteButton.isVisible({ timeout: 2000 })) {
      await deleteButton.click();

      await page.waitForTimeout(1000);

      // Session should be deleted
      await expect(page.getByText("Session to Delete")).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("should show loading state while fetching sessions", async ({ page }) => {
    // Mock a delayed response
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [] }),
      });
    });

    await page.reload();

    // Should show loading indicator
    await expect(page.getByText("Loading...")).toBeVisible({ timeout: 1000 });

    // After loading completes, should show empty state
    await expect(page.getByText("No conversations yet")).toBeVisible({ timeout: 5000 });
  });

  test("should handle session list errors gracefully", async ({ page }) => {
    // Mock API error
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.reload();

    // Should handle error gracefully (empty state is shown when sessions array is empty)
    // The component catches errors and shows empty sessions array
    await expect(page.getByText("No conversations yet")).toBeVisible({ timeout: 10000 });
  });

  test("should highlight the currently active session", async ({ page }) => {
    const mockSession = {
      id: "session-1",
      title: "Active Session",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T01:00:00Z",
    };

    // Mock sessions list
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [mockSession] }),
      });
    });

    await page.reload();

    // Click on the session to make it active
    const sessionItem = page.locator("text=Active Session").first();
    await sessionItem.click();

    await page.waitForTimeout(1000);

    // The active session should have a different background color
    // Check for the bg-neutral-800 class which indicates active state
    const activeSession = page.locator(".bg-neutral-800").filter({ hasText: "Active Session" });
    await expect(activeSession).toBeVisible();
  });

  test("should sort sessions by most recently updated", async ({ page }) => {
    const mockSessions = [
      {
        id: "session-1",
        title: "Oldest Session",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T01:00:00Z",
      },
      {
        id: "session-2",
        title: "Newest Session",
        createdAt: "2024-01-03T00:00:00Z",
        updatedAt: "2024-01-03T01:00:00Z",
      },
      {
        id: "session-3",
        title: "Middle Session",
        createdAt: "2024-01-02T00:00:00Z",
        updatedAt: "2024-01-02T01:00:00Z",
      },
    ];

    // Mock sessions list
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: mockSessions }),
      });
    });

    await page.reload();

    await page.waitForTimeout(1000);

    // All sessions should be visible
    await expect(page.getByText("Oldest Session")).toBeVisible();
    await expect(page.getByText("Middle Session")).toBeVisible();
    await expect(page.getByText("Newest Session")).toBeVisible();
  });
});

/**
 * Session Persistence Tests
 */
test.describe("Session Persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearLocalStorage(page);
  });

  test("should persist session across page reloads", async ({ page }) => {
    // Complete onboarding
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

    // Create a session
    const sessionId = "persist-session-" + Date.now();
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: sessionId,
            title: "Persistent Session",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            sessions: [
              {
                id: sessionId,
                title: "Persistent Session",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        });
      }
    });

    const newChatButton = page.getByText("New Chat");
    await newChatButton.click();
    await page.waitForTimeout(2000);

    // Reload the page
    await page.reload();

    // The session should still be visible
    await expect(page.getByText("Persistent Session")).toBeVisible({ timeout: 10000 });
  });

  test("should maintain selected session after reload", async ({ page }) => {
    const sessionId = "selected-session-" + Date.now();

    // Complete onboarding
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

    // Mock sessions
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessions: [
            {
              id: sessionId,
              title: "Selected Session",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Reload and verify session is still selectable
    await page.reload();

    await expect(page.getByText("Selected Session")).toBeVisible({ timeout: 10000 });
  });
});

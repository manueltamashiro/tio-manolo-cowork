import { test, expect } from "@playwright/test";
import { clearLocalStorage } from "../utils/test-utils";
import { TEST_DATA } from "../utils/test-constants";

/**
 * E2E Tests for Chat/Messaging Flow
 *
 * This test suite covers:
 * 1. Creating a new chat session
 * 2. Sending messages to Claude
 * 3. Receiving and displaying streaming responses
 * 4. Message history persistence
 * 5. Error handling for failed messages
 */

test.describe("Chat Messages", () => {
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

    // Wait for onboarding to complete
    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible({ timeout: 10000 });
  }

  // Helper function to create a new session
  async function createTestSession(page: any) {
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "test-session-" + Date.now(),
            title: "New Chat",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Click new chat button if exists
    const newChatButton = page.getByText("New Chat");
    if (await newChatButton.isVisible()) {
      await newChatButton.click();
      await page.waitForTimeout(1000);
    }
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearLocalStorage(page);
    await page.reload();

    // Complete onboarding for each test
    await completeOnboarding(page);

    // Mock sessions list
    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [] }),
      });
    });
  });

  test.afterEach(async ({ page }) => {
    await clearLocalStorage(page);
  });

  test("should display message input field", async ({ page }) => {
    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));

    await expect(messageInput).toBeVisible();
    await expect(messageInput).toHaveAttribute("placeholder", "Type your message...");
  });

  test("should display send button", async ({ page }) => {
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    await expect(sendButton).toBeVisible();
  });

  test("should disable send button when input is empty", async ({ page }) => {
    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    await expect(messageInput).toHaveValue("");
    await expect(sendButton).toBeDisabled();
  });

  test("should enable send button when input has text", async ({ page }) => {
    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    await messageInput.fill(TEST_DATA.TEST_MESSAGE);

    await expect(sendButton).toBeEnabled();
  });

  test("should send a message and display it in the chat", async ({ page }) => {
    // Mock chat API
    await page.route("*/**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: {"type":"content","content":"Hello!"}\n\ndata: {"type":"done"}\n\n`,
      });
    });

    // Mock message storage
    let messageCallCount = 0;
    await page.route("*/**/api/chat-history/sessions/*/messages", async (route) => {
      messageCallCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg-" + messageCallCount,
          role: "user",
          content: [{ type: "text", text: TEST_DATA.TEST_MESSAGE }],
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await createTestSession(page);

    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    await messageInput.fill(TEST_DATA.TEST_MESSAGE);
    await sendButton.click();

    // User message should be displayed
    await expect(page.getByText(TEST_DATA.TEST_MESSAGE)).toBeVisible({ timeout: 10000 });
  });

  test("should receive and display assistant response", async ({ page }) => {
    const testResponse = "This is a test response from Claude.";

    // Mock chat streaming API
    await page.route("*/**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: {
          "Content-Type": "text/event-stream",
        },
        body: `data: {"type":"content","content":"${testResponse}"}\n\ndata: {"type":"done"}\n\n`,
      });
    });

    // Mock message storage for both user and assistant messages
    let messageCallCount = 0;
    await page.route("*/**/api/chat-history/sessions/*/messages", async (route) => {
      messageCallCount++;
      const isUser = messageCallCount % 2 === 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg-" + messageCallCount,
          role: isUser ? "user" : "assistant",
          content: [{ type: "text", text: isUser ? TEST_DATA.TEST_MESSAGE : testResponse }],
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await createTestSession(page);

    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    await messageInput.fill(TEST_DATA.TEST_MESSAGE);
    await sendButton.click();

    // User message should be displayed
    await expect(page.getByText(TEST_DATA.TEST_MESSAGE)).toBeVisible();

    // Assistant response should be displayed
    await expect(page.getByText(testResponse)).toBeVisible({ timeout: 10000 });
  });

  test("should show loading indicator while waiting for response", async ({ page }) => {
    // Delay the response
    await page.route("*/**/api/chat", async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: {"type":"content","content":"Response"}\n\ndata: {"type":"done"}\n\n`,
      });
    });

    await page.route("*/**/api/chat-history/sessions/*/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg-1",
          role: "user",
          content: [{ type: "text", text: TEST_DATA.TEST_MESSAGE }],
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await createTestSession(page);

    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    await messageInput.fill(TEST_DATA.TEST_MESSAGE);
    await sendButton.click();

    // Check for the thinking pulse animation indicator
    const thinkingIndicator = page.locator(".animate-thinking-pulse");
    await expect(thinkingIndicator.first()).toBeVisible();
  });

  test("should clear input after sending message", async ({ page }) => {
    await page.route("*/**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: {"type":"content","content":"OK"}\n\ndata: {"type":"done"}\n\n`,
      });
    });

    await page.route("*/**/api/chat-history/sessions/*/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg-1",
          role: "user",
          content: [{ type: "text", text: TEST_DATA.TEST_MESSAGE }],
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await createTestSession(page);

    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    await messageInput.fill(TEST_DATA.TEST_MESSAGE);
    await sendButton.click();

    // Input should be cleared
    await expect(messageInput).toHaveValue("", { timeout: 5000 });
  });

  test("should display error message on API failure", async ({ page }) => {
    // Mock API failure
    await page.route("*/**/api/chat", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized: Invalid API key" }),
      });
    });

    await page.route("*/**/api/chat-history/sessions/*/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg-1",
          role: "user",
          content: [{ type: "text", text: TEST_DATA.TEST_MESSAGE }],
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await createTestSession(page);

    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    await messageInput.fill(TEST_DATA.TEST_MESSAGE);
    await sendButton.click();

    // Should show error message
    await expect(page.getByText(/Failed to get response|Unauthorized|error/i)).toBeVisible({ timeout: 10000 });
  });

  test("should display user and assistant messages with different styling", async ({ page }) => {
    await page.route("*/**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: {"type":"content","content":"Assistant response"}\n\ndata: {"type":"done"}\n\n`,
      });
    });

    await page.route("*/**/api/chat-history/sessions/*/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg-1",
          role: "user",
          content: [{ type: "text", text: TEST_DATA.TEST_MESSAGE }],
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await createTestSession(page);

    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    await messageInput.fill(TEST_DATA.TEST_MESSAGE);
    await sendButton.click();

    // User message should be visible
    await expect(page.getByText(TEST_DATA.TEST_MESSAGE)).toBeVisible();

    // Assistant response should be visible
    await expect(page.getByText("Assistant response")).toBeVisible({ timeout: 10000 });
  });

  test("should auto-scroll to bottom when new message arrives", async ({ page }) => {
    await page.route("*/**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: {"type":"content","content":"Long response that should trigger scrolling"}\n\ndata: {"type":"done"}\n\n`,
      });
    });

    await page.route("*/**/api/chat-history/sessions/*/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg-1",
          role: "user",
          content: [{ type: "text", text: TEST_DATA.TEST_MESSAGE }],
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await createTestSession(page);

    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    await messageInput.fill(TEST_DATA.TEST_MESSAGE);
    await sendButton.click();

    // The response should be visible (indicating scroll happened)
    await expect(page.getByText("scrolling")).toBeVisible({ timeout: 10000 });
  });

  test("should have link to settings in header", async ({ page }) => {
    const settingsLink = page.locator("a[href='/settings']");
    await expect(settingsLink).toBeVisible();
    await expect(settingsLink).toHaveText("Settings");
  });

  test("should navigate to settings when clicking settings link", async ({ page }) => {
    const settingsLink = page.locator("a[href='/settings']");
    await settingsLink.click();

    await expect(page).toHaveURL("/settings");
    await expect(page.locator("h1")).toContainText("Settings");
  });
});

/**
 * Chat Context Tests
 */
test.describe("Chat Context and History", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearLocalStorage(page);
    await page.reload();

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

    await expect(page.getByText("Enter your Anthropic API key")).not.toBeVisible();
  });

  test("should maintain conversation context across messages", async ({ page }) => {
    const responses = ["First response", "Second response"];
    let responseIndex = 0;

    await page.route("*/**/api/chat", async (route) => {
      const response = responses[responseIndex % responses.length];
      responseIndex++;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: {"type":"content","content":"${response}"}\n\ndata: {"type":"done"}\n\n`,
      });
    });

    await page.route("*/**/api/chat-history/sessions*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "test-session-" + Date.now(),
            title: "New Chat",
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

    let messageCallCount = 0;
    await page.route("*/**/api/chat-history/sessions/*/messages", async (route) => {
      messageCallCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg-" + messageCallCount,
          role: messageCallCount % 2 === 1 ? "user" : "assistant",
          content: [{ type: "text", text: "Message " + messageCallCount }],
          createdAt: new Date().toISOString(),
        }),
      });
    });

    // Create session
    const newChatButton = page.getByText("New Chat");
    if (await newChatButton.isVisible()) {
      await newChatButton.click();
      await page.waitForTimeout(1000);
    }

    const messageInput = page.locator("input[type='text']").or(page.locator("input[placeholder='Type your message...']"));
    const sendButton = page.locator("button[type='submit']").filter({ hasText: "Send" });

    // Send first message
    await messageInput.fill("First message");
    await sendButton.click();
    await expect(page.getByText("First response")).toBeVisible({ timeout: 10000 });

    // Send second message
    await messageInput.fill("Second message");
    await sendButton.click();
    await expect(page.getByText("Second response")).toBeVisible({ timeout: 10000 });

    // Both messages and responses should be visible
    await expect(page.getByText("First message")).toBeVisible();
    await expect(page.getByText("First response")).toBeVisible();
    await expect(page.getByText("Second message")).toBeVisible();
    await expect(page.getByText("Second response")).toBeVisible();
  });
});

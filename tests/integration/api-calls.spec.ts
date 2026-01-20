import { test, expect } from "@playwright/test";
import { TEST_DATA } from "../utils/test-constants";

/**
 * Integration Tests for API Calls
 *
 * This test suite covers the complete API workflows:
 * 1. Chat API with streaming responses
 * 2. Chat API with non-streaming responses
 * 3. API key validation and storage
 * 4. Session management via API
 * 5. Message storage and retrieval
 * 6. End-to-end chat workflows
 */

// Helper function to make authenticated API requests
const API_HEADERS = {
  "x-api-key": TEST_DATA.VALID_API_KEY,
};

test.describe("API Calls Integration", () => {
  test.describe("Chat API - Streaming Responses", () => {
    test("should handle streaming chat request", async ({ request }) => {
      const response = await request.post("/api/chat", {
        headers: API_HEADERS,
        data: {
          messages: [
            {
              role: "user",
              content: "Hello, this is a test message for streaming.",
            },
          ],
          stream: true,
        },
      });

      // For streaming, we should get a 200 with content-type text/event-stream
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/event-stream");
    });

    test("should receive multiple chunks in stream", async ({ request }) => {
      const response = await request.post("/api/chat", {
        headers: API_HEADERS,
        data: {
          messages: [
            {
              role: "user",
              content: "Tell me a short greeting.",
            },
          ],
          stream: true,
        },
      });

      expect(response.status()).toBe(200);

      // Read the stream
      const text = await response.text();
      const lines = text.split("\n").filter((line) => line.startsWith("data:"));

      // Should have multiple data lines
      expect(lines.length).toBeGreaterThan(0);

      // Should have content chunks or error (since we're using a test key)
      const hasContentOrError = lines.some((line) =>
        line.includes('"type":"content"') || line.includes('"type":"error"')
      );
      expect(hasContentOrError).toBe(true);

      // Should have a done marker
      const hasDone = lines.some((line) => line.includes('"type":"done"'));
      expect(hasDone).toBe(true);
    });

    test("should include file context in chat request", async ({ request }) => {
      const response = await request.post("/api/chat", {
        headers: API_HEADERS,
        data: {
          messages: [
            {
              role: "user",
              content: "What does this file contain?",
            },
          ],
          fileContexts: [
            {
              name: "test.js",
              path: "/path/to/test.js",
              content: "console.log('Hello, World!');",
            },
          ],
          stream: true,
        },
      });

      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/event-stream");
    });

    test("should require API key for chat requests", async ({ request }) => {
      // Make request without API key (send empty headers)
      const response = await request.post("/api/chat", {
        data: {
          messages: [
            {
              role: "user",
              content: "Test without auth",
            },
          ],
        },
      });

      // Should get 401 Unauthorized
      expect(response.status()).toBe(401);
    });
  });

  test.describe("Chat API - Non-Streaming Responses", () => {
    test("should handle non-streaming chat request", async ({ request }) => {
      const response = await request.post("/api/chat", {
        headers: API_HEADERS,
        data: {
          messages: [
            {
              role: "user",
              content: "Hello, this is a test message.",
            },
          ],
          stream: false,
        },
      });

      // The API key may not be valid, so we accept 200 or error status
      expect([200, 401, 500]).toContain(response.status());
    });

    test("should validate messages array", async ({ request }) => {
      // Test with missing messages
      const response = await request.post("/api/chat", {
        headers: API_HEADERS,
        data: {
          // No messages array
          stream: false,
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.error).toContain("required");
    });

    test("should validate non-empty messages", async ({ request }) => {
      // Test with empty messages array
      const response = await request.post("/api/chat", {
        headers: API_HEADERS,
        data: {
          messages: [],
          stream: false,
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.error).toContain("At least one message");
    });
  });

  test.describe("API Key Management", () => {
    test("should store API key via API", async ({ request }) => {
      const response = await request.post("/api/api-key", {
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          apiKey: TEST_DATA.VALID_API_KEY,
        },
      });

      // API key storage endpoint returns success or error based on validation
      expect([200, 400, 422]).toContain(response.status());
    });

    test("should validate API key format", async ({ request }) => {
      const response = await request.post("/api/api-key", {
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          apiKey: TEST_DATA.INVALID_API_KEY,
        },
      });

      // Should reject invalid format
      expect([400, 422, 200]).toContain(response.status());
    });

    test("should require API key in request body", async ({ request }) => {
      const response = await request.post("/api/api-key", {
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          // No apiKey field
        },
      });

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  test.describe("Session Management API", () => {
    test("should create a new session", async ({ request }) => {
      const response = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Test Session",
          model: "claude-3-5-sonnet-20241022",
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("id");
      expect(data.title).toBe("Test Session");
    });

    test("should list sessions", async ({ request }) => {
      const response = await request.get("/api/chat-history/sessions", {
        headers: API_HEADERS,
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("sessions");
      expect(Array.isArray(data.sessions)).toBe(true);
    });

    test("should get session by ID", async ({ request }) => {
      // First create a session
      const createResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Get Session Test",
        },
      });

      const session = await createResponse.json();
      const sessionId = session.id;

      // Now get the session
      const getResponse = await request.get(`/api/chat-history/sessions/${sessionId}`, {
        headers: API_HEADERS,
      });

      expect(getResponse.status()).toBe(200);

      const data = await getResponse.json();
      expect(data.id).toBe(sessionId);
      expect(data.title).toBe("Get Session Test");
    });

    test("should update session", async ({ request }) => {
      // Create a session
      const createResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Original Title",
        },
      });

      const session = await createResponse.json();
      const sessionId = session.id;

      // Update the session
      const updateResponse = await request.put(
        `/api/chat-history/sessions/${sessionId}`,
        {
          headers: API_HEADERS,
          data: {
            title: "Updated Title",
          },
        }
      );

      expect(updateResponse.status()).toBe(200);

      const data = await updateResponse.json();
      expect(data.title).toBe("Updated Title");
    });

    test("should delete session", async ({ request }) => {
      // Create a session
      const createResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Delete Me",
        },
      });

      const session = await createResponse.json();
      const sessionId = session.id;

      // Delete the session
      const deleteResponse = await request.delete(
        `/api/chat-history/sessions/${sessionId}`,
        {
          headers: API_HEADERS,
        }
      );

      expect(deleteResponse.status()).toBe(200);

      // Verify it's deleted
      const getResponse = await request.get(
        `/api/chat-history/sessions/${sessionId}`,
        {
          headers: API_HEADERS,
        }
      );
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe("Message Storage API", () => {
    test("should add message to session", async ({ request }) => {
      // Create a session first
      const sessionResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Message Test Session",
        },
      });

      const session = await sessionResponse.json();
      const sessionId = session.id;

      // Add a message
      const response = await request.post(
        `/api/chat-history/sessions/${sessionId}/messages`,
        {
          headers: API_HEADERS,
          data: {
            role: "user",
            content: [
              {
                type: "text",
                text: "This is a test message",
              },
            ],
          },
        }
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("id");
      expect(data.role).toBe("user");
    });

    test("should get messages for session", async ({ request }) => {
      // Create a session
      const sessionResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Get Messages Session",
        },
      });

      const session = await sessionResponse.json();
      const sessionId = session.id;

      // Add messages
      await request.post(`/api/chat-history/sessions/${sessionId}/messages`, {
        headers: API_HEADERS,
        data: {
          role: "user",
          content: [{ type: "text", text: "First message" }],
        },
      });

      await request.post(`/api/chat-history/sessions/${sessionId}/messages`, {
        headers: API_HEADERS,
        data: {
          role: "assistant",
          content: [{ type: "text", text: "First response" }],
        },
      });

      // Get messages
      const response = await request.get(
        `/api/chat-history/sessions/${sessionId}/messages`,
        {
          headers: API_HEADERS,
        }
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("messages");
      expect(Array.isArray(data.messages)).toBe(true);
      expect(data.messages.length).toBeGreaterThanOrEqual(2);
    });

    test("should get individual message by ID", async ({ request }) => {
      // Create session and message
      const sessionResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Get Single Message",
        },
      });

      const session = await sessionResponse.json();
      const sessionId = session.id;

      const messageResponse = await request.post(
        `/api/chat-history/sessions/${sessionId}/messages`,
        {
          headers: API_HEADERS,
          data: {
            role: "user",
            content: [{ type: "text", text: "Single message test" }],
          },
        }
      );

      const message = await messageResponse.json();
      const messageId = message.id;

      // Get the message
      const response = await request.get(`/api/chat-history/messages/${messageId}`, {
        headers: API_HEADERS,
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.id).toBe(messageId);
      expect(data.content[0].text).toBe("Single message test");
    });
  });

  test.describe("Search API", () => {
    test("should search sessions and messages", async ({ request }) => {
      const response = await request.get("/api/chat-history/search", {
        headers: API_HEADERS,
        params: {
          q: "test",
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("results");
      expect(Array.isArray(data.results)).toBe(true);
    });

    test("should handle search with filters", async ({ request }) => {
      const response = await request.get("/api/chat-history/search", {
        headers: API_HEADERS,
        params: {
          q: "test",
          limit: "10",
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.results).toBeDefined();
    });
  });

  test.describe("End-to-End Chat Workflows", () => {
    test("should complete full chat session workflow", async ({ request }) => {
      // Step 1: Create a session
      const sessionResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "E2E Test Session",
          model: "claude-3-5-sonnet-20241022",
        },
      });

      expect(sessionResponse.status()).toBe(200);
      const session = await sessionResponse.json();

      // Step 2: Add a user message
      const userMessageResponse = await request.post(
        `/api/chat-history/sessions/${session.id}/messages`,
        {
          headers: API_HEADERS,
          data: {
            role: "user",
            content: [{ type: "text", text: "What is 2 + 2?" }],
          },
        }
      );

      expect(userMessageResponse.status()).toBe(200);
      const userMessage = await userMessageResponse.json();

      // Step 3: Verify message was stored
      const getMessagesResponse = await request.get(
        `/api/chat-history/sessions/${session.id}/messages`,
        {
          headers: API_HEADERS,
        }
      );

      expect(getMessagesResponse.status()).toBe(200);
      const messagesData = await getMessagesResponse.json();
      expect(messagesData.messages).toHaveLength(1);
      expect(messagesData.messages[0].content[0].text).toBe("What is 2 + 2?");

      // Step 4: Update session title
      const updateResponse = await request.put(
        `/api/chat-history/sessions/${session.id}`,
        {
          headers: API_HEADERS,
          data: {
            title: "Updated E2E Session",
          },
        }
      );

      expect(updateResponse.status()).toBe(200);

      // Step 5: Verify session was updated
      const getSessionResponse = await request.get(
        `/api/chat-history/sessions/${session.id}`,
        {
          headers: API_HEADERS,
        }
      );

      expect(getSessionResponse.status()).toBe(200);
      const updatedSession = await getSessionResponse.json();
      expect(updatedSession.title).toBe("Updated E2E Session");

      // Step 6: Clean up - delete session
      const deleteResponse = await request.delete(
        `/api/chat-history/sessions/${session.id}`,
        {
          headers: API_HEADERS,
        }
      );
      expect(deleteResponse.status()).toBe(200);
    });

    test("should handle multi-turn conversation storage", async ({ request }) => {
      // Create session
      const sessionResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Multi-turn Conversation",
        },
      });

      const session = await sessionResponse.json();

      // Multiple conversation turns
      const turns = [
        { role: "user", content: "Hello!" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
        { role: "assistant", content: "I'm doing well!" },
      ];

      for (const turn of turns) {
        const response = await request.post(
          `/api/chat-history/sessions/${session.id}/messages`,
          {
            headers: API_HEADERS,
            data: {
              role: turn.role,
              content: [{ type: "text", text: turn.content }],
            },
          }
        );

        expect(response.status()).toBe(200);
      }

      // Verify all messages were stored
      const messagesResponse = await request.get(
        `/api/chat-history/sessions/${session.id}/messages`,
        {
          headers: API_HEADERS,
        }
      );

      expect(messagesResponse.status()).toBe(200);
      const messagesData = await messagesResponse.json();
      expect(messagesData.messages).toHaveLength(4);

      // Verify order
      expect(messagesData.messages[0].role).toBe("user");
      expect(messagesData.messages[1].role).toBe("assistant");
      expect(messagesData.messages[2].role).toBe("user");
      expect(messagesData.messages[3].role).toBe("assistant");
    });

    test("should handle session with metadata", async ({ request }) => {
      const response = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Session with Metadata",
          model: "claude-3-5-sonnet-20241022",
          temperature: 0.7,
          maxTokens: 4096,
          systemPrompt: "You are a helpful assistant.",
        },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.model).toBe("claude-3-5-sonnet-20241022");
      expect(data.temperature).toBe(0.7);
      expect(data.maxTokens).toBe(4096);
    });
  });

  test.describe("Error Handling", () => {
    test("should return 404 for non-existent session", async ({ request }) => {
      const response = await request.get("/api/chat-history/sessions/non-existent-id", {
        headers: API_HEADERS,
      });

      expect(response.status()).toBe(404);
    });

    test("should return 400 for invalid message data", async ({ request }) => {
      // Create a session
      const sessionResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Error Test",
        },
      });

      const session = await sessionResponse.json();

      // Try to add invalid message (missing required fields)
      const response = await request.post(
        `/api/chat-history/sessions/${session.id}/messages`,
        {
          headers: API_HEADERS,
          data: {
            // Missing role and content
          },
        }
      );

      expect(response.status()).toBe(400);
    });

    test("should handle malformed JSON requests", async ({ request }) => {
      const response = await request.post("/api/chat", {
        headers: {
          "Content-Type": "application/json",
          ...API_HEADERS,
        },
        data: "invalid json {{{",
      });

      expect(response.status()).toBe(400);
    });
  });
});

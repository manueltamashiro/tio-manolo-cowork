import { test, expect } from "@playwright/test";
import { rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { TEST_DATA } from "../utils/test-constants";

/**
 * End-to-End Workflow Integration Tests
 *
 * This test suite covers complete user workflows that span
 * multiple subsystems:
 *
 * 1. Complete chat session with file operations
 * 2. Multi-turn conversation with context
 * 3. Workspace setup and file management
 * 4. Session persistence and retrieval
 * 5. Error recovery workflows
 */

const TEMP_WORKSPACE_DIR = join(process.cwd(), ".test-workspace");

// Helper function to make authenticated API requests
const API_HEADERS = {
  "x-api-key": TEST_DATA.VALID_API_KEY,
};

test.describe("End-to-End Workflows", () => {
  test.beforeAll(async () => {
    if (existsSync(TEMP_WORKSPACE_DIR)) {
      await rm(TEMP_WORKSPACE_DIR, { recursive: true, force: true });
    }
    await mkdir(TEMP_WORKSPACE_DIR, { recursive: true });
  });

  test.afterAll(async () => {
    if (existsSync(TEMP_WORKSPACE_DIR)) {
      await rm(TEMP_WORKSPACE_DIR, { recursive: true, force: true });
    }
  });

  test.describe("Complete Chat Session Workflow", () => {
    test("should create session, exchange messages, and close", async ({ request }) => {
      // Step 1: Create a new session
      const sessionResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Complete Chat Test",
          model: "claude-3-5-sonnet-20241022",
        },
      });

      expect(sessionResponse.status()).toBe(200);
      const session = await sessionResponse.json();
      const sessionId = session.id;

      // Step 2: Add user message
      const userMsgResponse = await request.post(
        `/api/chat-history/sessions/${sessionId}/messages`,
        {
          headers: API_HEADERS,
          data: {
            role: "user",
            content: [{ type: "text", text: "What is the capital of France?" }],
          },
        }
      );

      expect(userMsgResponse.status()).toBe(200);
      const userMessage = await userMsgResponse.json();

      // Step 3: Add assistant response
      const assistantMsgResponse = await request.post(
        `/api/chat-history/sessions/${sessionId}/messages`,
        {
          headers: API_HEADERS,
          data: {
            role: "assistant",
            content: [{ type: "text", text: "The capital of France is Paris." }],
          },
        }
      );

      expect(assistantMsgResponse.status()).toBe(200);

      // Step 4: Verify messages are stored
      const messagesResponse = await request.get(
        `/api/chat-history/sessions/${sessionId}/messages`,
        {
          headers: API_HEADERS,
        }
      );

      expect(messagesResponse.status()).toBe(200);
      const messagesData = await messagesResponse.json();
      expect(messagesData.messages).toHaveLength(2);

      // Step 5: Update session
      const updateResponse = await request.put(
        `/api/chat-history/sessions/${sessionId}`,
        {
          headers: API_HEADERS,
          data: {
            title: "Updated: Complete Chat Test",
          },
        }
      );

      expect(updateResponse.status()).toBe(200);

      // Step 6: Clean up - delete session
      const deleteResponse = await request.delete(
        `/api/chat-history/sessions/${sessionId}`,
        {
          headers: API_HEADERS,
        }
      );

      expect(deleteResponse.status()).toBe(200);

      // Step 7: Verify deletion
      const verifyResponse = await request.get(
        `/api/chat-history/sessions/${sessionId}`,
        {
          headers: API_HEADERS,
        }
      );

      expect(verifyResponse.status()).toBe(404);
    });
  });

  test.describe("File-Enhanced Chat Workflow", () => {
    test("should read file, use in chat, and update file", async ({ request }) => {
      // Step 1: Create a test file
      const testFile = join(TEMP_WORKSPACE_DIR, "chat-workflow.txt");
      const originalContent = "Original file content for chat workflow";
      await writeFile(testFile, originalContent, "utf-8");

      // Step 2: Read the file via API
      const readResponse = await request.get("/api/files/read", {
        headers: API_HEADERS,
        params: { path: testFile },
      });

      expect(readResponse.status()).toBe(200);
      const fileData = await readResponse.json();

      // Step 3: Create session with file context
      const sessionResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "File-Enhanced Chat",
        },
      });

      const session = await sessionResponse.json();

      // Step 4: Add message referencing the file
      const msgResponse = await request.post(
        `/api/chat-history/sessions/${session.id}/messages`,
        {
          headers: API_HEADERS,
          data: {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please analyze this file: ${fileData.fileName}`,
              },
            ],
          },
        }
      );

      expect(msgResponse.status()).toBe(200);

      // Step 5: Update the file based on chat
      const updatedContent = originalContent + "\nUpdated after chat analysis";
      const writeResponse = await request.post("/api/files/write", {
        headers: API_HEADERS,
        data: {
          filePath: testFile,
          options: {
            content: updatedContent,
            encoding: "utf8",
            createBackup: true,
          },
        },
      });

      expect(writeResponse.status()).toBe(200);
      const writeData = await writeResponse.json();
      expect(writeData.action).toBe("overwritten");
      expect(writeData.backup).toBeDefined();

      // Step 6: Verify backup was created
      expect(existsSync(writeData.backup!.backupPath)).toBe(true);

      // Clean up
      await request.delete(`/api/chat-history/sessions/${session.id}`, {
        headers: API_HEADERS,
      });
    });
  });

  test.describe("Multi-Session Management Workflow", () => {
    test("should manage multiple concurrent sessions", async ({ request }) => {
      // Step 1: Create multiple sessions
      const sessions = [];
      const sessionTitles = [
        "Project Discussion",
        "Code Review",
        "Planning Session",
      ];

      for (const title of sessionTitles) {
        const response = await request.post("/api/chat-history/sessions", {
          headers: API_HEADERS,
          data: { title },
        });
        expect(response.status()).toBe(200);
        sessions.push(await response.json());
      }

      // Step 2: Verify all sessions exist
      const listResponse = await request.get("/api/chat-history/sessions", {
        headers: API_HEADERS,
      });

      expect(listResponse.status()).toBe(200);
      const listData = await listResponse.json();
      expect(listData.sessions.length).toBeGreaterThanOrEqual(3);

      // Step 3: Add different content to each session
      for (let i = 0; i < sessions.length; i++) {
        const msgResponse = await request.post(
          `/api/chat-history/sessions/${sessions[i].id}/messages`,
          {
            headers: API_HEADERS,
            data: {
              role: "user",
              content: [{ type: "text", text: `Message for ${sessionTitles[i]}` }],
            },
          }
        );
        expect(msgResponse.status()).toBe(200);
      }

      // Step 4: Retrieve messages from each session
      for (const session of sessions) {
        const msgResponse = await request.get(
          `/api/chat-history/sessions/${session.id}/messages`,
          {
            headers: API_HEADERS,
          }
        );
        expect(msgResponse.status()).toBe(200);
        const msgData = await msgResponse.json();
        expect(msgData.messages).toHaveLength(1);
      }

      // Step 5: Delete all sessions
      for (const session of sessions) {
        const deleteResponse = await request.delete(
          `/api/chat-history/sessions/${session.id}`,
          {
            headers: API_HEADERS,
          }
        );
        expect(deleteResponse.status()).toBe(200);
      }
    });
  });

  test.describe("Batch File Operations Workflow", () => {
    test("should process multiple files in a workflow", async ({ request }) => {
      // Step 1: Create multiple test files
      const testDir = join(TEMP_WORKSPACE_DIR, "batch-workflow");
      await mkdir(testDir, { recursive: true });

      const files = [
        { name: "config.json", content: '{"setting": "value"}' },
        { name: "readme.md", content: "# Project README" },
        { name: "index.ts", content: "console.log('Hello');" },
      ];

      // Create files
      for (const file of files) {
        const filePath = join(testDir, file.name);
        await writeFile(filePath, file.content, "utf-8");
      }

      // Step 2: List directory
      const listResponse = await request.get("/api/files/list", {
        headers: API_HEADERS,
        params: { path: testDir },
      });

      expect(listResponse.status()).toBe(200);
      const listData = await listResponse.json();
      expect(listData.entries.filter((e: any) => e.type === "file").length).toBe(3);

      // Step 3: Read each file
      for (const file of files) {
        const readResponse = await request.get("/api/files/read", {
          headers: API_HEADERS,
          params: { path: join(testDir, file.name) },
        });
        expect(readResponse.status()).toBe(200);

        const readData = await readResponse.json();
        expect(readData.content).toBe(file.content);
      }

      // Step 4: Modify each file
      for (const file of files) {
        const writeResponse = await request.post("/api/files/write", {
          headers: API_HEADERS,
          data: {
            filePath: join(testDir, file.name),
            options: {
              content: file.content + "\n// Modified",
              encoding: "utf8",
              createBackup: false,
            },
          },
        });
        expect(writeResponse.status()).toBe(200);
      }

      // Step 5: Verify modifications
      for (const file of files) {
        const readResponse = await request.get("/api/files/read", {
          headers: API_HEADERS,
          params: { path: join(testDir, file.name) },
        });
        const readData = await readResponse.json();
        expect(readData.content).toContain("Modified");
      }

      // Step 6: Delete all files
      for (const file of files) {
        const deleteResponse = await request.post("/api/files/delete", {
          headers: API_HEADERS,
          data: { filePath: join(testDir, file.name) },
        });
        expect(deleteResponse.status()).toBe(200);
      }

      // Step 7: Verify deletion
      const finalListResponse = await request.get("/api/files/list", {
        headers: API_HEADERS,
        params: { path: testDir },
      });
      const finalListData = await finalListResponse.json();
      expect(finalListData.entries.filter((e: any) => e.type === "file").length).toBe(0);
    });
  });

  test.describe("Search and Navigation Workflow", () => {
    test("should search across sessions and messages", async ({ request }) => {
      // Step 1: Create sessions with searchable content
      const searchTerms = ["typescript", "python", "javascript"];

      for (const term of searchTerms) {
        const sessionResponse = await request.post("/api/chat-history/sessions", {
          headers: API_HEADERS,
          data: {
            title: `${term} discussion`,
          },
        });

        const session = await sessionResponse.json();

        await request.post(`/api/chat-history/sessions/${session.id}/messages`, {
          headers: API_HEADERS,
          data: {
            role: "user",
            content: [{ type: "text", text: `Tell me about ${term}` }],
          },
        });

        await request.post(`/api/chat-history/sessions/${session.id}/messages`, {
          headers: API_HEADERS,
          data: {
            role: "assistant",
            content: [
              {
                type: "text",
                text: `${term} is a popular programming language.`,
              },
            ],
          },
        });
      }

      // Step 2: Search for content
      const searchResponse = await request.get("/api/chat-history/search", {
        headers: API_HEADERS,
        params: { q: "programming" },
      });

      expect(searchResponse.status()).toBe(200);
      const searchData = await searchResponse.json();
      expect(searchData.results).toBeDefined();

      // Step 3: Search with filters
      const filteredSearchResponse = await request.get("/api/chat-history/search", {
        headers: API_HEADERS,
        params: {
          q: "typescript",
          limit: "5",
        },
      });

      expect(filteredSearchResponse.status()).toBe(200);
    });
  });

  test.describe("Error Recovery Workflow", () => {
    test("should handle and recover from file operation errors", async ({
      request,
    }) => {
      // Step 1: Try to read non-existent file
      const readResponse = await request.get("/api/files/read", {
        headers: API_HEADERS,
        params: { path: join(TEMP_WORKSPACE_DIR, "does-not-exist.txt") },
      });

      expect(readResponse.status()).toBe(404);
      const readError = await readResponse.json();
      expect(readError.error).toContain("does not exist");

      // Step 2: Create the file
      const writeResponse = await request.post("/api/files/write", {
        headers: API_HEADERS,
        data: {
          filePath: join(TEMP_WORKSPACE_DIR, "recovered-file.txt"),
          options: {
            content: "Recovered from error",
            encoding: "utf8",
            createBackup: false,
          },
        },
      });

      expect(writeResponse.status()).toBe(200);

      // Step 3: Read the newly created file
      const retryReadResponse = await request.get("/api/files/read", {
        headers: API_HEADERS,
        params: { path: join(TEMP_WORKSPACE_DIR, "recovered-file.txt") },
      });

      expect(retryReadResponse.status()).toBe(200);
      const fileData = await retryReadResponse.json();
      expect(fileData.content).toBe("Recovered from error");
    });

    test("should handle invalid session operations gracefully", async ({
      request,
    }) => {
      // Step 1: Try to get non-existent session
      const response = await request.get("/api/chat-history/sessions/invalid-id", {
        headers: API_HEADERS,
      });

      expect(response.status()).toBe(404);

      // Step 2: Try to add message to non-existent session
      const msgResponse = await request.post(
        "/api/chat-history/sessions/invalid-id/messages",
        {
          headers: API_HEADERS,
          data: {
            role: "user",
            content: [{ type: "text", text: "Test message" }],
          },
        }
      );

      expect(msgResponse.status()).toBe(404);

      // Step 3: Create valid session and verify operations work
      const sessionResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: { title: "Recovery Test" },
      });

      expect(sessionResponse.status()).toBe(200);
      const session = await sessionResponse.json();

      const validMsgResponse = await request.post(
        `/api/chat-history/sessions/${session.id}/messages`,
        {
          headers: API_HEADERS,
          data: {
            role: "user",
            content: [{ type: "text", text: "Valid message" }],
          },
        }
      );

      expect(validMsgResponse.status()).toBe(200);
    });
  });

  test.describe("Concurrent Operations Workflow", () => {
    test("should handle multiple simultaneous requests", async ({ request }) => {
      // Step 1: Create multiple sessions concurrently
      const sessionPromises = Array.from({ length: 5 }, (_, i) =>
        request.post("/api/chat-history/sessions", {
          headers: API_HEADERS,
          data: { title: `Concurrent Session ${i}` },
        })
      );

      const responses = await Promise.all(sessionPromises);
      const sessions = await Promise.all(responses.map((r) => r.json()));

      // Verify all were created
      for (const response of responses) {
        expect(response.status()).toBe(200);
      }

      // Step 2: Add messages to all sessions concurrently
      const messagePromises = sessions.map((session) =>
        request.post(`/api/chat-history/sessions/${session.id}/messages`, {
          headers: API_HEADERS,
          data: {
            role: "user",
            content: [{ type: "text", text: "Concurrent message" }],
          },
        })
      );

      const messageResponses = await Promise.all(messagePromises);

      for (const response of messageResponses) {
        expect(response.status()).toBe(200);
      }

      // Step 3: Clean up
      const deletePromises = sessions.map((session) =>
        request.delete(`/api/chat-history/sessions/${session.id}`, {
          headers: API_HEADERS,
        })
      );

      const deleteResponses = await Promise.all(deletePromises);

      for (const response of deleteResponses) {
        expect(response.status()).toBe(200);
      }
    });
  });

  test.describe("Data Consistency Workflow", () => {
    test("should maintain data integrity across operations", async ({ request }) => {
      // Step 1: Create a session
      const sessionResponse = await request.post("/api/chat-history/sessions", {
        headers: API_HEADERS,
        data: {
          title: "Consistency Test",
          model: "claude-3-5-sonnet-20241022",
          temperature: 0.5,
        },
      });

      const session = await sessionResponse.json();

      // Step 2: Store initial metadata
      expect(session.model).toBe("claude-3-5-sonnet-20241022");
      expect(session.temperature).toBe(0.5);

      // Step 3: Update session
      const updateResponse = await request.put(
        `/api/chat-history/sessions/${session.id}`,
        {
          headers: API_HEADERS,
          data: {
            title: "Updated Consistency Test",
            temperature: 0.7,
          },
        }
      );

      expect(updateResponse.status()).toBe(200);

      // Step 4: Verify update persisted
      const getResponse = await request.get(
        `/api/chat-history/sessions/${session.id}`,
        {
          headers: API_HEADERS,
        }
      );

      const updatedSession = await getResponse.json();
      expect(updatedSession.title).toBe("Updated Consistency Test");
      expect(updatedSession.temperature).toBe(0.7);
      // Model should remain unchanged
      expect(updatedSession.model).toBe("claude-3-5-sonnet-20241022");

      // Clean up
      await request.delete(`/api/chat-history/sessions/${session.id}`, {
        headers: API_HEADERS,
      });
    });
  });
});

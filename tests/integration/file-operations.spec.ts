import { test, expect } from "@playwright/test";
import { rm, mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { TEST_DATA } from "../utils/test-constants";

/**
 * Integration Tests for File Operations
 *
 * This test suite covers the complete file operation workflows:
 * 1. Reading files via API
 * 2. Writing files via API
 * 3. Listing directories via API
 * 4. Deleting files via API
 * 5. End-to-end file operation workflows
 *
 * These tests create a temporary workspace directory for file operations
 * and clean it up after each test.
 */

const TEMP_WORKSPACE_DIR = join(process.cwd(), ".test-workspace");

interface FileReadResponse {
  filePath: string;
  fileName: string;
  content: string;
  size: number;
  modified: string;
}

interface FileWriteResponse {
  filePath: string;
  fileName: string;
  size: number;
  action: "created" | "overwritten";
  backup?: {
    backupPath: string;
    size: number;
    timestamp: string;
  };
}

interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
  modified?: string;
  children?: DirectoryEntry[];
}

interface DirectoryListResponse {
  entries: DirectoryEntry[];
  path: string;
  totalCount: number;
}

// Helper function to make authenticated API requests
const API_HEADERS = {
  "x-api-key": TEST_DATA.VALID_API_KEY,
};

test.describe("File Operations Integration", () => {
  // Create a temporary workspace directory before all tests
  test.beforeAll(async () => {
    // Ensure clean workspace
    if (existsSync(TEMP_WORKSPACE_DIR)) {
      await rm(TEMP_WORKSPACE_DIR, { recursive: true, force: true });
    }
    await mkdir(TEMP_WORKSPACE_DIR, { recursive: true });
  });

  // Clean up workspace after all tests
  test.afterAll(async () => {
    if (existsSync(TEMP_WORKSPACE_DIR)) {
      await rm(TEMP_WORKSPACE_DIR, { recursive: true, force: true });
    }
  });

  test.describe("File Read Operations", () => {
    test("should read a text file via API", async ({ request }) => {
      // Create a test file
      const testFilePath = join(TEMP_WORKSPACE_DIR, "test-read.txt");
      const testContent = "Hello, this is a test file for reading.";
      await writeFile(testFilePath, testContent, "utf-8");

      // Read the file via API
      const response = await request.get("/api/files/read", {
        headers: API_HEADERS,
        params: { path: testFilePath },
      });

      expect(response.status()).toBe(200);

      const data: FileReadResponse = await response.json();
      expect(data.content).toBe(testContent);
      expect(data.fileName).toBe("test-read.txt");
      expect(data.size).toBe(testContent.length);
    });

    test("should read a JSON file via API", async ({ request }) => {
      // Create a JSON test file
      const testFilePath = join(TEMP_WORKSPACE_DIR, "test.json");
      const testContent = JSON.stringify({ key: "value", nested: { prop: 123 } });
      await writeFile(testFilePath, testContent, "utf-8");

      // Read the file via API
      const response = await request.get("/api/files/read", {
        headers: API_HEADERS,
        params: { path: testFilePath },
      });

      expect(response.status()).toBe(200);

      const data: FileReadResponse = await response.json();
      expect(data.content).toBe(testContent);
      expect(data.fileName).toBe("test.json");
    });

    test("should return 404 for non-existent file", async ({ request }) => {
      const nonExistentPath = join(TEMP_WORKSPACE_DIR, "does-not-exist.txt");

      const response = await request.get("/api/files/read", {
        headers: API_HEADERS,
        params: { path: nonExistentPath },
      });

      expect(response.status()).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("does not exist");
    });

    test("should return 400 for directory path instead of file", async ({ request }) => {
      // Use the workspace directory itself
      const response = await request.get("/api/files/read", {
        headers: API_HEADERS,
        params: { path: TEMP_WORKSPACE_DIR },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("not a file");
    });

    test("should require API key for file read", async ({ request }) => {
      const testFilePath = join(TEMP_WORKSPACE_DIR, "test.txt");
      await writeFile(testFilePath, "content", "utf-8");

      // Request without API key
      const response = await request.get("/api/files/read", {
        params: { path: testFilePath },
      });

      expect(response.status()).toBe(401);
    });

    test("should support POST method for file read", async ({ request }) => {
      const testFilePath = join(TEMP_WORKSPACE_DIR, "test-post-read.txt");
      const testContent = "Testing POST method for file read";
      await writeFile(testFilePath, testContent, "utf-8");

      const response = await request.post("/api/files/read", {
        headers: API_HEADERS,
        data: { path: testFilePath },
      });

      expect(response.status()).toBe(200);

      const data: FileReadResponse = await response.json();
      expect(data.content).toBe(testContent);
    });
  });

  test.describe("File Write Operations", () => {
    test("should create a new file via API", async ({ request }) => {
      const testFilePath = join(TEMP_WORKSPACE_DIR, "new-file.txt");
      const testContent = "This is a new file created via API";

      const response = await request.post("/api/files/write", {
        headers: API_HEADERS,
        data: {
          filePath: testFilePath,
          options: {
            content: testContent,
            encoding: "utf8",
            createBackup: false,
          },
        },
      });

      expect(response.status()).toBe(200);

      const data: FileWriteResponse = await response.json();
      expect(data.action).toBe("created");
      expect(data.fileName).toBe("new-file.txt");

      // Verify file was actually created
      const fileContent = await readFile(testFilePath, "utf-8");
      expect(fileContent).toBe(testContent);
    });

    test("should overwrite existing file via API", async ({ request }) => {
      const testFilePath = join(TEMP_WORKSPACE_DIR, "overwrite-test.txt");
      const originalContent = "Original content";
      const newContent = "New content";

      // Create the file first
      await writeFile(testFilePath, originalContent, "utf-8");

      // Overwrite via API
      const response = await request.post("/api/files/write", {
        headers: API_HEADERS,
        data: {
          filePath: testFilePath,
          options: {
            content: newContent,
            encoding: "utf8",
            createBackup: false,
          },
        },
      });

      expect(response.status()).toBe(200);

      const data: FileWriteResponse = await response.json();
      expect(data.action).toBe("overwritten");

      // Verify file was overwritten
      const fileContent = await readFile(testFilePath, "utf-8");
      expect(fileContent).toBe(newContent);
    });

    test("should create backup when overwriting file", async ({ request }) => {
      const testFilePath = join(TEMP_WORKSPACE_DIR, "backup-test.txt");
      const originalContent = "Original content for backup test";
      const newContent = "New content";

      // Create the file first
      await writeFile(testFilePath, originalContent, "utf-8");

      // Overwrite with backup enabled
      const response = await request.post("/api/files/write", {
        headers: API_HEADERS,
        data: {
          filePath: testFilePath,
          options: {
            content: newContent,
            encoding: "utf8",
            createBackup: true,
          },
        },
      });

      expect(response.status()).toBe(200);

      const data: FileWriteResponse = await response.json();
      expect(data.action).toBe("overwritten");
      expect(data.backup).toBeDefined();
      expect(data.backup!.backupPath).toBeDefined();

      // Verify backup file exists
      expect(existsSync(data.backup!.backupPath)).toBe(true);

      // Verify backup contains original content
      const backupContent = await readFile(data.backup!.backupPath, "utf-8");
      expect(backupContent).toBe(originalContent);
    });

    test("should return 404 when parent directory does not exist", async ({ request }) => {
      const nonExistentDir = join(TEMP_WORKSPACE_DIR, "does-not-exist", "file.txt");

      const response = await request.post("/api/files/write", {
        headers: API_HEADERS,
        data: {
          filePath: nonExistentDir,
          options: {
            content: "content",
            encoding: "utf8",
            createBackup: false,
          },
        },
      });

      expect(response.status()).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("does not exist");
    });

    test("should require content parameter", async ({ request }) => {
      const testFilePath = join(TEMP_WORKSPACE_DIR, "no-content-test.txt");

      const response = await request.post("/api/files/write", {
        headers: API_HEADERS,
        data: {
          filePath: testFilePath,
          options: {
            content: undefined,
          },
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("required");
    });
  });

  test.describe("Directory List Operations", () => {
    test("should list directory contents", async ({ request }) => {
      // Create some test files
      await mkdir(join(TEMP_WORKSPACE_DIR, "list-test"), { recursive: true });
      await writeFile(join(TEMP_WORKSPACE_DIR, "list-test", "file1.txt"), "content1", "utf-8");
      await writeFile(join(TEMP_WORKSPACE_DIR, "list-test", "file2.ts"), "content2", "utf-8");
      await mkdir(join(TEMP_WORKSPACE_DIR, "list-test", "subdir"), { recursive: true });

      const response = await request.get("/api/files/list", {
        headers: API_HEADERS,
        params: { path: join(TEMP_WORKSPACE_DIR, "list-test") },
      });

      expect(response.status()).toBe(200);

      const data: DirectoryListResponse = await response.json();
      expect(data.entries).toBeDefined();
      expect(data.totalCount).toBeGreaterThanOrEqual(3);
    });

    test("should filter by file extension", async ({ request }) => {
      // Create test directory with mixed file types
      const testDir = join(TEMP_WORKSPACE_DIR, "filter-test");
      await mkdir(testDir, { recursive: true });
      await writeFile(join(testDir, "file1.txt"), "txt", "utf-8");
      await writeFile(join(testDir, "file2.ts"), "ts", "utf-8");
      await writeFile(join(testDir, "file3.txt"), "txt2", "utf-8");

      const response = await request.get("/api/files/list", {
        headers: API_HEADERS,
        params: {
          path: testDir,
          extensions: ".txt",
        },
      });

      expect(response.status()).toBe(200);

      const data: DirectoryListResponse = await response.json();
      const txtFiles = data.entries.filter((e) => e.name.endsWith(".txt"));
      expect(txtFiles.length).toBe(2);
    });

    test("should support POST method for directory listing", async ({ request }) => {
      const testDir = join(TEMP_WORKSPACE_DIR, "post-list-test");
      await mkdir(testDir, { recursive: true });
      await writeFile(join(testDir, "test.txt"), "content", "utf-8");

      const response = await request.post("/api/files/list", {
        headers: API_HEADERS,
        data: {
          path: testDir,
          options: {
            includeHidden: false,
            recursive: false,
          },
        },
      });

      expect(response.status()).toBe(200);

      const data: DirectoryListResponse = await response.json();
      expect(data.entries.length).toBeGreaterThan(0);
    });

    test("should return 404 for non-existent directory", async ({ request }) => {
      const response = await request.get("/api/files/list", {
        headers: API_HEADERS,
        params: { path: join(TEMP_WORKSPACE_DIR, "does-not-exist") },
      });

      expect(response.status()).toBe(404);
    });
  });

  test.describe("File Delete Operations", () => {
    test("should delete a file via API", async ({ request }) => {
      const testFilePath = join(TEMP_WORKSPACE_DIR, "delete-me.txt");
      await writeFile(testFilePath, "content to delete", "utf-8");

      // Verify file exists
      expect(existsSync(testFilePath)).toBe(true);

      const response = await request.post("/api/files/delete", {
        headers: API_HEADERS,
        data: { filePath: testFilePath },
      });

      expect(response.status()).toBe(200);

      // Verify file was deleted
      expect(existsSync(testFilePath)).toBe(false);
    });

    test("should return 404 when deleting non-existent file", async ({ request }) => {
      const nonExistentPath = join(TEMP_WORKSPACE_DIR, "never-existed.txt");

      const response = await request.post("/api/files/delete", {
        headers: API_HEADERS,
        data: { filePath: nonExistentPath },
      });

      expect(response.status()).toBe(404);
    });

    test("should not delete directories", async ({ request }) => {
      const testDir = join(TEMP_WORKSPACE_DIR, "directory-not-file");
      await mkdir(testDir, { recursive: true });

      const response = await request.post("/api/files/delete", {
        headers: API_HEADERS,
        data: { filePath: testDir },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe("End-to-End File Workflows", () => {
    test("should complete read-modify-write workflow", async ({ request }) => {
      const testFilePath = join(TEMP_WORKSPACE_DIR, "workflow.txt");
      const originalContent = "Line 1\nLine 2\nLine 3";

      // Step 1: Create initial file
      await writeFile(testFilePath, originalContent, "utf-8");

      // Step 2: Read the file
      const readResponse = await request.get("/api/files/read", {
        headers: API_HEADERS,
        params: { path: testFilePath },
      });
      expect(readResponse.status()).toBe(200);
      const readData: FileReadResponse = await readResponse.json();

      // Step 3: Modify content
      const modifiedContent = readData.content + "\nLine 4";

      // Step 4: Write back with backup
      const writeResponse = await request.post("/api/files/write", {
        headers: API_HEADERS,
        data: {
          filePath: testFilePath,
          options: {
            content: modifiedContent,
            encoding: "utf8",
            createBackup: true,
          },
        },
      });
      expect(writeResponse.status()).toBe(200);
      const writeData: FileWriteResponse = await writeResponse.json();
      expect(writeData.backup).toBeDefined();
      expect(writeData.backup!.backupPath).toBeDefined();

      // Step 5: Verify final content
      const finalContent = await readFile(testFilePath, "utf-8");
      expect(finalContent).toBe(modifiedContent);

      // Step 6: Verify backup exists
      expect(existsSync(writeData.backup!.backupPath)).toBe(true);
    });

    test("should complete batch file operations workflow", async ({ request }) => {
      const batchDir = join(TEMP_WORKSPACE_DIR, "batch-test");
      await mkdir(batchDir, { recursive: true });

      // Create multiple files
      const filesToCreate = [
        { name: "file1.txt", content: "Content 1" },
        { name: "file2.txt", content: "Content 2" },
        { name: "file3.txt", content: "Content 3" },
      ];

      for (const file of filesToCreate) {
        const response = await request.post("/api/files/write", {
          headers: API_HEADERS,
          data: {
            filePath: join(batchDir, file.name),
            options: {
              content: file.content,
              encoding: "utf8",
              createBackup: false,
            },
          },
        });
        expect(response.status()).toBe(200);
      }

      // List directory to verify all files exist
      const listResponse = await request.get("/api/files/list", {
        headers: API_HEADERS,
        params: { path: batchDir },
      });
      expect(listResponse.status()).toBe(200);
      const listData: DirectoryListResponse = await listResponse.json();
      expect(listData.entries.filter((e) => e.type === "file").length).toBe(3);

      // Read and verify each file
      for (const file of filesToCreate) {
        const readResponse = await request.get("/api/files/read", {
          headers: API_HEADERS,
          params: { path: join(batchDir, file.name) },
        });
        expect(readResponse.status()).toBe(200);
        const readData: FileReadResponse = await readResponse.json();
        expect(readData.content).toBe(file.content);
      }
    });

    test("should handle nested directory operations", async ({ request }) => {
      const nestedDir = join(TEMP_WORKSPACE_DIR, "nested", "deep", "structure");
      await mkdir(nestedDir, { recursive: true });

      const testFile = join(nestedDir, "deep-file.txt");
      const content = "Deeply nested file content";

      // Write file in nested directory
      const writeResponse = await request.post("/api/files/write", {
        headers: API_HEADERS,
        data: {
          filePath: testFile,
          options: {
            content,
            encoding: "utf8",
            createBackup: false,
          },
        },
      });
      expect(writeResponse.status()).toBe(200);

      // Read file from nested directory
      const readResponse = await request.get("/api/files/read", {
        headers: API_HEADERS,
        params: { path: testFile },
      });
      expect(readResponse.status()).toBe(200);

      const readData: FileReadResponse = await readResponse.json();
      expect(readData.content).toBe(content);
    });
  });
});

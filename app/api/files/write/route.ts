import { NextRequest } from "next/server";
import { getApiKeyFromHeaders } from "@/lib/storage/apiKeys";
import { writeFile } from "@/lib/fs/write";
import { existsSync } from "fs";
import type { FileWriteWithBackupRequest, FileWriteResponse } from "@/types/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/files/write
 *
 * Writes content to a file with optional backup creation.
 *
 * Request body:
 * - filePath: Full path to the file to write (required)
 * - options: File write options
 *   - content: Content to write (required)
 *   - encoding: Encoding to use (default: 'utf8')
 *   - createBackup: Create backup before overwriting (default: true)
 *   - backupOptions: Backup options
 *   - mode: File mode (default: 0o666)
 */
export async function POST(req: NextRequest) {
  try {
    // Get API key from headers
    const apiKey = getApiKeyFromHeaders(req.headers);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: FileWriteWithBackupRequest = await req.json();
    const { filePath, options } = body;

    // Validate filePath
    if (!filePath || typeof filePath !== "string") {
      return new Response(
        JSON.stringify({ error: "File path is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate options
    if (!options || typeof options !== "object") {
      return new Response(
        JSON.stringify({ error: "Options are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate content
    if (options.content === undefined || options.content === null) {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check content size
    const contentSize = Buffer.byteLength(options.content || "", options.encoding || "utf8");
    if (contentSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `Content too large (${(contentSize / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`
        }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    // Security check: ensure directory exists (for validation)
    const directory = filePath.substring(0, filePath.lastIndexOf("/")) ||
                     filePath.substring(0, filePath.lastIndexOf("\\"));
    if (directory && !existsSync(directory)) {
      return new Response(
        JSON.stringify({ error: `Directory does not exist: ${directory}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Write the file
    const result: FileWriteResponse = writeFile(filePath, {
      content: options.content,
      encoding: options.encoding,
      createBackup: options.createBackup,
      backupOptions: options.backupOptions,
      mode: options.mode,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("File write API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      statusCode = 404;
    } else if (errorMessage.includes("access denied") || errorMessage.includes("EACCES")) {
      statusCode = 403;
    } else if (errorMessage.includes("does not exist")) {
      statusCode = 404;
    } else if (errorMessage.includes("Path traversal")) {
      statusCode = 403;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json" } }
    );
  }
}

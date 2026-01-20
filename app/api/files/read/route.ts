import { NextRequest } from "next/server";
import { getApiKeyFromHeaders } from "@/lib/storage/apiKeys";
import { readFileSync, existsSync, statSync } from "fs";
import { extname, basename } from "path";
import type { FileReadResponse } from "@/types/files";
import { getLogger } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const logger = getLogger().child({ source: "files-read" });

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Binary file extensions that shouldn't be read as text
const BINARY_EXTENSIONS = new Set([
  ".exe", ".dll", ".so", ".dylib",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp",
  ".mp3", ".mp4", ".avi", ".mov", ".wav", ".flac",
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
]);

/**
 * GET /api/files/read
 *
 * Reads the contents of a file at the specified path.
 * Only works in Electron mode where file system access is available.
 *
 * Query parameters:
 * - path: Full path to the file to read (required)
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let filePath = "unknown";

  try {
    // Get API key from headers
    const apiKey = getApiKeyFromHeaders(req.headers);
    if (!apiKey) {
      await logger.logApiRequest({
        method: "GET",
        path: "/api/files/read",
        statusCode: 401,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: "API key is required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    filePath = searchParams.get("path") || "unknown";

    // Validate path parameter
    if (filePath === "unknown") {
      return new Response(
        JSON.stringify({ error: "Path parameter is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Security check: ensure file exists
    if (!existsSync(filePath)) {
      return new Response(
        JSON.stringify({ error: `File does not exist: ${filePath}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get file stats
    const stats = statSync(filePath);

    // Check if it's a file (not a directory)
    if (!stats.isFile()) {
      return new Response(
        JSON.stringify({ error: `Path is not a file: ${filePath}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`
        }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if file is binary
    const ext = extname(filePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      return new Response(
        JSON.stringify({ error: `Cannot read binary file type: ${ext}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Read file content
    const content = readFileSync(filePath, "utf-8");

    // Build response
    const response: FileReadResponse = {
      filePath,
      fileName: basename(filePath),
      content,
      size: stats.size,
      modified: stats.mtime,
    };

    await logger.logFileOperation({
      operation: "read",
      path: filePath,
      success: true,
      size: stats.size,
      duration: Date.now() - startTime,
    });

    await logger.logApiRequest({
      method: "GET",
      path: "/api/files/read",
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      statusCode = 404;
    } else if (errorMessage.includes("access denied") || errorMessage.includes("EACCES")) {
      statusCode = 403;
    } else if (errorMessage.includes("not a file") || errorMessage.includes("ENOTDIR")) {
      statusCode = 400;
    } else if (errorMessage.includes("Path traversal")) {
      statusCode = 403;
    }

    await logger.error("File read API error", error as Error, { filePath, statusCode });
    await logger.logFileOperation({
      operation: "read",
      path: "unknown",
      success: false,
      duration: Date.now() - startTime,
      error: errorMessage,
    });
    await logger.logApiRequest({
      method: "GET",
      path: "/api/files/read",
      statusCode,
      duration: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * POST /api/files/read
 *
 * Alternative endpoint using POST with JSON body.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Get API key from headers
    const apiKey = getApiKeyFromHeaders(req.headers);
    if (!apiKey) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/files/read",
        statusCode: 401,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: "API key is required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const filePath = body.path;

    // Validate path
    if (!filePath) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/files/read",
        statusCode: 400,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: "Path is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Security check: ensure file exists
    if (!existsSync(filePath)) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/files/read",
        statusCode: 404,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: `File does not exist: ${filePath}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get file stats
    const stats = statSync(filePath);

    // Check if it's a file (not a directory)
    if (!stats.isFile()) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/files/read",
        statusCode: 400,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: `Path is not a file: ${filePath}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/files/read",
        statusCode: 413,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({
          error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`
        }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if file is binary
    const ext = extname(filePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/files/read",
        statusCode: 400,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: `Cannot read binary file type: ${ext}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Read file content
    const content = readFileSync(filePath, "utf-8");

    // Build response
    const response: FileReadResponse = {
      filePath,
      fileName: basename(filePath),
      content,
      size: stats.size,
      modified: stats.mtime,
    };

    await logger.logFileOperation({
      operation: "read",
      path: filePath,
      success: true,
      size: stats.size,
      duration: Date.now() - startTime,
    });

    await logger.logApiRequest({
      method: "POST",
      path: "/api/files/read",
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      statusCode = 404;
    } else if (errorMessage.includes("access denied") || errorMessage.includes("EACCES")) {
      statusCode = 403;
    } else if (errorMessage.includes("not a file") || errorMessage.includes("ENOTDIR")) {
      statusCode = 400;
    } else if (errorMessage.includes("Path traversal")) {
      statusCode = 403;
    }

    await logger.error("File read API error (POST)", error as Error, { statusCode });
    await logger.logApiRequest({
      method: "POST",
      path: "/api/files/read",
      statusCode,
      duration: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json" } }
    );
  }
}

import { NextRequest } from "next/server";
import { getApiKeyFromHeaders } from "@/lib/storage/apiKeys";
import { readFileSync, existsSync, statSync } from "fs";
import { extname, basename } from "path";
import { getLogger } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const logger = getLogger().child({ source: "files-image-read" });

// Maximum image file size: 25MB
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;

// Supported image extensions
const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
]);

// Media type mapping for image extensions
const MEDIA_TYPE_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/**
 * GET /api/files/image-read
 *
 * Reads an image file and returns it as base64-encoded data.
 * Only works in Electron mode where file system access is available.
 *
 * Query parameters:
 * - path: Full path to the image file to read (required)
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
        path: "/api/files/image-read",
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
    if (stats.size > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `Image file too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 25MB.`
        }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if file is an image
    const ext = extname(filePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      return new Response(
        JSON.stringify({ error: `Unsupported image format: ${ext}. Supported formats: ${Array.from(IMAGE_EXTENSIONS).join(", ")}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Read file as buffer
    const buffer = readFileSync(filePath);
    const base64Data = buffer.toString("base64");
    const mediaType = MEDIA_TYPE_MAP[ext] || "image/png";

    await logger.logFileOperation({
      operation: "read",
      path: filePath,
      success: true,
      size: stats.size,
      duration: Date.now() - startTime,
    });

    await logger.logApiRequest({
      method: "GET",
      path: "/api/files/image-read",
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return new Response(JSON.stringify({
      filePath,
      fileName: basename(filePath),
      mediaType,
      base64Data,
      size: stats.size,
      width: undefined, // Could be populated with image dimension parsing
      height: undefined,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      statusCode = 404;
    } else if (errorMessage.includes("access denied") || errorMessage.includes("EACCES")) {
      statusCode = 403;
    }

    await logger.error("File read API error (image)", error as Error, { filePath, statusCode });
    await logger.logApiRequest({
      method: "GET",
      path: "/api/files/image-read",
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
 * POST /api/files/image-read
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
        path: "/api/files/image-read",
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
        path: "/api/files/image-read",
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
        path: "/api/files/image-read",
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
        path: "/api/files/image-read",
        statusCode: 400,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: `Path is not a file: ${filePath}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check file size
    if (stats.size > MAX_IMAGE_SIZE) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/files/image-read",
        statusCode: 413,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({
          error: `Image file too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 25MB.`
        }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if file is an image
    const ext = extname(filePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/files/image-read",
        statusCode: 400,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: `Unsupported image format: ${ext}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Read file as buffer
    const buffer = readFileSync(filePath);
    const base64Data = buffer.toString("base64");
    const mediaType = MEDIA_TYPE_MAP[ext] || "image/png";

    await logger.logFileOperation({
      operation: "read",
      path: filePath,
      success: true,
      size: stats.size,
      duration: Date.now() - startTime,
    });

    await logger.logApiRequest({
      method: "POST",
      path: "/api/files/image-read",
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return new Response(JSON.stringify({
      filePath,
      fileName: basename(filePath),
      mediaType,
      base64Data,
      size: stats.size,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      statusCode = 404;
    } else if (errorMessage.includes("access denied") || errorMessage.includes("EACCES")) {
      statusCode = 403;
    }

    await logger.error("Image read API error (POST)", error as Error, { statusCode });
    await logger.logApiRequest({
      method: "POST",
      path: "/api/files/image-read",
      statusCode,
      duration: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json" } }
    );
  }
}

import { NextRequest } from "next/server";
import { getApiKeyFromHeaders } from "@/lib/storage/apiKeys";
import { deleteFile } from "@/lib/fs/delete";
import type { FileDeleteRequest } from "@/types/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/files/delete
 *
 * Deletes a file or directory with safety confirmations.
 *
 * Request body:
 * - filePath: Full path to the file or directory to delete (required)
 * - basePath: Base path for security validation (optional)
 * - options: Delete options
 *   - recursive: Recursively delete directories (default: false)
 *
 * Safety features:
 * - Requires API key authentication
 * - Path traversal validation
 * - File existence check
 * - Directory deletion requires explicit recursive flag
 * - Clear error messages for security violations
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
    const body: FileDeleteRequest = await req.json();
    const { filePath, basePath, options } = body;

    // Validate filePath
    if (!filePath || typeof filePath !== "string") {
      return new Response(
        JSON.stringify({ error: "File path is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prevent deleting root or critical system paths
    const normalizedPath = filePath.replace(/\\/g, "/");
    if (
      normalizedPath === "/" ||
      normalizedPath === "" ||
      normalizedPath === "." ||
      normalizedPath.endsWith("/..") ||
      normalizedPath.includes("/../") ||
      normalizedPath.startsWith("../")
    ) {
      return new Response(
        JSON.stringify({ error: "Cannot delete root or parent directory paths" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Delete the file/directory
    const result = deleteFile(basePath || null, filePath, options);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("File delete API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      statusCode = 404;
    } else if (
      errorMessage.includes("access denied") ||
      errorMessage.includes("EACCES") ||
      errorMessage.includes("EPERM")
    ) {
      statusCode = 403;
    } else if (errorMessage.includes("Security validation") || errorMessage.includes("Path traversal")) {
      statusCode = 403;
    } else if (errorMessage.includes("recursive")) {
      statusCode = 400;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json" } }
    );
  }
}

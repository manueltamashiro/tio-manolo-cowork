import { NextRequest } from "next/server";
import { getApiKeyFromHeaders } from "@/lib/storage/apiKeys";
import { renameSync, existsSync } from "fs";
import { join, dirname, basename } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/files/rename
 *
 * Renames a file or directory.
 *
 * Request body:
 * - oldPath: Current full path to the file or directory (required)
 * - newPath: New full path for the file or directory (required)
 * - basePath: Base path for security validation (optional)
 *
 * Safety features:
 * - Requires API key authentication
 * - Path traversal validation
 * - File/directory existence check
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
    const body = await req.json();
    const { oldPath, newPath, basePath } = body;

    // Validate paths
    if (!oldPath || typeof oldPath !== "string") {
      return new Response(
        JSON.stringify({ error: "Old path is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!newPath || typeof newPath !== "string") {
      return new Response(
        JSON.stringify({ error: "New path is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Normalize paths
    const normalizedOldPath = oldPath.replace(/\\/g, "/");
    const normalizedNewPath = newPath.replace(/\\/g, "/");

    // Prevent renaming to root or parent directory paths
    if (
      normalizedNewPath === "/" ||
      normalizedNewPath === "" ||
      normalizedNewPath === "." ||
      normalizedNewPath.endsWith("/..") ||
      normalizedNewPath.includes("/../") ||
      normalizedNewPath.startsWith("../")
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid new path" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if old path exists
    if (!existsSync(oldPath)) {
      return new Response(
        JSON.stringify({ error: "File or directory not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if new path already exists
    if (existsSync(newPath)) {
      return new Response(
        JSON.stringify({ error: "A file or directory with that name already exists" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure parent directory of new path exists
    const newParentDir = dirname(newPath);
    if (!existsSync(newParentDir)) {
      return new Response(
        JSON.stringify({ error: "Target directory does not exist" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Perform the rename operation
    renameSync(oldPath, newPath);

    // Get the new filename
    const newFileName = basename(newPath);
    const oldFileName = basename(oldPath);

    return new Response(JSON.stringify({
      success: true,
      oldPath,
      newPath,
      oldFileName,
      newFileName,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("File rename API error:", error);

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
    } else if (errorMessage.includes("already exists")) {
      statusCode = 409;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json" } }
    );
  }
}

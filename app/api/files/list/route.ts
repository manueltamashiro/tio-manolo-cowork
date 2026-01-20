import { NextRequest } from "next/server";
import { getApiKeyFromHeaders } from "@/lib/storage/apiKeys";
import { getDirectoryListing } from "@/lib/fs/directory";
import type { DirectoryListRequest, DirectoryListResponse } from "@/types/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/files/list
 *
 * Lists directory contents with support for recursive listing and filtering by file type.
 *
 * Query parameters:
 * - path: Directory path to list (required)
 * - includeHidden: Include hidden files (default: false)
 * - recursive: Recursively list subdirectories (default: false)
 * - maxDepth: Maximum depth for recursive listing (default: unlimited)
 * - extensions: Comma-separated file extensions to filter (e.g., ".ts,.tsx")
 * - fileTypes: Comma-separated file types to filter (e.g., "file,directory")
 */
export async function GET(req: NextRequest) {
  try {
    // Get API key from headers
    const apiKey = getApiKeyFromHeaders(req.headers);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const path = searchParams.get("path");

    // Validate path parameter
    if (!path) {
      return new Response(
        JSON.stringify({ error: "Path parameter is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build options from query parameters
    const options: DirectoryListRequest["options"] = {
      includeHidden: searchParams.get("includeHidden") === "true",
      recursive: searchParams.get("recursive") === "true",
      maxDepth: searchParams.get("maxDepth")
        ? parseInt(searchParams.get("maxDepth")!, 10)
        : undefined,
    };

    // Parse extensions filter
    const extensionsParam = searchParams.get("extensions");
    if (extensionsParam) {
      options.extensions = extensionsParam.split(",").map((ext) => {
        return ext.startsWith(".") ? ext : "." + ext;
      });
    }

    // Parse file types filter
    const fileTypesParam = searchParams.get("fileTypes");
    if (fileTypesParam) {
      const validTypes = ["file", "directory", "symlink"];
      options.fileTypes = fileTypesParam
        .split(",")
        .filter((type) => validTypes.includes(type)) as Array<
        "file" | "directory" | "symlink"
      >;
    }

    // Get directory listing
    const result = getDirectoryListing(path, options);

    // Build response
    const response: DirectoryListResponse = {
      entries: result.entries,
      path: result.path,
      totalCount: result.totalCount,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Directory list API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      statusCode = 404;
    } else if (errorMessage.includes("access denied") || errorMessage.includes("EACCES")) {
      statusCode = 403;
    } else if (errorMessage.includes("not a directory") || errorMessage.includes("ENOTDIR")) {
      statusCode = 400;
    } else if (errorMessage.includes("Path traversal")) {
      statusCode = 403;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * POST /api/files/list
 *
 * Alternative endpoint using POST with JSON body for complex requests.
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
    const body: DirectoryListRequest = await req.json();

    // Validate path
    if (!body.path) {
      return new Response(
        JSON.stringify({ error: "Path is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get directory listing
    const result = getDirectoryListing(body.path, body.options);

    // Build response
    const response: DirectoryListResponse = {
      entries: result.entries,
      path: result.path,
      totalCount: result.totalCount,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Directory list API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
      statusCode = 404;
    } else if (errorMessage.includes("access denied") || errorMessage.includes("EACCES")) {
      statusCode = 403;
    } else if (errorMessage.includes("not a directory") || errorMessage.includes("ENOTDIR")) {
      statusCode = 400;
    } else if (errorMessage.includes("Path traversal")) {
      statusCode = 403;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json" } }
    );
  }
}

import { NextRequest } from "next/server";
import { readFileSync, existsSync } from "fs";
import { getApiKeyFromHeaders } from "@/lib/storage/apiKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/files/diff
 *
 * Compares the original content (from backup) with new content (from current file)
 * to generate a diff for preview.
 *
 * Request body:
 * - backupPath: Path to the backup file (original content)
 * - currentPath: Path to the current file (new content)
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
    const { backupPath, currentPath } = body as {
      backupPath?: string;
      currentPath?: string;
    };

    // Validate inputs
    if (!backupPath || typeof backupPath !== "string") {
      return new Response(
        JSON.stringify({ error: "backupPath is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!currentPath || typeof currentPath !== "string") {
      return new Response(
        JSON.stringify({ error: "currentPath is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Read backup file (original content)
    let originalContent = "";
    if (existsSync(backupPath)) {
      try {
        originalContent = readFileSync(backupPath, "utf-8");
      } catch (error) {
        console.error("Failed to read backup file:", error);
        return new Response(
          JSON.stringify({ error: "Failed to read backup file" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Read current file (new content)
    let newContent = "";
    if (existsSync(currentPath)) {
      try {
        newContent = readFileSync(currentPath, "utf-8");
      } catch (error) {
        console.error("Failed to read current file:", error);
        return new Response(
          JSON.stringify({ error: "Failed to read current file" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Extract filename from current path
    const fileName = currentPath.split("/").pop() || currentPath.split("\\").pop() || "file";

    return new Response(
      JSON.stringify({
        originalContent,
        newContent,
        fileName,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Diff API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

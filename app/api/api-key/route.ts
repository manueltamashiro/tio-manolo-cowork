import { NextRequest, NextResponse } from "next/server";
import { setApiKey, removeApiKey } from "@/lib/storage/apiKeys";
import { validateApiKey } from "@/lib/api/claude";
import { getLogger } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const logger = getLogger().child({ source: "api-key" });

/**
 * POST /api/api-key
 *
 * Sets and validates the API key
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== "string") {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/api-key",
        statusCode: 400,
        duration: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Validate the API key with Claude API
    const isValid = await validateApiKey(apiKey);

    if (!isValid) {
      await logger.warn("Invalid API key provided");
      await logger.logApiRequest({
        method: "POST",
        path: "/api/api-key",
        statusCode: 401,
        duration: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // Store the API key
    await setApiKey(apiKey);

    await logger.info("API key updated successfully");
    await logger.logApiRequest({
      method: "POST",
      path: "/api/api-key",
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await logger.error("API key set error", error as Error);
    await logger.logApiRequest({
      method: "POST",
      path: "/api/api-key",
      statusCode: 500,
      duration: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: "Failed to set API key" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/api-key
 *
 * Removes the stored API key
 */
export async function DELETE() {
  const startTime = Date.now();

  try {
    await removeApiKey();

    await logger.info("API key removed successfully");
    await logger.logApiRequest({
      method: "DELETE",
      path: "/api/api-key",
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await logger.error("API key removal error", error as Error);
    await logger.logApiRequest({
      method: "DELETE",
      path: "/api/api-key",
      statusCode: 500,
      duration: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: "Failed to remove API key" },
      { status: 500 }
    );
  }
}

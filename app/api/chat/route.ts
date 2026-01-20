import { NextRequest } from "next/server";
import { getApiKeyFromHeaders } from "@/lib/storage/apiKeys";
import { streamChatCompletion, createChatCompletion } from "@/lib/api/claude";
import { getLogger } from "@/lib/logging";
import {
  getToolDefinitions,
  executeTool,
} from "@/lib/tools";
import type { ChatRequest, FileContext } from "@/types/claude";
import type { ToolUseBlock, ToolExecutionResult } from "@/types/tools";
import type { DiffMetadata } from "@/lib/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Logger for chat API
const logger = getLogger().child({ source: "chat" });

// Maximum number of tool use rounds to prevent infinite loops
const MAX_TOOL_ROUNDS = 10;

/**
 * Formats file contexts into a string that can be included in the chat
 */
function formatFileContexts(fileContexts: FileContext[]): string {
  if (!fileContexts || fileContexts.length === 0) {
    return "";
  }

  const parts: string[] = [];

  for (const file of fileContexts) {
    parts.push(`File: ${file.name} (${file.path})`);
    parts.push("```");
    parts.push(file.content);
    parts.push("```");
    parts.push(""); // Empty line between files
  }

  return parts.join("\n");
}

/**
 * Extends the message type to include tool use and tool result content blocks
 */
interface ExtendedMessage {
  role: "user" | "assistant";
  content: Array<
    | { type: "text"; text: string }
    | ToolUseBlock
    | { type: "tool_result"; tool_use_id: string; content?: string; is_error?: boolean }
  >;
}

/**
 * Converts a simple ChatRequest message to ExtendedMessage format
 */
function toExtendedMessages(messages: ChatRequest["messages"]): ExtendedMessage[] {
  return messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: [{ type: "text", text: msg.content }],
  }));
}


/**
 * Extracts diff metadata from tool execution result
 */
function extractDiffMetadata(result: ToolExecutionResult, toolName: string): DiffMetadata | undefined {
  // Only write_file operations on existing files have diff info
  if (toolName !== "write_file") {
    return undefined;
  }

  const metadata = result.metadata;
  if (!metadata) {
    return undefined;
  }

  // Only include diff if there's a backup (file was overwritten)
  const backupPath = metadata.backupPath as string | undefined;
  const filePath = metadata.filePath as string | undefined;
  const fileName = filePath?.split("/").pop() || filePath?.split("\\").pop();
  const action = metadata.action as "created" | "overwritten" | undefined;

  if (backupPath && filePath && action === "overwritten") {
    return {
      backupPath,
      filePath,
      fileName,
      action,
    };
  }

  return undefined;
}

/**
 * Executes a single tool use and returns the result block
 */
async function executeToolUse(
  toolUse: ToolUseBlock,
  workspacePath?: string
): Promise<{
  type: "tool_result";
  tool_use_id: string;
  content?: string;
  is_error?: boolean;
  diffMetadata?: DiffMetadata;
}> {
  try {
    const result = await executeTool(
      toolUse.name,
      toolUse.input,
      { workspacePath }
    );

    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: result.success ? result.content : result.error,
      is_error: !result.success,
      diffMetadata: result.success ? extractDiffMetadata(result, toolUse.name) : undefined,
    };
  } catch (error) {
    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: error instanceof Error ? error.message : "Unknown error",
      is_error: true,
    };
  }
}

/**
 * POST /api/chat
 *
 * Handles chat requests to Claude API with support for:
 * - Streaming and non-streaming responses
 * - Tool calling with multi-turn execution
 * - File contexts for additional context
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Get API key from headers
    const apiKey = getApiKeyFromHeaders(req.headers);
    if (!apiKey) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/chat",
        statusCode: 401,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: "API key is required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: ChatRequest & { workspacePath?: string } = await req.json();

    // Validate request
    if (!body.messages || !Array.isArray(body.messages)) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/chat",
        statusCode: 400,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (body.messages.length === 0) {
      await logger.logApiRequest({
        method: "POST",
        path: "/api/chat",
        statusCode: 400,
        duration: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({ error: "At least one message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get tool definitions
    const tools = getToolDefinitions();

    // Process messages to include file contexts
    let processedMessages = [...body.messages];

    // If file contexts are provided, prepend them to the first user message
    if (body.fileContexts && body.fileContexts.length > 0) {
      const fileContextStr = formatFileContexts(body.fileContexts);

      // Find the first user message to prepend the file context
      const firstUserMessageIndex = processedMessages.findIndex(
        (msg) => msg.role === "user"
      );

      if (firstUserMessageIndex !== -1) {
        const originalMessage = processedMessages[firstUserMessageIndex];
        processedMessages[firstUserMessageIndex] = {
          ...originalMessage,
          content: `${fileContextStr}\n\n${originalMessage.content}`,
        };
      }
    }

    // Update the request body with processed messages
    const processedBody = { ...body, messages: processedMessages };

    // Check if streaming is requested
    const stream = body.stream ?? true;

    if (stream) {
      return handleStreamingResponse(
        processedBody,
        apiKey,
        tools,
        body.workspacePath
      );
    } else {
      return await handleNonStreamingResponse(
        processedBody,
        apiKey,
        tools,
        body.workspacePath
      );
    }
  } catch (error) {
    await logger.error("Chat API error", error as Error, {
      duration: Date.now() - startTime,
    });
    await logger.logApiRequest({
      method: "POST",
      path: "/api/chat",
      statusCode: 500,
      duration: Date.now() - startTime,
    });
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle non-streaming response with tool calling support
 */
async function handleNonStreamingResponse(
  body: ChatRequest & { workspacePath?: string },
  apiKey: string,
  tools: ReturnType<typeof getToolDefinitions>,
  workspacePath?: string
): Promise<Response> {
  // Convert to extended message format
  let messages: ExtendedMessage[] = toExtendedMessages(body.messages);

  // Multi-turn tool execution loop
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Get response from Claude
    const response = await createChatCompletion(
      {
        ...body,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: JSON.stringify(msg.content),
        })),
      },
      apiKey,
      tools
    );

    // Check if Claude wants to use tools
    if (response.toolUses && response.toolUses.length > 0) {
      // Create assistant message with tool uses
      const assistantMessage: ExtendedMessage = {
        role: "assistant",
        content: response.toolUses.map((toolUse) => toolUse),
      };

      // Execute all tools
      const toolResults = await Promise.all(
        response.toolUses.map((toolUse) =>
          executeToolUse(toolUse, workspacePath)
        )
      );

      // Add assistant message and tool results to conversation
      messages.push(assistantMessage);
      messages.push({
        role: "user",
        content: toolResults,
      });

      // Continue loop to get Claude's response to tool results
      continue;
    }

    // No more tool uses, return the final response
    return new Response(
      JSON.stringify({
        content: response.content,
        model: response.model,
        usage: response.usage,
        stopReason: response.stopReason,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Max rounds reached
  return new Response(
    JSON.stringify({
      error: "Maximum tool execution rounds reached",
    }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Handle streaming response with tool calling support
 */
function handleStreamingResponse(
  body: ChatRequest & { workspacePath?: string },
  apiKey: string,
  tools: ReturnType<typeof getToolDefinitions>,
  workspacePath?: string
): Response {
  const encoder = new TextEncoder();

  // Create a readable stream with multi-turn tool execution
  const readableStream = new ReadableStream({
    async start(controller) {
      // Convert to extended message format
      let messages: ExtendedMessage[] = toExtendedMessages(body.messages);

      // Multi-turn tool execution loop
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        try {
          const streamResponse = streamChatCompletion(
            {
              ...body,
              messages: messages.map((msg) => ({
                role: msg.role,
                content: JSON.stringify(msg.content),
              })),
            },
            apiKey,
            tools
          );

          let currentToolUse: ToolUseBlock | null = null;
          let textContent = "";
          const toolUses: ToolUseBlock[] = [];

          for await (const chunk of streamResponse) {
            if (chunk.type === "content") {
              textContent += chunk.content;
              const data = JSON.stringify({
                type: "content",
                content: chunk.content,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } else if (chunk.type === "tool_use_start" && chunk.toolUse) {
              currentToolUse = chunk.toolUse;
              const data = JSON.stringify({
                type: "tool_use_start",
                toolUse: chunk.toolUse,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } else if (chunk.type === "error") {
              const data = JSON.stringify({
                type: "error",
                error: chunk.error,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              controller.close();
              return;
            } else if (chunk.type === "done") {
              // Check if we have tool uses to execute
              if (currentToolUse) {
                toolUses.push(currentToolUse);
                currentToolUse = null;
              }

              if (toolUses.length > 0) {
                // Execute tools and continue conversation
                const toolResults = await Promise.all(
                  toolUses.map((toolUse) => executeToolUse(toolUse, workspacePath))
                );

                // Add assistant message with tool uses
                messages.push({
                  role: "assistant",
                  content: toolUses,
                });

                // Add user message with tool results
                messages.push({
                  role: "user",
                  content: toolResults,
                });

                // Notify client that tools are being executed
                const toolData = JSON.stringify({
                  type: "tool_execution",
                  tools: toolUses.map((t) => ({
                    id: t.id,
                    name: t.name,
                    input: t.input,
                  })),
                  results: toolResults,
                });
                controller.enqueue(encoder.encode(`data: ${toolData}\n\n`));

                // Continue to next round
                break;
              } else {
                // No more tools, send final done with usage data
                const data = JSON.stringify({
                  type: "done",
                  usage: chunk.usage,
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                controller.close();
                return;
              }
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const data = JSON.stringify({
            type: "error",
            error: errorMessage,
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.close();
          return;
        }
      }

      // Max rounds reached
      const data = JSON.stringify({
        type: "error",
        error: "Maximum tool execution rounds reached",
      });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

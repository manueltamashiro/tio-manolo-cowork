import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ClaudeError,
  ModelId,
} from "@/types/claude";
import type { Tool, ToolUseBlock } from "@/types/tools";
import { getLogger } from "@/lib/logging";

const DEFAULT_MODEL: ModelId = "claude-opus-4-6";
const DEFAULT_MAX_TOKENS = 8192;

const logger = getLogger().child({ source: "claude-api" });

/**
 * Creates a Claude API error from an Anthropic error
 */
function createClaudeError(error: unknown): ClaudeError {
  if (error instanceof Anthropic.APIError) {
    const err: ClaudeError = new Error(
      error.message || "Claude API request failed"
    );
    err.statusCode = error.status;
    err.type = error.name;
    return err;
  }
  if (error instanceof Error) {
    return error as ClaudeError;
  }
  return new Error("Unknown error occurred");
}

/**
 * Validates the API key by making a minimal request to the Claude API
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  const startTime = Date.now();

  try {
    const client = new Anthropic({
      apiKey,
      maxRetries: 0,
      timeout: 10000,
    });

    // Make a minimal request to validate the key
    await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1,
      messages: [{ role: "user", content: "test" }],
    });

    await logger.logClaudeApiCall({
      model: "claude-3-5-haiku-20241022",
      duration: Date.now() - startTime,
      streaming: false,
    });

    return true;
  } catch (error) {
    await logger.error("API key validation failed", error as Error, {
      duration: Date.now() - startTime,
    });

    await logger.logClaudeApiCall({
      model: "claude-3-5-haiku-20241022",
      duration: Date.now() - startTime,
      streaming: false,
      error: error instanceof Error ? error.message : String(error),
    });

    return false;
  }
}

/** Models that support extended thinking */
const THINKING_MODELS: ModelId[] = ["claude-3-7-sonnet-20250219", "claude-opus-4-6"];

/**
 * Creates a non-streaming chat request to Claude API
 */
export async function createChatCompletion(
  request: ChatRequest,
  apiKey: string,
  tools?: Tool[]
): Promise<ChatResponse> {
  const startTime = Date.now();

  try {
    const client = new Anthropic({
      apiKey,
      maxRetries: 2,
      timeout: 60000,
    });

    const model = (request.model || DEFAULT_MODEL) as ModelId;

    // Build thinking parameter when requested and supported
    const supportsThinking = THINKING_MODELS.includes(model);
    const thinkingParam = request.enableThinking && supportsThinking
      ? { type: "enabled" as const, budget_tokens: request.thinkingBudget ?? 10000 }
      : undefined;

    // Build messages, applying cache_control to the last user turn for prompt caching
    const messages = request.messages
      .filter((msg) => msg.role !== "system")
      .map((msg, idx, arr) => {
        const isLastUser = msg.role === "user" && idx === arr.length - 1;
        return {
          role: msg.role as "user" | "assistant",
          content: isLastUser
            ? [{ type: "text" as const, text: msg.content, cache_control: { type: "ephemeral" as const } }]
            : msg.content,
        };
      });

    // Extract system message if present
    const systemMsg = request.messages.find((m) => m.role === "system");
    const systemParam = request.systemPrompt || systemMsg?.content;

    const response = await client.messages.create({
      model,
      max_tokens: request.maxTokens || DEFAULT_MAX_TOKENS,
      ...(thinkingParam ? {} : { temperature: request.temperature }),
      ...(systemParam && {
        system: [
          {
            type: "text" as const,
            text: systemParam,
            cache_control: { type: "ephemeral" as const },
          },
        ],
      }),
      messages,
      stream: false,
      ...(tools && { tools }),
      ...(thinkingParam && { thinking: thinkingParam }),
    });

    // Extract text content from response
    let content = "";
    let thinkingContent = "";
    const toolUses: ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        content += block.text;
      } else if ((block as any).type === "thinking") {
        thinkingContent += (block as any).thinking;
      } else if (block.type === "tool_use") {
        toolUses.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    await logger.logClaudeApiCall({
      model,
      requestTokens: response.usage?.input_tokens,
      responseTokens: response.usage?.output_tokens,
      cacheReadTokens: (response.usage as any)?.cache_read_input_tokens,
      cacheCreationTokens: (response.usage as any)?.cache_creation_input_tokens,
      duration: Date.now() - startTime,
      streaming: false,
    });

    return {
      content,
      thinking: thinkingContent || undefined,
      model: response.model,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined,
      stopReason: response.stop_reason ?? undefined,
      toolUses: toolUses.length > 0 ? toolUses : undefined,
    };
  } catch (error) {
    const claudeError = createClaudeError(error);

    await logger.error("Claude API request failed", claudeError as Error, {
      model: request.model || DEFAULT_MODEL,
      duration: Date.now() - startTime,
    });

    await logger.logClaudeApiCall({
      model: request.model || DEFAULT_MODEL,
      duration: Date.now() - startTime,
      streaming: false,
      error: claudeError.message,
    });

    throw claudeError;
  }
}

/**
 * Creates a streaming chat request to Claude API
 * Returns an async generator that yields stream chunks
 */
export async function* streamChatCompletion(
  request: ChatRequest,
  apiKey: string,
  tools?: Tool[]
): AsyncGenerator<StreamChunk> {
  const startTime = Date.now();
  const model = request.model || DEFAULT_MODEL;

  // Accumulate usage data from the stream
  let usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  } | undefined;

  try {
    const client = new Anthropic({
      apiKey,
      maxRetries: 2,
      timeout: 60000,
    });

    // Build thinking parameter when requested and supported
    const supportsThinking = THINKING_MODELS.includes(model as ModelId);
    const thinkingParam = request.enableThinking && supportsThinking
      ? { type: "enabled" as const, budget_tokens: request.thinkingBudget ?? 10000 }
      : undefined;

    // Build messages, applying cache_control to the last user turn for prompt caching
    const messages = request.messages
      .filter((msg) => msg.role !== "system")
      .map((msg, idx, arr) => {
        const isLastUser = msg.role === "user" && idx === arr.length - 1;
        return {
          role: msg.role as "user" | "assistant",
          content: isLastUser
            ? [{ type: "text" as const, text: msg.content, cache_control: { type: "ephemeral" as const } }]
            : msg.content,
        };
      });

    // Extract system message if present
    const systemMsg = request.messages.find((m) => m.role === "system");
    const systemParam = request.systemPrompt || systemMsg?.content;

    const stream = await client.messages.create({
      model,
      max_tokens: request.maxTokens || DEFAULT_MAX_TOKENS,
      ...(thinkingParam ? {} : { temperature: request.temperature }),
      ...(systemParam && {
        system: [
          {
            type: "text" as const,
            text: systemParam,
            cache_control: { type: "ephemeral" as const },
          },
        ],
      }),
      messages,
      stream: true,
      ...(tools && { tools }),
      ...(thinkingParam && { thinking: thinkingParam }),
    });

    for await (const event of stream) {
      switch (event.type) {
        case "content_block_delta":
          if (event.delta.type === "text_delta") {
            yield {
              type: "content",
              content: event.delta.text,
            };
          } else if ((event.delta as any).type === "thinking_delta") {
            yield {
              type: "thinking",
              content: (event.delta as any).thinking,
            } as StreamChunk;
          }
          break;

        case "content_block_start":
          if (event.content_block.type === "tool_use") {
            yield {
              type: "tool_use_start",
              toolUse: {
                type: "tool_use",
                id: event.content_block.id,
                name: event.content_block.name,
                input: event.content_block.input as Record<string, unknown>,
              },
            } as StreamChunk;
          }
          break;

        case "content_block_delta":
          if (event.delta.type === "input_json_delta") {
            yield {
              type: "tool_use_delta",
              toolUseId: (event as any).content_block?.index ?? 0,
              delta: event.delta.partial_json,
            } as StreamChunk;
          }
          break;

        case "message_delta":
          // Capture usage information from the message_delta event
          if (event.usage) {
            usage = {
              inputTokens: (event.usage as any).input_tokens,
              outputTokens: (event.usage as any).output_tokens,
              cacheReadTokens: (event.usage as any).cache_read_input_tokens,
              cacheCreationTokens: (event.usage as any).cache_creation_input_tokens,
            };
          }
          break;

        case "message_stop":
          // Yield done with usage data
          yield { type: "done", usage };

          // Log the streaming completion
          await logger.logClaudeApiCall({
            model,
            requestTokens: usage?.inputTokens,
            responseTokens: usage?.outputTokens,
            cacheReadTokens: usage?.cacheReadTokens,
            cacheCreationTokens: usage?.cacheCreationTokens,
            duration: Date.now() - startTime,
            streaming: true,
          });

          return;
      }
    }
  } catch (error) {
    const claudeError = createClaudeError(error);

    await logger.error("Claude API streaming request failed", claudeError as Error, {
      model,
      duration: Date.now() - startTime,
    });

    await logger.logClaudeApiCall({
      model,
      duration: Date.now() - startTime,
      streaming: true,
      error: claudeError.message,
    });

    yield {
      type: "error",
      error: claudeError.message,
    };
  }
}

/**
 * Get available Claude models
 */
export function getAvailableModels(): ModelId[] {
  return [
    "claude-opus-4-6",
    "claude-sonnet-4-5",
    "claude-3-7-sonnet-20250219",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ];
}

/**
 * Get model display name
 */
export function getModelDisplayName(model: ModelId): string {
  const names: Record<ModelId, string> = {
    "claude-opus-4-6": "Claude Opus 4.6",
    "claude-sonnet-4-5": "Claude Sonnet 4.5",
    "claude-3-7-sonnet-20250219": "Claude 3.7 Sonnet",
    "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
    "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
    "claude-3-opus-20240229": "Claude 3 Opus",
  };
  return names[model] || model;
}

import type { ToolUseBlock } from "@/types/tools";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  /** Optional file context to include in the conversation */
  fileContexts?: FileContext[];
  /** Enable extended thinking (supported on claude-3-7-sonnet and claude-opus-4-6) */
  enableThinking?: boolean;
  /** Token budget for extended thinking (default 10000) */
  thinkingBudget?: number;
  /** System prompt to send as a top-level system parameter */
  systemPrompt?: string;
}

export interface FileContext {
  /** Path of the file */
  path: string;
  /** Name of the file */
  name: string;
  /** Content of the file */
  content: string;
  /** Language/file type for syntax highlighting hints (optional) */
  language?: string;
}

export interface ChatResponse {
  content: string;
  thinking?: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason?: string;
  toolUses?: ToolUseBlock[];
}

export interface StreamChunk {
  type: "content" | "thinking" | "error" | "done" | "tool_use_start" | "tool_use_delta" | "tool_result";
  content?: string;
  error?: string;
  toolUse?: ToolUseBlock;
  toolUseId?: string | number;
  delta?: string;
  toolResult?: {
    toolUseId: string;
    content?: string;
    isError?: boolean;
  };
  /** Token usage data (included in the final "done" chunk for streaming responses) */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
}

export interface ClaudeError extends Error {
  statusCode?: number;
  type?: string;
}

export type ModelId =
  | "claude-opus-4-6"
  | "claude-sonnet-4-5"
  | "claude-3-7-sonnet-20250219"
  | "claude-3-5-sonnet-20241022"
  | "claude-3-5-haiku-20241022"
  | "claude-3-opus-20240229";

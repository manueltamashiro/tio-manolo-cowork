/**
 * Tool calling types for Claude's function calling feature
 * Defines the structure for tools, tool execution, and tool results
 */

/**
 * Tool parameter schema following JSON Schema format
 */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, ToolPropertySchema>;
  required?: string[];
  [key: string]: unknown; // Index signature for compatibility with Anthropic SDK
}

/**
 * Individual property schema
 */
export interface ToolPropertySchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  items?: ToolPropertySchema;
}

/**
 * Tool definition for Claude API
 */
export interface Tool {
  name: string;
  description: string;
  input_schema: ToolParameterSchema;
}

/**
 * Tool use block from Claude response
 */
export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result block for sending back to Claude
 */
export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content?: string | null;
  is_error?: boolean;
}

/**
 * Result of executing a tool
 */
export interface ToolExecutionResult {
  /** Whether the tool execution was successful */
  success: boolean;
  /** The result content to send back to Claude */
  content?: string;
  /** Error message if execution failed */
  error?: string;
  /** Additional metadata about the execution */
  metadata?: {
    toolName: string;
    duration?: number;
    [key: string]: unknown;
  };
}

/**
 * Context for tool execution
 */
export interface ToolExecutionContext {
  /** Workspace/root path for file operations */
  workspacePath?: string;
  /** API key for authentication */
  apiKey?: string;
}

/**
 * Tool executor function signature
 */
export type ToolExecutor = (
  input: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

/**
 * Registered tool with executor
 */
export interface RegisteredTool extends Tool {
  executor: ToolExecutor;
}

/**
 * File operation tool inputs
 */
export interface ReadFileInput {
  filePath: string;
}

export interface WriteFileInput {
  filePath: string;
  content: string;
}

export interface ListDirectoryInput {
  directoryPath: string;
  recursive?: boolean;
  includeHidden?: boolean;
}

export interface CreateFileInput {
  directoryPath: string;
  fileName: string;
  content: string;
}

export interface DeleteFileInput {
  filePath: string;
}

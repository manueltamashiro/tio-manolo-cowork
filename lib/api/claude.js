"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApiKey = validateApiKey;
exports.createChatCompletion = createChatCompletion;
exports.streamChatCompletion = streamChatCompletion;
exports.getAvailableModels = getAvailableModels;
exports.getModelDisplayName = getModelDisplayName;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const DEFAULT_MODEL = "claude-3-7-sonnet-20250219";
const DEFAULT_MAX_TOKENS = 8192;
/**
 * Creates a Claude API error from an Anthropic error
 */
function createClaudeError(error) {
    if (error instanceof sdk_1.default.APIError) {
        const err = new Error(error.message || "Claude API request failed");
        err.statusCode = error.status;
        err.type = error.name;
        return err;
    }
    if (error instanceof Error) {
        return error;
    }
    return new Error("Unknown error occurred");
}
/**
 * Validates the API key by making a minimal request to the Claude API
 */
async function validateApiKey(apiKey) {
    try {
        const client = new sdk_1.default({
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
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Creates a non-streaming chat request to Claude API
 */
async function createChatCompletion(request, apiKey) {
    try {
        const client = new sdk_1.default({
            apiKey,
            maxRetries: 2,
            timeout: 60000,
        });
        const model = request.model || DEFAULT_MODEL;
        const response = await client.messages.create({
            model,
            max_tokens: request.maxTokens || DEFAULT_MAX_TOKENS,
            temperature: request.temperature,
            messages: request.messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
            stream: false,
        });
        // Extract text content from response
        let content = "";
        for (const block of response.content) {
            if (block.type === "text") {
                content += block.text;
            }
        }
        return {
            content,
            model: response.model,
            usage: response.usage
                ? {
                    inputTokens: response.usage.input_tokens,
                    outputTokens: response.usage.output_tokens,
                }
                : undefined,
            stopReason: response.stop_reason ?? undefined,
        };
    }
    catch (error) {
        throw createClaudeError(error);
    }
}
/**
 * Creates a streaming chat request to Claude API
 * Returns an async generator that yields stream chunks
 */
async function* streamChatCompletion(request, apiKey) {
    try {
        const client = new sdk_1.default({
            apiKey,
            maxRetries: 2,
            timeout: 60000,
        });
        const model = request.model || DEFAULT_MODEL;
        const stream = await client.messages.create({
            model,
            max_tokens: request.maxTokens || DEFAULT_MAX_TOKENS,
            temperature: request.temperature,
            messages: request.messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
            stream: true,
        });
        for await (const event of stream) {
            switch (event.type) {
                case "content_block_delta":
                    if (event.delta.type === "text_delta") {
                        yield {
                            type: "content",
                            content: event.delta.text,
                        };
                    }
                    break;
                case "message_stop":
                    yield { type: "done" };
                    return;
            }
        }
    }
    catch (error) {
        const claudeError = createClaudeError(error);
        yield {
            type: "error",
            error: claudeError.message,
        };
    }
}
/**
 * Get available Claude models
 */
function getAvailableModels() {
    return [
        "claude-3-7-sonnet-20250219",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
    ];
}
/**
 * Get model display name
 */
function getModelDisplayName(model) {
    const names = {
        "claude-3-7-sonnet-20250219": "Claude 3.7 Sonnet",
        "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
        "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
        "claude-3-opus-20240229": "Claude 3 Opus",
    };
    return names[model] || model;
}

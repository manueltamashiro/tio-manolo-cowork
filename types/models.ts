import type { ModelId } from "./claude";

export interface ModelInfo {
  id: ModelId;
  name: string;
  description: string;
  capabilities: string[];
  contextWindow: number;
  inputPrice: number; // Price per million input tokens
  outputPrice: number; // Price per million output tokens
  maxTokens: number;
  tier: "flagship" | "balanced" | "fast";
  supportsExtendedThinking?: boolean;
}

export const MODELS: Record<ModelId, ModelInfo> = {
  "claude-opus-4-6": {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    description: "Most powerful model for complex reasoning, deep analysis, and advanced coding tasks.",
    capabilities: ["Complex reasoning", "Advanced coding", "Deep analysis", "Extended thinking", "Tool use"],
    contextWindow: 200000,
    inputPrice: 15.0,
    outputPrice: 75.0,
    maxTokens: 32000,
    tier: "flagship",
    supportsExtendedThinking: true,
  },
  "claude-sonnet-4-5": {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    description: "Ideal balance of intelligence and speed for most tasks.",
    capabilities: ["Balanced reasoning", "Strong coding", "Efficient tool use", "Fast responses"],
    contextWindow: 200000,
    inputPrice: 3.0,
    outputPrice: 15.0,
    maxTokens: 16000,
    tier: "balanced",
  },
  "claude-3-7-sonnet-20250219": {
    id: "claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet",
    description: "Advanced reasoning with optional extended thinking for difficult problems.",
    capabilities: ["Complex reasoning", "Advanced coding", "Extended thinking", "Tool use"],
    contextWindow: 200000,
    inputPrice: 3.0,
    outputPrice: 15.0,
    maxTokens: 8192,
    tier: "balanced",
    supportsExtendedThinking: true,
  },
  "claude-3-5-sonnet-20241022": {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    description: "Balanced performance for most tasks with excellent speed and capability.",
    capabilities: ["Balanced reasoning", "Strong coding", "Efficient tool use", "Fast responses"],
    contextWindow: 200000,
    inputPrice: 3.0,
    outputPrice: 15.0,
    maxTokens: 8192,
    tier: "balanced",
  },
  "claude-3-5-haiku-20241022": {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    description: "Fastest model for simple tasks, quick responses, and high-volume use cases.",
    capabilities: ["Quick responses", "Simple tasks", "Cost-effective", "Low latency"],
    contextWindow: 200000,
    inputPrice: 0.8,
    outputPrice: 4.0,
    maxTokens: 8192,
    tier: "fast",
  },
  "claude-3-opus-20240229": {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    description: "Previous generation flagship model, still powerful for complex tasks.",
    capabilities: ["Complex reasoning", "Creative writing", "Analysis", "Legacy support"],
    contextWindow: 200000,
    inputPrice: 15.0,
    outputPrice: 75.0,
    maxTokens: 4096,
    tier: "flagship",
  },
};

export function getModelInfo(model: ModelId): ModelInfo {
  return MODELS[model];
}

export function getAllModels(): ModelInfo[] {
  return Object.values(MODELS);
}

export function getTierBadgeColor(tier: ModelInfo["tier"]): string {
  switch (tier) {
    case "flagship":
      return "bg-purple-900/50 text-purple-300 border-purple-700";
    case "balanced":
      return "bg-blue-900/50 text-blue-300 border-blue-700";
    case "fast":
      return "bg-green-900/50 text-green-300 border-green-700";
  }
}

export function getTierLabel(tier: ModelInfo["tier"]): string {
  switch (tier) {
    case "flagship":
      return "Most Capable";
    case "balanced":
      return "Balanced";
    case "fast":
      return "Fastest";
  }
}

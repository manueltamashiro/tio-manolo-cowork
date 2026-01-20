"use client";

import { useMemo } from "react";
import type { Message, Session, SessionWithMessages } from "@/lib/types/chat";

/**
 * Token pricing per 1M tokens (in USD)
 * Based on Anthropic's pricing as of 2025
 */
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead?: number; cacheCreation?: number }> = {
  "claude-3-7-sonnet-20250219": { input: 3.0, output: 15.0, cacheRead: 0.30, cacheCreation: 3.75 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0, cacheRead: 0.30, cacheCreation: 3.75 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0, cacheRead: 0.08, cacheCreation: 1.0 },
  "claude-3-opus-20240229": { input: 15.0, output: 75.0, cacheRead: 1.50, cacheCreation: 18.75 },
};

/**
 * Calculate the cost of tokens for a given model
 */
export function calculateTokenCost(
  model: string | undefined,
  inputTokens: number = 0,
  outputTokens: number = 0,
  cacheReadTokens: number = 0,
  cacheCreationTokens: number = 0
): number {
  const pricing = model ? MODEL_PRICING[model] : MODEL_PRICING["claude-3-5-sonnet-20241022"];

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheReadCost = pricing.cacheRead ? (cacheReadTokens / 1_000_000) * pricing.cacheRead : 0;
  const cacheCreationCost = pricing.cacheCreation ? (cacheCreationTokens / 1_000_000) * pricing.cacheCreation : 0;

  return inputCost + outputCost + cacheReadCost + cacheCreationCost;
}

/**
 * Format a cost as USD
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `<$0.01`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Format a token count with K/M suffix
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

interface TokenUsageDisplayProps {
  /** Message to display token usage for */
  message: Message;
  /** Whether to show the full details or compact view */
  detailed?: boolean;
}

/**
 * Display token usage for a single message
 */
export function TokenUsageDisplay({ message, detailed = false }: TokenUsageDisplayProps) {
  const { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, model } = message.metadata || {};

  const hasTokenData = inputTokens !== undefined || outputTokens !== undefined;

  const totalTokens = useMemo(() => {
    return (inputTokens || 0) + (outputTokens || 0) + (cacheReadTokens || 0) + (cacheCreationTokens || 0);
  }, [inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens]);

  const cost = useMemo(() => {
    return calculateTokenCost(model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens);
  }, [model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens]);

  if (!hasTokenData || totalTokens === 0) {
    return null;
  }

  if (detailed) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <strong>{formatTokenCount(totalTokens)}</strong> tokens
        </span>
        {inputTokens !== undefined && inputTokens > 0 && (
          <span className="text-neutral-400 dark:text-neutral-500">
            In: <strong>{formatTokenCount(inputTokens)}</strong>
          </span>
        )}
        {outputTokens !== undefined && outputTokens > 0 && (
          <span className="text-neutral-400 dark:text-neutral-500">
            Out: <strong>{formatTokenCount(outputTokens)}</strong>
          </span>
        )}
        {cacheReadTokens !== undefined && cacheReadTokens > 0 && (
          <span className="text-green-600 dark:text-green-400" title="Cache read tokens">
            Cache R: <strong>{formatTokenCount(cacheReadTokens)}</strong>
          </span>
        )}
        {cacheCreationTokens !== undefined && cacheCreationTokens > 0 && (
          <span className="text-amber-600 dark:text-amber-400" title="Cache creation tokens">
            Cache C: <strong>{formatTokenCount(cacheCreationTokens)}</strong>
          </span>
        )}
        <span className="text-blue-600 dark:text-blue-400">
          {formatCost(cost)}
        </span>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 ml-2" title={`${totalTokens.toLocaleString()} tokens • ${formatCost(cost)}`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      {formatTokenCount(totalTokens)}
      {cost > 0 && <span className="text-neutral-400 dark:text-neutral-500">({formatCost(cost)})</span>}
    </span>
  );
}

interface SessionTokenStatsProps {
  /** Session to calculate stats for */
  session: SessionWithMessages | null;
  /** Whether to show the expanded view with per-message breakdown */
  showBreakdown?: boolean;
}

/**
 * Display cumulative token usage for a session
 */
export function SessionTokenStats({ session, showBreakdown = false }: SessionTokenStatsProps) {
  const stats = useMemo(() => {
    if (!session) {
      return { totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, totalCacheCreationTokens: 0, totalCost: 0, totalTokens: 0 };
    }

    // Use session metadata if available (faster)
    if (session.metadata?.totalTokens !== undefined) {
      return {
        totalInputTokens: 0, // Not stored separately
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheCreationTokens: 0,
        totalCost: session.metadata.totalCost || 0,
        totalTokens: session.metadata.totalTokens,
      };
    }

    // Calculate from messages
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalCost = 0;

    for (const message of session.messages || []) {
      const metadata = message.metadata;
      if (metadata) {
        totalInputTokens += metadata.inputTokens || 0;
        totalOutputTokens += metadata.outputTokens || 0;
        totalCacheReadTokens += metadata.cacheReadTokens || 0;
        totalCacheCreationTokens += metadata.cacheCreationTokens || 0;
        totalCost += calculateTokenCost(
          metadata.model,
          metadata.inputTokens,
          metadata.outputTokens,
          metadata.cacheReadTokens,
          metadata.cacheCreationTokens
        );
      }
    }

    const totalTokens = totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheCreationTokens;

    return {
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheCreationTokens,
      totalCost,
      totalTokens,
    };
  }, [session]);

  if (!session || stats.totalTokens === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="font-medium">
          {formatTokenCount(stats.totalTokens)} tokens
        </span>
        <span className="text-blue-600 dark:text-blue-400">
          {formatCost(stats.totalCost)}
        </span>
      </div>
      {showBreakdown && stats.totalInputTokens > 0 && (
        <div className="flex gap-3 text-neutral-400 dark:text-neutral-500 ml-6">
          <span>Input: {formatTokenCount(stats.totalInputTokens)}</span>
          <span>Output: {formatTokenCount(stats.totalOutputTokens)}</span>
          {stats.totalCacheReadTokens > 0 && (
            <span className="text-green-600 dark:text-green-400">Cache R: {formatTokenCount(stats.totalCacheReadTokens)}</span>
          )}
          {stats.totalCacheCreationTokens > 0 && (
            <span className="text-amber-600 dark:text-amber-400">Cache C: {formatTokenCount(stats.totalCacheCreationTokens)}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get token usage statistics for a session
 */
export function useSessionTokenStats(session: SessionWithMessages | null) {
  return useMemo(() => {
    if (!session) {
      return { totalTokens: 0, totalCost: 0, messageCount: 0 };
    }

    const messages = session.messages || [];
    let totalTokens = 0;
    let totalCost = 0;

    for (const message of messages) {
      const metadata = message.metadata;
      if (metadata) {
        const messageTokens = (metadata.inputTokens || 0) + (metadata.outputTokens || 0) + (metadata.cacheReadTokens || 0) + (metadata.cacheCreationTokens || 0);
        totalTokens += messageTokens;
        totalCost += calculateTokenCost(
          metadata.model,
          metadata.inputTokens,
          metadata.outputTokens,
          metadata.cacheReadTokens,
          metadata.cacheCreationTokens
        );
      }
    }

    return {
      totalTokens,
      totalCost,
      messageCount: messages.length,
    };
  }, [session]);
}

'use client';

/**
 * Chat Context - Provides global state management for chat sessions
 * This is a client-side context that interfaces with the server-side storage
 */

import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';
import type {
  Session,
  SessionWithMessages,
  Message,
  ContentBlock,
  SessionFilters,
  PaginatedSessions,
  FileAttachment,
  SessionMetadata,
  MessageMetadata,
} from '../types/chat';
import { useCurrentSessionState } from '../storage/ui-state';

/**
 * Token pricing per 1M tokens (in USD)
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
function calculateTokenCost(
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
 * Calculate token statistics from a list of messages
 */
function calculateMessageStats(messages: Message[]) {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;
  let totalCost = 0;

  for (const message of messages) {
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

  return {
    totalTokens: totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheCreationTokens,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    totalCacheCreationTokens,
    totalCost,
  };
}

// ==================== Types ====================

export interface ChatContextValue {
  // Session state
  sessions: Session[];
  currentSession: SessionWithMessages | null;
  currentMessageId: string | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    total: number;
    hasMore: boolean;
    offset: number;
  };

  // Token statistics for current session
  tokenStats: {
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheReadTokens: number;
    totalCacheCreationTokens: number;
    totalCost: number;
  };

  // Session operations
  createSession: (title: string, metadata?: SessionMetadata) => Promise<Session | null>;
  loadSession: (sessionId: string, messageId?: string) => Promise<void>;
  updateSession: (
    sessionId: string,
    updates: Partial<Pick<Session, 'title'>> & { metadata?: Partial<SessionMetadata> }
  ) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  listSessions: (filters?: SessionFilters) => Promise<void>;
  loadMoreSessions: () => Promise<void>;

  // Message operations
  addMessage: (
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: ContentBlock[],
    metadata?: MessageMetadata,
    fileAttachments?: FileAttachment[],
    thinking?: string
  ) => Promise<Message | null>;
  updateMessage: (
    messageId: string,
    updates: Partial<{
      content: ContentBlock[];
      thinking: string;
      metadata: Partial<MessageMetadata>;
    }>
  ) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;

  // Search
  searchSessions: (query: string) => Promise<Session[]>;

  // Utility
  clearCurrentSession: () => void;
  clearCurrentMessageId: () => void;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// ==================== Provider ====================

interface ChatProviderProps {
  children: React.ReactNode;
  apiBaseUrl?: string;
}

export function ChatProvider({ children, apiBaseUrl = '/api/chat-history' }: ChatProviderProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionWithMessages | null>(null);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    hasMore: false,
    offset: 0,
  });

  // UI state persistence for current session ID
  const { get: getSavedSessionId, set: setSavedSessionId } = useCurrentSessionState();

  // Fetch wrapper with error handling
  const fetchWithError = useCallback(async (input: RequestInfo, init?: RequestInit) => {
    try {
      const response = await fetch(input, init);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(message);
      throw e;
    }
  }, []);

  // ==================== Session Operations ====================

  const createSession = useCallback(
    async (title: string, metadata?: SessionMetadata): Promise<Session | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithError(`${apiBaseUrl}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, metadata }),
        });

        const session = (await response.json()) as Session;

        // Add to sessions list
        setSessions((prev) => [session, ...prev]);

        return session;
      } catch {
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, fetchWithError]
  );

  const loadSession = useCallback(
    async (sessionId: string, messageId?: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithError(`${apiBaseUrl}/sessions/${sessionId}?include=messages`);
        const session = (await response.json()) as SessionWithMessages;
        setCurrentSession(session);
        // Set the message ID to scroll to after loading
        if (messageId) {
          setCurrentMessageId(messageId);
        } else {
          setCurrentMessageId(null);
        }
        // Persist the current session ID
        setSavedSessionId(sessionId);
      } catch {
        setCurrentSession(null);
        setCurrentMessageId(null);
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, fetchWithError, setSavedSessionId]
  );

  const updateSession = useCallback(
    async (
      sessionId: string,
      updates: Partial<Pick<Session, 'title'>> & { metadata?: Partial<SessionMetadata> }
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithError(`${apiBaseUrl}/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        const updated = (await response.json()) as Session;

        // Update sessions list
        setSessions((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );

        // Update current session if it's the same
        if (currentSession?.id === updated.id) {
          setCurrentSession((prev) =>
            prev ? { ...prev, ...updated } : null
          );
        }

        return true;
      } catch {
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, fetchWithError, currentSession]
  );

  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await fetchWithError(`${apiBaseUrl}/sessions/${sessionId}`, {
          method: 'DELETE',
        });

        // Remove from sessions list
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        // Clear current session if it's the deleted one
        if (currentSession?.id === sessionId) {
          setCurrentSession(null);
        }

        return true;
      } catch {
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, fetchWithError, currentSession]
  );

  const listSessions = useCallback(
    async (filters: SessionFilters = {}): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (filters.limit) params.append('limit', String(filters.limit));
        if (filters.offset !== undefined) params.append('offset', String(filters.offset));
        if (filters.sortBy) params.append('sortBy', filters.sortBy);
        if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
        if (filters.searchQuery) params.append('searchQuery', filters.searchQuery);

        const response = await fetchWithError(
          `${apiBaseUrl}/sessions?${params.toString()}`
        );

        const data = (await response.json()) as PaginatedSessions;

        setSessions(data.sessions);
        setPagination({
          total: data.total,
          hasMore: data.hasMore,
          offset: filters.offset || 0,
        });
      } catch {
        setSessions([]);
        setPagination({ total: 0, hasMore: false, offset: 0 });
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, fetchWithError]
  );

  const loadMoreSessions = useCallback(async (): Promise<void> => {
    if (isLoading || !pagination.hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('limit', '50');
      params.append('offset', String(pagination.offset + sessions.length));

      const response = await fetchWithError(
        `${apiBaseUrl}/sessions?${params.toString()}`
      );

      const data = (await response.json()) as PaginatedSessions;

      setSessions((prev) => [...prev, ...data.sessions]);
      setPagination({
        total: data.total,
        hasMore: data.hasMore,
        offset: pagination.offset + sessions.length,
      });
    } catch {
      // Error already set by fetchWithError
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, fetchWithError, isLoading, pagination.hasMore, pagination.offset, sessions.length]);

  // ==================== Message Operations ====================

  const addMessage = useCallback(
    async (
      sessionId: string,
      role: 'user' | 'assistant' | 'system',
      content: ContentBlock[],
      metadata?: MessageMetadata,
      fileAttachments?: FileAttachment[],
      thinking?: string
    ): Promise<Message | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithError(`${apiBaseUrl}/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, content, metadata, fileAttachments, thinking }),
        });

        const message = (await response.json()) as Message;

        // Add to current session if it's the same
        if (currentSession?.id === sessionId) {
          setCurrentSession((prev) =>
            prev ? { ...prev, messages: [...prev.messages, message] } : null
          );
        }

        return message;
      } catch {
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, fetchWithError, currentSession]
  );

  const updateMessage = useCallback(
    async (
      messageId: string,
      updates: Partial<{
        content: ContentBlock[];
        thinking: string;
        metadata: Partial<MessageMetadata>;
      }>
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithError(`${apiBaseUrl}/messages/${messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        const updated = (await response.json()) as Message;

        // Update in current session
        if (currentSession) {
          setCurrentSession((prev) =>
            prev
              ? {
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === updated.id ? updated : m
                  ),
                }
              : null
          );
        }

        return true;
      } catch {
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, fetchWithError, currentSession]
  );

  const deleteMessage = useCallback(
    async (messageId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await fetchWithError(`${apiBaseUrl}/messages/${messageId}`, {
          method: 'DELETE',
        });

        // Remove from current session
        if (currentSession) {
          setCurrentSession((prev) =>
            prev
              ? {
                  ...prev,
                  messages: prev.messages.filter((m) => m.id !== messageId),
                }
              : null
          );
        }

        return true;
      } catch {
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, fetchWithError, currentSession]
  );

  // ==================== Search ====================

  const searchSessions = useCallback(
    async (query: string): Promise<Session[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithError(
          `${apiBaseUrl}/search?q=${encodeURIComponent(query)}`
        );

        return (await response.json()) as Session[];
      } catch {
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, fetchWithError]
  );

  // ==================== Utility ====================

  const clearCurrentSession = useCallback(() => {
    setCurrentSession(null);
    // Clear the saved session ID
    setSavedSessionId(null);
  }, [setSavedSessionId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearCurrentMessageId = useCallback(() => {
    setCurrentMessageId(null);
  }, []);

  // Load sessions on mount
  useEffect(() => {
    listSessions({ limit: 50, sortBy: 'updatedAt', sortOrder: 'desc' });
  }, [listSessions]);

  // Restore the last active session on mount
  useEffect(() => {
    const savedSessionId = getSavedSessionId();
    if (savedSessionId && sessions.length > 0) {
      // Only load if the session exists in the current list
      if (sessions.find(s => s.id === savedSessionId)) {
        loadSession(savedSessionId);
      }
    }
  }, [sessions]); // Only run when sessions are loaded

  // ==================== Context Value ====================

  // Calculate token statistics for current session
  const tokenStats = useMemo(() => {
    return calculateMessageStats(currentSession?.messages || []);
  }, [currentSession?.messages]);

  const value: ChatContextValue = {
    sessions,
    currentSession,
    currentMessageId,
    isLoading,
    error,
    pagination,
    tokenStats,
    createSession,
    loadSession,
    updateSession,
    deleteSession,
    listSessions,
    loadMoreSessions,
    addMessage,
    updateMessage,
    deleteMessage,
    searchSessions,
    clearCurrentSession,
    clearCurrentMessageId,
    clearError,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// ==================== Hook ====================

/**
 * Hook to access the chat context
 */
export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}

// ==================== Utility Hooks ====================

/**
 * Hook for managing a single chat session
 */
export function useChatSession(sessionId: string | null) {
  const { currentSession, loadSession, clearCurrentSession, isLoading, error } =
    useChatContext();

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else {
      clearCurrentSession();
    }
  }, [sessionId, loadSession, clearCurrentSession]);

  return {
    session: sessionId === currentSession?.id ? currentSession : null,
    isLoading,
    error,
  };
}

/**
 * Hook for sending messages in the current session
 */
export function useSendMessage() {
  const { currentSession, addMessage, isLoading } = useChatContext();

  const sendMessage = useCallback(
    async (
      content: string,
      fileAttachments?: FileAttachment[]
    ): Promise<Message | null> => {
      if (!currentSession) {
        throw new Error('No active session');
      }

      const contentBlock: ContentBlock = { type: 'text', text: content };

      return addMessage(
        currentSession.id,
        'user',
        [contentBlock],
        { timestamp: Date.now() },
        fileAttachments
      );
    },
    [currentSession, addMessage]
  );

  return {
    sendMessage,
    isLoading,
    hasSession: !!currentSession,
  };
}

/**
 * Hook for managing sessions list
 */
export function useSessionsList(filters?: SessionFilters) {
  const { sessions, listSessions, loadMoreSessions, isLoading, pagination } =
    useChatContext();

  useEffect(() => {
    listSessions(filters);
  }, [filters, listSessions]);

  return {
    sessions,
    isLoading,
    pagination,
    loadMore: loadMoreSessions,
    refresh: () => listSessions(filters),
  };
}

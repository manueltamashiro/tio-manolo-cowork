/**
 * Chat history storage types
 * Defines the core data structures for storing and retrieving chat sessions
 */

/**
 * Message role types - represents who sent the message
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Diff metadata for file changes
 */
export interface DiffMetadata {
  /** Path to the backup file (original content) */
  backupPath?: string;
  /** Path to the current file (new content) */
  filePath?: string;
  /** Name of the file */
  fileName?: string;
  /** Whether the file was created or overwritten */
  action?: 'created' | 'overwritten';
}

/**
 * Image source types - can be a URL or base64 data
 */
export type ImageSource =
  | { type: 'url'; url: string }
  | { type: 'base64'; mediaType: string; data: string };

/**
 * Message content types - supports text, images, and tool use
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ImageSource }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content?: string; is_error?: boolean; diffMetadata?: DiffMetadata };

/**
 * File attachment reference in a message
 */
export interface FileAttachment {
  id: string;
  filePath: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
}

/**
 * Message metadata for tracking tokens and timing
 */
export interface MessageMetadata {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  timestamp: number;
  model?: string;
  stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
}

/**
 * Core message structure stored in the database
 */
export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: ContentBlock[];
  metadata?: MessageMetadata;
  fileAttachments?: FileAttachment[];
  thinking?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Session metadata for tracking conversation context
 */
export interface SessionMetadata {
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  workspacePath?: string;
  totalTokens?: number;
  totalCost?: number;
}

/**
 * Session/Conversation structure
 */
export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  metadata?: SessionMetadata;
  messageCount?: number;
  lastMessagePreview?: string;
}

/**
 * Session with messages included (for full conversation retrieval)
 */
export interface SessionWithMessages extends Session {
  messages: Message[];
}

/**
 * Search filters for retrieving sessions
 */
export interface SessionFilters {
  limit?: number;
  offset?: number;
  startDate?: number;
  endDate?: number;
  searchQuery?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result for session queries
 */
export interface PaginatedSessions {
  sessions: Session[];
  total: number;
  hasMore: boolean;
}

/**
 * Database export format for sessions
 */
export interface SessionExport {
  version: string;
  exportedAt: number;
  sessions: SessionWithMessages[];
}

/**
 * Search match highlight information
 */
export interface SearchMatch {
  /** The matched text */
  text: string;
  /** Character offset where the match starts */
  offset: number;
  /** Length of the match */
  length: number;
}

/**
 * Message search result with match information
 */
export interface MessageSearchResult {
  messageId: string;
  sessionId: string;
  sessionTitle: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  /** Extracted text content (without JSON) for preview */
  textContent: string;
  /** Match highlights in the content */
  matches: SearchMatch[];
  /** Relevance score from FTS */
  rank: number;
}

/**
 * File reference search result
 */
export interface FileSearchResult {
  fileId: string;
  messageId: string;
  sessionId: string;
  sessionTitle: string;
  fileName: string;
  filePath: string;
  /** Match highlights in the file name/path */
  matches: SearchMatch[];
  /** Relevance score from FTS */
  rank: number;
}

/**
 * Full-text search result
 */
export interface SearchResults {
  /** Sessions matching the query (by title) */
  sessions: Array<{
    session: Session;
    rank: number;
    matches: SearchMatch[];
  }>;
  /** Individual messages matching the query */
  messages: MessageSearchResult[];
  /** File references matching the query */
  files: FileSearchResult[];
  /** Total number of results */
  totalResults: number;
  /** The query that was executed */
  query: string;
}

/**
 * Search options for advanced queries
 */
export interface SearchOptions {
  /** The search query string */
  query: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Whether to include messages in results (default: true) */
  includeMessages?: boolean;
  /** Whether to include files in results (default: true) */
  includeFiles?: boolean;
  /** Filter by message role (user/assistant/system) */
  role?: MessageRole;
  /** Filter by session ID (search within a specific session) */
  sessionId?: string;
  /** Sort order: 'rank' (relevance) or 'date' */
  sortBy?: 'rank' | 'date';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * System prompt template for reusable system prompts
 */
export interface SystemPromptTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  tags?: string[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Create/update system prompt template input
 */
export interface SystemPromptTemplateInput {
  name: string;
  content: string;
  category?: string;
  tags?: string[];
  isDefault?: boolean;
}

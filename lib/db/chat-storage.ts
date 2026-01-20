/**
 * Chat History Storage Service
 * Provides a high-level API for managing chat sessions and messages in SQLite
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { runMigrations } from './schema';
import type {
  Session,
  SessionWithMessages,
  Message,
  FileAttachment,
  SessionFilters,
  PaginatedSessions,
  SessionMetadata,
  MessageMetadata,
  ContentBlock,
  SearchResults,
  SearchOptions,
  MessageSearchResult,
  FileSearchResult,
  SearchMatch,
} from '../types/chat';

export interface ChatStorageOptions {
  dbPath?: string;
  dataDir?: string;
}

/**
 * ChatStorage class - main service for chat history persistence
 */
export class ChatStorage {
  private db: Database.Database;

  constructor(options: ChatStorageOptions = {}) {
    const dataDir = options.dataDir || this.getDefaultDataDir();
    const dbPath = options.dbPath || join(dataDir, 'chat-history.db');

    // Ensure data directory exists
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Run migrations
    runMigrations(this.db);
  }

  /**
   * Get the default data directory for storing the database
   */
  private getDefaultDataDir(): string {
    if (typeof process !== 'undefined' && process.env) {
      // In Electron, this would be app.getPath('userData')
      // For web/Next.js, use a local directory
      return join(process.cwd(), '.data');
    }
    return join(process.cwd(), '.data');
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  // ==================== Session Operations ====================

  /**
   * Create a new chat session
   */
  createSession(
    title: string,
    metadata?: SessionMetadata
  ): Session {
    const id = this.generateId();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        id, title, created_at, updated_at,
        model, system_prompt, temperature, max_tokens,
        workspace_path, total_tokens, total_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      title,
      now,
      now,
      metadata?.model || null,
      metadata?.systemPrompt || null,
      metadata?.temperature || null,
      metadata?.maxTokens || null,
      metadata?.workspacePath || null,
      metadata?.totalTokens || 0,
      metadata?.totalCost || 0
    );

    return {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      metadata,
    };
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT
        id, title, created_at, updated_at,
        model, system_prompt, temperature, max_tokens,
        workspace_path, total_tokens, total_cost
      FROM sessions
      WHERE id = ?
    `);

    const row = stmt.get(id) as
      | {
          id: string;
          title: string;
          created_at: number;
          updated_at: number;
          model: string | null;
          system_prompt: string | null;
          temperature: number | null;
          max_tokens: number | null;
          workspace_path: string | null;
          total_tokens: number;
          total_cost: number;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: {
        model: row.model || undefined,
        systemPrompt: row.system_prompt || undefined,
        temperature: row.temperature || undefined,
        maxTokens: row.max_tokens || undefined,
        workspacePath: row.workspace_path || undefined,
        totalTokens: row.total_tokens,
        totalCost: row.total_cost,
      },
    };
  }

  /**
   * Get a session with all its messages
   */
  getSessionWithMessages(id: string): SessionWithMessages | null {
    const session = this.getSession(id);
    if (!session) return null;

    const messages = this.getMessagesBySession(id);

    return {
      ...session,
      messages,
    };
  }

  /**
   * List sessions with optional filters
   */
  listSessions(filters: SessionFilters = {}): PaginatedSessions {
    const {
      limit = 50,
      offset = 0,
      startDate,
      endDate,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = filters;

    let query = `
      SELECT
        id, title, created_at, updated_at,
        (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id) as message_count,
        (
          SELECT content FROM messages
          WHERE session_id = sessions.id
          ORDER BY created_at DESC
          LIMIT 1
        ) as last_message_content
      FROM sessions
      WHERE 1=1
    `;

    const params: (string | number)[] = [];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    // Search support using LIKE queries
    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      query = `
        SELECT DISTINCT
          s.id, s.title, s.created_at, s.updated_at,
          (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count,
          (
            SELECT content FROM messages
            WHERE session_id = s.id
            ORDER BY created_at DESC
            LIMIT 1
          ) as last_message_content
        FROM sessions s
        LEFT JOIN messages m ON m.session_id = s.id
        WHERE LOWER(s.title) LIKE LOWER(?) OR LOWER(m.content) LIKE LOWER(?)
        ORDER BY ${this.sortColumnToDb(sortBy)} ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      params.push(searchTerm, searchTerm, limit, offset);
    } else {
      query += ` ORDER BY ${this.sortColumnToDb(sortBy)} ${sortOrder.toUpperCase()}`;
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as {
      id: string;
      title: string;
      created_at: number;
      updated_at: number;
      message_count: number;
      last_message_content: string | null;
    }[];

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM sessions';
    const countParams: (string | number)[] = [];

    if (startDate) {
      countQuery += ' WHERE created_at >= ?';
      countParams.push(startDate);
    }
    if (endDate) {
      countQuery += startDate ? ' AND created_at <= ?' : ' WHERE created_at <= ?';
      countParams.push(endDate);
    }

    const countStmt = this.db.prepare(countQuery);
    const totalResult = countStmt.get(...countParams) as { count: number };
    const total = totalResult.count;

    return {
      sessions: rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        messageCount: row.message_count,
        lastMessagePreview: this.extractPreviewFromContent(row.last_message_content),
      })),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  /**
   * Extract a text preview from JSON content blocks
   */
  private extractPreviewFromContent(contentJson: string | null): string | undefined {
    if (!contentJson) return undefined;
    try {
      const content = JSON.parse(contentJson) as ContentBlock[];
      const firstTextBlock = content.find((block) => block.type === 'text');
      if (firstTextBlock && 'text' in firstTextBlock) {
        const text = firstTextBlock.text;
        // Truncate to 80 characters
        return text.length > 80 ? text.substring(0, 80) + '...' : text;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  /**
   * Update a session
   */
  updateSession(
    id: string,
    updates: Partial<Pick<Session, 'title'>> & {
      metadata?: Partial<SessionMetadata>;
    }
  ): boolean {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.title !== undefined) {
      sets.push('title = ?');
      params.push(updates.title);
    }

    if (updates.metadata?.model !== undefined) {
      sets.push('model = ?');
      params.push(updates.metadata.model);
    }

    if (updates.metadata?.systemPrompt !== undefined) {
      sets.push('system_prompt = ?');
      params.push(updates.metadata.systemPrompt);
    }

    if (updates.metadata?.temperature !== undefined) {
      sets.push('temperature = ?');
      params.push(updates.metadata.temperature);
    }

    if (updates.metadata?.maxTokens !== undefined) {
      sets.push('max_tokens = ?');
      params.push(updates.metadata.maxTokens);
    }

    if (updates.metadata?.workspacePath !== undefined) {
      sets.push('workspace_path = ?');
      params.push(updates.metadata.workspacePath);
    }

    if (updates.metadata?.totalTokens !== undefined) {
      sets.push('total_tokens = ?');
      params.push(updates.metadata.totalTokens);
    }

    if (updates.metadata?.totalCost !== undefined) {
      sets.push('total_cost = ?');
      params.push(updates.metadata.totalCost);
    }

    sets.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    const stmt = this.db.prepare(`
      UPDATE sessions
      SET ${sets.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...params);
    return result.changes > 0;
  }

  /**
   * Delete a session and all its messages
   */
  deleteSession(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ==================== Message Operations ====================

  /**
   * Add a message to a session
   */
  addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: ContentBlock[],
    metadata?: MessageMetadata,
    fileAttachments?: FileAttachment[],
    thinking?: string
  ): Message | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const id = this.generateId();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, session_id, role, content, thinking,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
        model, stop_reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      sessionId,
      role,
      JSON.stringify(content),
      thinking || null,
      metadata?.inputTokens || 0,
      metadata?.outputTokens || 0,
      metadata?.cacheReadTokens || 0,
      metadata?.cacheCreationTokens || 0,
      metadata?.model || null,
      metadata?.stopReason || null,
      now,
      now
    );

    // Add file attachments
    if (fileAttachments && fileAttachments.length > 0) {
      const attachStmt = this.db.prepare(`
        INSERT INTO file_attachments (id, message_id, file_path, file_name, file_type, file_size)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const attachment of fileAttachments) {
        attachStmt.run(
          attachment.id || this.generateId(),
          id,
          attachment.filePath,
          attachment.fileName,
          attachment.fileType || null,
          attachment.fileSize || null
        );
      }
    }

    // Update session timestamp and token counts
    this.updateSessionTokens(sessionId, metadata);

    return {
      id,
      sessionId,
      role,
      content,
      metadata,
      fileAttachments,
      thinking,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get a message by ID
   */
  getMessage(id: string): Message | null {
    const stmt = this.db.prepare(`
      SELECT
        id, session_id, role, content, thinking,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
        model, stop_reason, created_at, updated_at
      FROM messages
      WHERE id = ?
    `);

    const row = stmt.get(id) as
      | {
          id: string;
          session_id: string;
          role: string;
          content: string;
          thinking: string | null;
          input_tokens: number;
          output_tokens: number;
          cache_read_tokens: number;
          cache_creation_tokens: number;
          model: string | null;
          stop_reason: string | null;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return null;

    const fileAttachments = this.getFileAttachments(id);

    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: JSON.parse(row.content),
      thinking: row.thinking || undefined,
      metadata: {
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cacheReadTokens: row.cache_read_tokens,
        cacheCreationTokens: row.cache_creation_tokens,
        timestamp: row.created_at,
        model: row.model || undefined,
        stopReason: row.stop_reason as any,
      },
      fileAttachments,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all messages for a session
   */
  getMessagesBySession(sessionId: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT
        id, session_id, role, content, thinking,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
        model, stop_reason, created_at, updated_at
      FROM messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(sessionId) as {
      id: string;
      session_id: string;
      role: string;
      content: string;
      thinking: string | null;
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
      cache_creation_tokens: number;
      model: string | null;
      stop_reason: string | null;
      created_at: number;
      updated_at: number;
    }[];

    return rows.map((row) => {
      const fileAttachments = this.getFileAttachments(row.id);

      return {
        id: row.id,
        sessionId: row.session_id,
        role: row.role as 'user' | 'assistant' | 'system',
        content: JSON.parse(row.content),
        thinking: row.thinking || undefined,
        metadata: {
          inputTokens: row.input_tokens,
          outputTokens: row.output_tokens,
          cacheReadTokens: row.cache_read_tokens,
          cacheCreationTokens: row.cache_creation_tokens,
          timestamp: row.created_at,
          model: row.model || undefined,
          stopReason: row.stop_reason as any,
        },
        fileAttachments,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  /**
   * Update a message
   */
  updateMessage(
    id: string,
    updates: Partial<{
      content: ContentBlock[];
      thinking: string;
      metadata: Partial<MessageMetadata>;
    }>
  ): boolean {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.content !== undefined) {
      sets.push('content = ?');
      params.push(JSON.stringify(updates.content));
    }

    if (updates.thinking !== undefined) {
      sets.push('thinking = ?');
      params.push(updates.thinking);
    }

    if (updates.metadata?.inputTokens !== undefined) {
      sets.push('input_tokens = ?');
      params.push(updates.metadata.inputTokens);
    }

    if (updates.metadata?.outputTokens !== undefined) {
      sets.push('output_tokens = ?');
      params.push(updates.metadata.outputTokens);
    }

    if (updates.metadata?.model !== undefined) {
      sets.push('model = ?');
      params.push(updates.metadata.model);
    }

    if (updates.metadata?.stopReason !== undefined) {
      sets.push('stop_reason = ?');
      params.push(updates.metadata.stopReason);
    }

    sets.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    const stmt = this.db.prepare(`
      UPDATE messages
      SET ${sets.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...params);
    return result.changes > 0;
  }

  /**
   * Delete a message
   */
  deleteMessage(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ==================== File Attachment Operations ====================

  /**
   * Get file attachments for a message
   */
  private getFileAttachments(messageId: string): FileAttachment[] {
    const stmt = this.db.prepare(`
      SELECT id, file_path, file_name, file_type, file_size
      FROM file_attachments
      WHERE message_id = ?
    `);

    const rows = stmt.all(messageId) as {
      id: string;
      file_path: string;
      file_name: string;
      file_type: string | null;
      file_size: number | null;
    }[];

    return rows.map((row) => ({
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      fileType: row.file_type || undefined,
      fileSize: row.file_size || undefined,
    }));
  }

  // ==================== Search Operations ====================

  /**
   * Search sessions by title and message content (legacy method - uses LIKE queries)
   * @deprecated Use fullTextSearch instead for better results
   */
  searchSessions(query: string, limit = 20): Session[] {
    // First try to use FTS5 if available, fall back to LIKE queries
    try {
      const ftsResults = this.fullTextSearch({ query, limit, includeMessages: false, includeFiles: false });
      return ftsResults.sessions.map((r) => r.session);
    } catch {
      // Fall back to LIKE queries if FTS is not available
      const searchTerm = `%${query}%`;
      const stmt = this.db.prepare(`
        SELECT DISTINCT
          s.id, s.title, s.created_at, s.updated_at,
          (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count
        FROM sessions s
        LEFT JOIN messages m ON m.session_id = s.id
        WHERE LOWER(s.title) LIKE LOWER(?) OR LOWER(m.content) LIKE LOWER(?)
        ORDER BY s.updated_at DESC
        LIMIT ?
      `);

      const rows = stmt.all(searchTerm, searchTerm, limit) as {
        id: string;
        title: string;
        created_at: number;
        updated_at: number;
        message_count: number;
      }[];

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        messageCount: row.message_count,
      }));
    }
  }

  /**
   * Perform full-text search across sessions, messages, and file attachments
   * Uses SQLite FTS5 for fast, relevance-ranked search results
   */
  fullTextSearch(options: SearchOptions): SearchResults {
    const {
      query,
      limit = 50,
      offset = 0,
      includeMessages = true,
      includeFiles = true,
      role,
      sessionId,
      sortBy = 'rank',
      sortOrder = 'desc',
    } = options;

    // Prepare search query for FTS5 (escape special characters)
    const ftsQuery = this.prepareFtsQuery(query);

    const sessions: Array<{ session: Session; rank: number; matches: SearchMatch[] }> = [];
    const messages: MessageSearchResult[] = [];
    const files: FileSearchResult[] = [];

    // Search in sessions (by title)
    const sessionStmt = this.db.prepare(`
      SELECT
        s.id, s.title, s.created_at, s.updated_at,
        sft.sessions_fts as rank,
        snippet(sessions_fts, 1, '<mark>', '</mark>', '...', 30) as highlighted_title
      FROM sessions s
      JOIN sessions_fts sft ON sft.session_id = s.rowid
      WHERE sessions_fts MATCH ?
      ORDER BY rank ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `);

    try {
      const sessionRows = sessionStmt.all(ftsQuery, limit, offset) as {
        id: string;
        title: string;
        created_at: number;
        updated_at: number;
        rank: number;
        highlighted_title: string;
      }[];

      for (const row of sessionRows) {
        sessions.push({
          session: {
            id: row.id,
            title: row.title,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
          rank: row.rank,
          matches: this.extractSearchMatches(row.title, query),
        });
      }
    } catch {
      // FTS might not be available, skip this part
    }

    // Search in messages
    if (includeMessages) {
      let messageQuery = `
        SELECT
          m.id as message_id,
          m.session_id,
          s.title as session_title,
          m.role,
          m.content,
          m.created_at,
          mft.messages_fts as rank,
          snippet(messages_fts, 1, '<mark>', '</mark>', '...', 50) as highlighted_content
        FROM messages m
        JOIN sessions s ON s.id = m.session_id
        JOIN messages_fts mft ON mft.message_id = m.rowid
        WHERE messages_fts MATCH ?
      `;

      const params: any[] = [ftsQuery];

      if (role) {
        messageQuery += ` AND m.role = ?`;
        params.push(role);
      }

      if (sessionId) {
        messageQuery += ` AND m.session_id = ?`;
        params.push(sessionId);
      }

      messageQuery += ` ORDER BY rank ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      try {
        const messageStmt = this.db.prepare(messageQuery);
        const messageRows = messageStmt.all(...params) as {
          message_id: string;
          session_id: string;
          session_title: string;
          role: string;
          content: string;
          created_at: number;
          rank: number;
          highlighted_content: string;
        }[];

        for (const row of messageRows) {
          const textContent = this.extractTextFromContent(row.content);
          messages.push({
            messageId: row.message_id,
            sessionId: row.session_id,
            sessionTitle: row.session_title,
            role: row.role as 'user' | 'assistant' | 'system',
            content: row.content,
            textContent,
            createdAt: row.created_at,
            matches: this.extractSearchMatches(textContent, query),
            rank: row.rank,
          });
        }
      } catch {
        // FTS might not be available
      }
    }

    // Search in file attachments
    if (includeFiles) {
      let fileQuery = `
        SELECT
          fa.id as file_id,
          fa.message_id,
          m.session_id,
          s.title as session_title,
          fa.file_name,
          fa.file_path,
          fta.file_attachments_fts as rank
        FROM file_attachments fa
        JOIN messages m ON m.id = fa.message_id
        JOIN sessions s ON s.id = m.session_id
        JOIN file_attachments_fts fta ON fta.attachment_id = fa.rowid
        WHERE file_attachments_fts MATCH ?
      `;

      const params: any[] = [ftsQuery];

      if (sessionId) {
        fileQuery += ` AND m.session_id = ?`;
        params.push(sessionId);
      }

      fileQuery += ` ORDER BY rank ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      try {
        const fileStmt = this.db.prepare(fileQuery);
        const fileRows = fileStmt.all(...params) as {
          file_id: string;
          message_id: string;
          session_id: string;
          session_title: string;
          file_name: string;
          file_path: string;
          rank: number;
        }[];

        for (const row of fileRows) {
          const searchText = `${row.file_name} ${row.file_path}`;
          files.push({
            fileId: row.file_id,
            messageId: row.message_id,
            sessionId: row.session_id,
            sessionTitle: row.session_title,
            fileName: row.file_name,
            filePath: row.file_path,
            matches: this.extractSearchMatches(searchText, query),
            rank: row.rank,
          });
        }
      } catch {
        // FTS might not be available
      }
    }

    return {
      sessions,
      messages,
      files,
      totalResults: sessions.length + messages.length + files.length,
      query,
    };
  }

  /**
   * Prepare a search query for FTS5
   * Escapes special characters and wraps phrases for exact matching
   */
  private prepareFtsQuery(query: string): string {
    // Remove quotes and escape special FTS5 characters
    const cleaned = query
      .replace(/[+\-<>~()]/g, '')
      .replace(/"/g, '')
      .replace(/:/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return query;

    // Check if it's a phrase search (contains spaces)
    if (cleaned.includes(' ')) {
      // Use phrase search with quotes
      return `"${cleaned}"`;
    }

    // For single terms, use prefix search for partial matching
    return `${cleaned}*`;
  }

  /**
   * Extract plain text from JSON content blocks
   */
  private extractTextFromContent(contentJson: string): string {
    if (!contentJson) return '';
    try {
      const content = JSON.parse(contentJson) as ContentBlock[];
      const textParts: string[] = [];
      for (const block of content) {
        if (block.type === 'text' && 'text' in block) {
          textParts.push(block.text);
        } else if (block.type === 'tool_use') {
          textParts.push(`[tool: ${block.name}]`);
        } else if (block.type === 'tool_result' && block.content) {
          textParts.push(`[result: ${block.content}]`);
        }
      }
      return textParts.join(' ');
    } catch {
      return '';
    }
  }

  /**
   * Extract search match positions from text
   * Returns the offsets and lengths of matching substrings
   */
  private extractSearchMatches(text: string, query: string): SearchMatch[] {
    const matches: SearchMatch[] = [];
    if (!text || !query) return matches;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Find all occurrences
    let offset = 0;
    while (offset < lowerText.length) {
      const index = lowerText.indexOf(lowerQuery, offset);
      if (index === -1) break;

      matches.push({
        text: text.substring(index, index + query.length),
        offset: index,
        length: query.length,
      });

      offset = index + query.length;
    }

    return matches;
  }

  // ==================== Utility Methods ====================

  /**
   * Update session token counts after adding a message
   */
  private updateSessionTokens(
    sessionId: string,
    metadata?: MessageMetadata
  ): void {
    const inputTokens = metadata?.inputTokens || 0;
    const outputTokens = metadata?.outputTokens || 0;
    // Cache tokens are extracted for future use but not currently accumulated
    void metadata?.cacheReadTokens;
    void metadata?.cacheCreationTokens;

    if (inputTokens === 0 && outputTokens === 0) {
      // Just update timestamp
      this.updateSession(sessionId, {});
      return;
    }

    const stmt = this.db.prepare(`
      UPDATE sessions
      SET total_tokens = total_tokens + ?,
          updated_at = ?
      WHERE id = ?
    `);

    stmt.run(inputTokens + outputTokens, Date.now(), sessionId);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Convert sort column name to database column
   */
  private sortColumnToDb(column: string): string {
    const columnMap: Record<string, string> = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      title: 'title',
    };
    return columnMap[column] || 'updated_at';
  }

  // ==================== Export/Import ====================

  /**
   * Export all sessions with messages
   */
  exportAll(): {
    version: string;
    exportedAt: number;
    sessions: SessionWithMessages[];
  } {
    const sessions = this.listSessions({ limit: 10000 }).sessions;
    const sessionsWithMessages: SessionWithMessages[] = [];

    for (const session of sessions) {
      const fullSession = this.getSessionWithMessages(session.id);
      if (fullSession) {
        sessionsWithMessages.push(fullSession);
      }
    }

    return {
      version: '1.0',
      exportedAt: Date.now(),
      sessions: sessionsWithMessages,
    };
  }

  /**
   * Import sessions from export data
   */
  import(data: {
    version: string;
    sessions: SessionWithMessages[];
  }): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    const transaction = this.db.transaction(() => {
      for (const sessionData of data.sessions) {
        try {
          // Create session
          const stmt = this.db.prepare(`
            INSERT INTO sessions (
              id, title, created_at, updated_at,
              model, system_prompt, temperature, max_tokens,
              workspace_path, total_tokens, total_cost
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          stmt.run(
            sessionData.id,
            sessionData.title,
            sessionData.createdAt,
            sessionData.updatedAt,
            sessionData.metadata?.model || null,
            sessionData.metadata?.systemPrompt || null,
            sessionData.metadata?.temperature || null,
            sessionData.metadata?.maxTokens || null,
            sessionData.metadata?.workspacePath || null,
            sessionData.metadata?.totalTokens || 0,
            sessionData.metadata?.totalCost || 0
          );

          // Create messages
          for (const message of sessionData.messages) {
            const msgStmt = this.db.prepare(`
              INSERT INTO messages (
                id, session_id, role, content, thinking,
                input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
                model, stop_reason, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            msgStmt.run(
              message.id,
              message.sessionId,
              message.role,
              JSON.stringify(message.content),
              message.thinking || null,
              message.metadata?.inputTokens || 0,
              message.metadata?.outputTokens || 0,
              message.metadata?.cacheReadTokens || 0,
              message.metadata?.cacheCreationTokens || 0,
              message.metadata?.model || null,
              message.metadata?.stopReason || null,
              message.createdAt,
              message.updatedAt
            );

            // Create file attachments
            if (message.fileAttachments) {
              for (const attachment of message.fileAttachments) {
                const attachStmt = this.db.prepare(`
                  INSERT INTO file_attachments (id, message_id, file_path, file_name, file_type, file_size)
                  VALUES (?, ?, ?, ?, ?, ?)
                `);

                attachStmt.run(
                  attachment.id,
                  message.id,
                  attachment.filePath,
                  attachment.fileName,
                  attachment.fileType || null,
                  attachment.fileSize || null
                );
              }
            }
          }

          imported++;
        } catch (e) {
          errors.push(`Failed to import session ${sessionData.id}: ${e}`);
        }
      }
    });

    transaction();

    return { imported, errors };
  }
}

// Singleton instance for the application
let storageInstance: ChatStorage | null = null;

/**
 * Get the singleton ChatStorage instance
 */
export function getChatStorage(options?: ChatStorageOptions): ChatStorage {
  // Check if the instance exists and has the required methods
  // If not, recreate it to ensure latest class methods are available
  if (!storageInstance || typeof storageInstance.fullTextSearch !== 'function') {
    if (storageInstance) {
      storageInstance.close();
    }
    storageInstance = new ChatStorage(options);
  }
  return storageInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetChatStorage(): void {
  if (storageInstance) {
    storageInstance.close();
    storageInstance = null;
  }
}

/**
 * Open a new database connection (for modules that need direct DB access)
 * This creates a new ChatStorage instance and returns the raw database connection
 * Note: The caller is responsible for closing the database
 */
export function openDatabase(): Database.Database {
  const { join } = require('path');
  const { existsSync, mkdirSync } = require('fs');

  const dataDir = join(process.cwd(), '.data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, 'chat-history.db');
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  const { runMigrations } = require('./schema');
  runMigrations(db);

  return db;
}

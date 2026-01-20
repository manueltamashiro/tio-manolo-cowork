"use strict";
/**
 * Chat History Storage Service
 * Provides a high-level API for managing chat sessions and messages in SQLite
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatStorage = void 0;
exports.getChatStorage = getChatStorage;
exports.resetChatStorage = resetChatStorage;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = require("path");
const fs_1 = require("fs");
const schema_1 = require("./schema");
/**
 * ChatStorage class - main service for chat history persistence
 */
class ChatStorage {
    constructor(options = {}) {
        const dataDir = options.dataDir || this.getDefaultDataDir();
        const dbPath = options.dbPath || (0, path_1.join)(dataDir, 'chat-history.db');
        // Ensure data directory exists
        if (!(0, fs_1.existsSync)(dataDir)) {
            (0, fs_1.mkdirSync)(dataDir, { recursive: true });
        }
        this.db = new better_sqlite3_1.default(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        // Run migrations
        (0, schema_1.runMigrations)(this.db);
    }
    /**
     * Get the default data directory for storing the database
     */
    getDefaultDataDir() {
        if (typeof process !== 'undefined' && process.env) {
            // In Electron, this would be app.getPath('userData')
            // For web/Next.js, use a local directory
            return (0, path_1.join)(process.cwd(), '.data');
        }
        return (0, path_1.join)(process.cwd(), '.data');
    }
    /**
     * Close the database connection
     */
    close() {
        this.db.close();
    }
    // ==================== Session Operations ====================
    /**
     * Create a new chat session
     */
    createSession(title, metadata) {
        const id = this.generateId();
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO sessions (
        id, title, created_at, updated_at,
        model, system_prompt, temperature, max_tokens,
        workspace_path, total_tokens, total_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, title, now, now, metadata?.model || null, metadata?.systemPrompt || null, metadata?.temperature || null, metadata?.maxTokens || null, metadata?.workspacePath || null, metadata?.totalTokens || 0, metadata?.totalCost || 0);
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
    getSession(id) {
        const stmt = this.db.prepare(`
      SELECT
        id, title, created_at, updated_at,
        model, system_prompt, temperature, max_tokens,
        workspace_path, total_tokens, total_cost
      FROM sessions
      WHERE id = ?
    `);
        const row = stmt.get(id);
        if (!row)
            return null;
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
    getSessionWithMessages(id) {
        const session = this.getSession(id);
        if (!session)
            return null;
        const messages = this.getMessagesBySession(id);
        return {
            ...session,
            messages,
        };
    }
    /**
     * List sessions with optional filters
     */
    listSessions(filters = {}) {
        const { limit = 50, offset = 0, startDate, endDate, sortBy = 'updatedAt', sortOrder = 'desc', } = filters;
        let query = `
      SELECT
        id, title, created_at, updated_at,
        (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id) as message_count
      FROM sessions
      WHERE 1=1
    `;
        const params = [];
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
          (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count
        FROM sessions s
        LEFT JOIN messages m ON m.session_id = s.id
        WHERE LOWER(s.title) LIKE LOWER(?) OR LOWER(m.content) LIKE LOWER(?)
        ORDER BY ${this.sortColumnToDb(sortBy)} ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
            params.push(searchTerm, searchTerm, limit, offset);
        }
        else {
            query += ` ORDER BY ${this.sortColumnToDb(sortBy)} ${sortOrder.toUpperCase()}`;
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        }
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM sessions';
        const countParams = [];
        if (startDate) {
            countQuery += ' WHERE created_at >= ?';
            countParams.push(startDate);
        }
        if (endDate) {
            countQuery += startDate ? ' AND created_at <= ?' : ' WHERE created_at <= ?';
            countParams.push(endDate);
        }
        const countStmt = this.db.prepare(countQuery);
        const totalResult = countStmt.get(...countParams);
        const total = totalResult.count;
        return {
            sessions: rows.map((row) => ({
                id: row.id,
                title: row.title,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                messageCount: row.message_count,
            })),
            total,
            hasMore: offset + rows.length < total,
        };
    }
    /**
     * Update a session
     */
    updateSession(id, updates) {
        const sets = [];
        const params = [];
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
    deleteSession(id) {
        const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    // ==================== Message Operations ====================
    /**
     * Add a message to a session
     */
    addMessage(sessionId, role, content, metadata, fileAttachments, thinking) {
        const session = this.getSession(sessionId);
        if (!session)
            return null;
        const id = this.generateId();
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, session_id, role, content, thinking,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
        model, stop_reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, sessionId, role, JSON.stringify(content), thinking || null, metadata?.inputTokens || 0, metadata?.outputTokens || 0, metadata?.cacheReadTokens || 0, metadata?.cacheCreationTokens || 0, metadata?.model || null, metadata?.stopReason || null, now, now);
        // Add file attachments
        if (fileAttachments && fileAttachments.length > 0) {
            const attachStmt = this.db.prepare(`
        INSERT INTO file_attachments (id, message_id, file_path, file_name, file_type, file_size)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            for (const attachment of fileAttachments) {
                attachStmt.run(attachment.id || this.generateId(), id, attachment.filePath, attachment.fileName, attachment.fileType || null, attachment.fileSize || null);
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
    getMessage(id) {
        const stmt = this.db.prepare(`
      SELECT
        id, session_id, role, content, thinking,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
        model, stop_reason, created_at, updated_at
      FROM messages
      WHERE id = ?
    `);
        const row = stmt.get(id);
        if (!row)
            return null;
        const fileAttachments = this.getFileAttachments(id);
        return {
            id: row.id,
            sessionId: row.session_id,
            role: row.role,
            content: JSON.parse(row.content),
            thinking: row.thinking || undefined,
            metadata: {
                inputTokens: row.input_tokens,
                outputTokens: row.output_tokens,
                cacheReadTokens: row.cache_read_tokens,
                cacheCreationTokens: row.cache_creation_tokens,
                timestamp: row.created_at,
                model: row.model || undefined,
                stopReason: row.stop_reason,
            },
            fileAttachments,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Get all messages for a session
     */
    getMessagesBySession(sessionId) {
        const stmt = this.db.prepare(`
      SELECT
        id, session_id, role, content, thinking,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
        model, stop_reason, created_at, updated_at
      FROM messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `);
        const rows = stmt.all(sessionId);
        return rows.map((row) => {
            const fileAttachments = this.getFileAttachments(row.id);
            return {
                id: row.id,
                sessionId: row.session_id,
                role: row.role,
                content: JSON.parse(row.content),
                thinking: row.thinking || undefined,
                metadata: {
                    inputTokens: row.input_tokens,
                    outputTokens: row.output_tokens,
                    cacheReadTokens: row.cache_read_tokens,
                    cacheCreationTokens: row.cache_creation_tokens,
                    timestamp: row.created_at,
                    model: row.model || undefined,
                    stopReason: row.stop_reason,
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
    updateMessage(id, updates) {
        const sets = [];
        const params = [];
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
    deleteMessage(id) {
        const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    // ==================== File Attachment Operations ====================
    /**
     * Get file attachments for a message
     */
    getFileAttachments(messageId) {
        const stmt = this.db.prepare(`
      SELECT id, file_path, file_name, file_type, file_size
      FROM file_attachments
      WHERE message_id = ?
    `);
        const rows = stmt.all(messageId);
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
     * Search sessions by title and message content
     */
    searchSessions(query, limit = 20) {
        // Use LIKE queries for search (case-insensitive)
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
        const rows = stmt.all(searchTerm, searchTerm, limit);
        return rows.map((row) => ({
            id: row.id,
            title: row.title,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            messageCount: row.message_count,
        }));
    }
    // ==================== Utility Methods ====================
    /**
     * Update session token counts after adding a message
     */
    updateSessionTokens(sessionId, metadata) {
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
    generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    /**
     * Convert sort column name to database column
     */
    sortColumnToDb(column) {
        const columnMap = {
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
    exportAll() {
        const sessions = this.listSessions({ limit: 10000 }).sessions;
        const sessionsWithMessages = [];
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
    import(data) {
        const errors = [];
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
                    stmt.run(sessionData.id, sessionData.title, sessionData.createdAt, sessionData.updatedAt, sessionData.metadata?.model || null, sessionData.metadata?.systemPrompt || null, sessionData.metadata?.temperature || null, sessionData.metadata?.maxTokens || null, sessionData.metadata?.workspacePath || null, sessionData.metadata?.totalTokens || 0, sessionData.metadata?.totalCost || 0);
                    // Create messages
                    for (const message of sessionData.messages) {
                        const msgStmt = this.db.prepare(`
              INSERT INTO messages (
                id, session_id, role, content, thinking,
                input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
                model, stop_reason, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
                        msgStmt.run(message.id, message.sessionId, message.role, JSON.stringify(message.content), message.thinking || null, message.metadata?.inputTokens || 0, message.metadata?.outputTokens || 0, message.metadata?.cacheReadTokens || 0, message.metadata?.cacheCreationTokens || 0, message.metadata?.model || null, message.metadata?.stopReason || null, message.createdAt, message.updatedAt);
                        // Create file attachments
                        if (message.fileAttachments) {
                            for (const attachment of message.fileAttachments) {
                                const attachStmt = this.db.prepare(`
                  INSERT INTO file_attachments (id, message_id, file_path, file_name, file_type, file_size)
                  VALUES (?, ?, ?, ?, ?, ?)
                `);
                                attachStmt.run(attachment.id, message.id, attachment.filePath, attachment.fileName, attachment.fileType || null, attachment.fileSize || null);
                            }
                        }
                    }
                    imported++;
                }
                catch (e) {
                    errors.push(`Failed to import session ${sessionData.id}: ${e}`);
                }
            }
        });
        transaction();
        return { imported, errors };
    }
}
exports.ChatStorage = ChatStorage;
// Singleton instance for the application
let storageInstance = null;
/**
 * Get the singleton ChatStorage instance
 */
function getChatStorage(options) {
    if (!storageInstance) {
        storageInstance = new ChatStorage(options);
    }
    return storageInstance;
}
/**
 * Reset the singleton (useful for testing)
 */
function resetChatStorage() {
    if (storageInstance) {
        storageInstance.close();
        storageInstance = null;
    }
}

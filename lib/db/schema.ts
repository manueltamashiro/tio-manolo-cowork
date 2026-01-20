/**
 * SQLite Database Schema for Chat History Storage
 * Defines the database structure and migration scripts
 */

export interface Migration {
  version: number;
  name: string;
  up: (db: import('better-sqlite3').Database) => void;
  down: (db: import('better-sqlite3').Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      // Sessions table - stores conversation metadata
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
          model TEXT,
          system_prompt TEXT,
          temperature REAL,
          max_tokens INTEGER,
          workspace_path TEXT,
          total_tokens INTEGER DEFAULT 0,
          total_cost REAL DEFAULT 0
        );
      `);

      // Index for session date queries
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
      `);

      // Messages table - stores individual messages
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          thinking TEXT,
          input_tokens INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0,
          cache_read_tokens INTEGER DEFAULT 0,
          cache_creation_tokens INTEGER DEFAULT 0,
          model TEXT,
          stop_reason TEXT CHECK(stop_reason IN ('end_turn', 'max_tokens', 'stop_sequence', 'tool_use')),
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
      `);

      // Index for message queries
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      `);

      // File attachments table - stores file references in messages
      db.exec(`
        CREATE TABLE IF NOT EXISTS file_attachments (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT,
          file_size INTEGER,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );
      `);

      // Index for file attachment queries
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_file_attachments_message_id ON file_attachments(message_id);
      `);

      // Metadata table - stores application settings and key-value pairs
      db.exec(`
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        );
      `);

      // Insert schema version
      const stmt = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)');
      stmt.run('schema_version', '1');
    },
    down: (db) => {
      db.exec(`
        DROP TABLE IF EXISTS file_attachments;
        DROP TABLE IF EXISTS messages;
        DROP TABLE IF EXISTS sessions;
        DROP TABLE IF EXISTS metadata;
      `);
    },
  },
  {
    version: 2,
    name: 'add_search_indexes',
    up: (db) => {
      // Add indexes for better search performance
      // Using LIKE queries instead of FTS for simplicity and compatibility
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_title_lower ON sessions(lower(title));
        CREATE INDEX IF NOT EXISTS idx_messages_content_lower ON messages(lower(content));
      `);

      // Update schema version
      const stmt = db.prepare('UPDATE metadata SET value = ?, updated_at = ? WHERE key = ?');
      const now = Date.now();
      stmt.run('2', now, 'schema_version');
    },
    down: (db) => {
      db.exec(`
        DROP INDEX IF EXISTS idx_sessions_title_lower;
        DROP INDEX IF EXISTS idx_messages_content_lower;
      `);

      const stmt = db.prepare('UPDATE metadata SET value = ?, updated_at = ? WHERE key = ?');
      stmt.run('1', Date.now(), 'schema_version');
    },
  },
  {
    version: 3,
    name: 'add_fts_full_text_search',
    up: (db) => {
      // Create FTS5 virtual table for full-text search on messages
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
          message_id,
          content,
          session_title,
          role,
          created_at,
          content='messages',
          content_rowid='rowid'
        );
      `);

      // Create FTS5 virtual table for sessions
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
          session_id,
          title,
          created_at,
          updated_at,
          content='sessions',
          content_rowid='rowid'
        );
      `);

      // Populate messages_fts with existing data
      db.exec(`
        INSERT INTO messages_fts(message_id, content, session_title, role, created_at)
        SELECT m.rowid, m.content, s.title, m.role, m.created_at
        FROM messages m
        JOIN sessions s ON s.id = m.session_id;
      `);

      // Populate sessions_fts with existing data
      db.exec(`
        INSERT INTO sessions_fts(session_id, title, created_at, updated_at)
        SELECT rowid, title, created_at, updated_at FROM sessions;
      `);

      // Create triggers to keep FTS tables in sync
      // After inserting a message
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
          INSERT INTO messages_fts(message_id, content, session_title, role, created_at)
          SELECT NEW.rowid, NEW.content, (SELECT title FROM sessions WHERE id = NEW.session_id), NEW.role, NEW.created_at;
        END;
      `);

      // After deleting a message
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
          DELETE FROM messages_fts WHERE message_id = OLD.rowid;
        END;
      `);

      // After updating a message
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
          UPDATE messages_fts
          SET content = NEW.content,
              role = NEW.role,
              created_at = NEW.created_at
          WHERE message_id = NEW.rowid;
        END;
      `);

      // After inserting a session
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS sessions_ai AFTER INSERT ON sessions BEGIN
          INSERT INTO sessions_fts(session_id, title, created_at, updated_at)
          VALUES(NEW.rowid, NEW.title, NEW.created_at, NEW.updated_at);
        END;
      `);

      // After deleting a session
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS sessions_ad AFTER DELETE ON sessions BEGIN
          DELETE FROM sessions_fts WHERE session_id = OLD.rowid;
        END;
      `);

      // After updating a session (including title changes)
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS sessions_au AFTER UPDATE ON sessions BEGIN
          UPDATE sessions_fts
          SET title = NEW.title,
              updated_at = NEW.updated_at
          WHERE session_id = NEW.rowid;
        END;
      `);

      // Update schema version
      const stmt = db.prepare('UPDATE metadata SET value = ?, updated_at = ? WHERE key = ?');
      stmt.run('3', Date.now(), 'schema_version');
    },
    down: (db) => {
      // Drop triggers
      db.exec(`
        DROP TRIGGER IF EXISTS messages_ai;
        DROP TRIGGER IF EXISTS messages_ad;
        DROP TRIGGER IF EXISTS messages_au;
        DROP TRIGGER IF EXISTS sessions_ai;
        DROP TRIGGER IF EXISTS sessions_ad;
        DROP TRIGGER IF EXISTS sessions_au;
      `);

      // Drop FTS tables
      db.exec(`
        DROP TABLE IF EXISTS messages_fts;
        DROP TABLE IF EXISTS sessions_fts;
      `);

      const stmt = db.prepare('UPDATE metadata SET value = ?, updated_at = ? WHERE key = ?');
      stmt.run('2', Date.now(), 'schema_version');
    },
  },
  {
    version: 4,
    name: 'add_file_attachments_fts',
    up: (db) => {
      // Create FTS5 virtual table for file attachments search
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS file_attachments_fts USING fts5(
          attachment_id,
          file_name,
          file_path,
          message_id,
          content='file_attachments',
          content_rowid='rowid'
        );
      `);

      // Populate file_attachments_fts with existing data
      db.exec(`
        INSERT INTO file_attachments_fts(attachment_id, file_name, file_path, message_id)
        SELECT rowid, file_name, file_path, message_id FROM file_attachments;
      `);

      // Create triggers to keep file attachments FTS in sync
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS file_attachments_ai AFTER INSERT ON file_attachments BEGIN
          INSERT INTO file_attachments_fts(attachment_id, file_name, file_path, message_id)
          VALUES(NEW.rowid, NEW.file_name, NEW.file_path, NEW.message_id);
        END;
      `);

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS file_attachments_ad AFTER DELETE ON file_attachments BEGIN
          DELETE FROM file_attachments_fts WHERE attachment_id = OLD.rowid;
        END;
      `);

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS file_attachments_au AFTER UPDATE ON file_attachments BEGIN
          UPDATE file_attachments_fts
          SET file_name = NEW.file_name,
              file_path = NEW.file_path
          WHERE attachment_id = NEW.rowid;
        END;
      `);

      // Update schema version
      const stmt = db.prepare('UPDATE metadata SET value = ?, updated_at = ? WHERE key = ?');
      stmt.run('4', Date.now(), 'schema_version');
    },
    down: (db) => {
      db.exec(`
        DROP TRIGGER IF EXISTS file_attachments_ai;
        DROP TRIGGER IF EXISTS file_attachments_ad;
        DROP TRIGGER IF EXISTS file_attachments_au;
        DROP TABLE IF EXISTS file_attachments_fts;
      `);

      const stmt = db.prepare('UPDATE metadata SET value = ?, updated_at = ? WHERE key = ?');
      stmt.run('3', Date.now(), 'schema_version');
    },
  },
  {
    version: 5,
    name: 'add_system_prompt_templates',
    up: (db) => {
      // System prompt templates table - stores reusable system prompt templates
      db.exec(`
        CREATE TABLE IF NOT EXISTS system_prompt_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT DEFAULT 'custom',
          tags TEXT,
          is_default INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        );
      `);

      // Index for template queries
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_system_prompt_templates_category ON system_prompt_templates(category);
        CREATE INDEX IF NOT EXISTS idx_system_prompt_templates_is_default ON system_prompt_templates(is_default);
      `);

      // Insert default system prompt templates
      const insertTemplate = db.prepare(`
        INSERT INTO system_prompt_templates (id, name, content, category, is_default)
        VALUES (?, ?, ?, ?, ?)
      `);

      // Default helpful assistant prompt
      insertTemplate.run(
        'default-helpful',
        'Helpful Assistant',
        'You are a helpful, harmless, and honest assistant. You answer questions clearly and concisely, and you admit when you don\'t know something.',
        'general',
        1
      );

      // Code assistant prompt
      insertTemplate.run(
        'default-code',
        'Code Assistant',
        'You are an expert programmer and coding assistant. You help write, review, debug, and explain code. When providing code examples, use clear comments and follow best practices. Always consider edge cases and potential errors.',
        'coding',
        0
      );

      // Writing assistant prompt
      insertTemplate.run(
        'default-writing',
        'Writing Assistant',
        'You are a skilled writing assistant. You help with drafting, editing, and improving text. You pay attention to grammar, style, clarity, and tone. You adapt your writing style to match the intended audience and purpose.',
        'writing',
        0
      );

      // Creative assistant prompt
      insertTemplate.run(
        'default-creative',
        'Creative Assistant',
        'You are a creative assistant that helps with brainstorming, ideation, and creative projects. You think outside the box and offer innovative ideas while remaining practical and helpful.',
        'creative',
        0
      );

      // Technical expert prompt
      insertTemplate.run(
        'default-technical',
        'Technical Expert',
        'You are a technical expert with deep knowledge across multiple domains. You provide accurate, detailed explanations of complex topics. You break down difficult concepts into understandable parts and use analogies when helpful.',
        'technical',
        0
      );

      // Update schema version
      const stmt = db.prepare('UPDATE metadata SET value = ?, updated_at = ? WHERE key = ?');
      stmt.run('5', Date.now(), 'schema_version');
    },
    down: (db) => {
      db.exec(`
        DROP INDEX IF EXISTS idx_system_prompt_templates_category;
        DROP INDEX IF EXISTS idx_system_prompt_templates_is_default;
        DROP TABLE IF EXISTS system_prompt_templates;
      `);

      const stmt = db.prepare('UPDATE metadata SET value = ?, updated_at = ? WHERE key = ?');
      stmt.run('4', Date.now(), 'schema_version');
    },
  },
];

/**
 * Get the current schema version from the database
 */
export function getSchemaVersion(db: import('better-sqlite3').Database): number {
  try {
    const stmt = db.prepare('SELECT value FROM metadata WHERE key = ?');
    const result = stmt.get('schema_version') as { value: string } | undefined;
    return result ? parseInt(result.value, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Run pending migrations to bring the database up to the latest schema version
 */
export function runMigrations(db: import('better-sqlite3').Database): void {
  const currentVersion = getSchemaVersion(db);
  const latestVersion = migrations[migrations.length - 1].version;

  if (currentVersion === latestVersion) {
    return;
  }

  // Begin transaction for migration
  db.transaction(() => {
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        migration.up(db);
      }
    }
  })();
}

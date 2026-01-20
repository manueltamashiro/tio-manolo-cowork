"use strict";
/**
 * SQLite Database Schema for Chat History Storage
 * Defines the database structure and migration scripts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrations = void 0;
exports.getSchemaVersion = getSchemaVersion;
exports.runMigrations = runMigrations;
exports.migrations = [
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
];
/**
 * Get the current schema version from the database
 */
function getSchemaVersion(db) {
    try {
        const stmt = db.prepare('SELECT value FROM metadata WHERE key = ?');
        const result = stmt.get('schema_version');
        return result ? parseInt(result.value, 10) : 0;
    }
    catch {
        return 0;
    }
}
/**
 * Run pending migrations to bring the database up to the latest schema version
 */
function runMigrations(db) {
    const currentVersion = getSchemaVersion(db);
    const latestVersion = exports.migrations[exports.migrations.length - 1].version;
    if (currentVersion === latestVersion) {
        return;
    }
    // Begin transaction for migration
    db.transaction(() => {
        for (const migration of exports.migrations) {
            if (migration.version > currentVersion) {
                migration.up(db);
            }
        }
    })();
}

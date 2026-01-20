/**
 * System Prompt Templates Storage
 * Manages CRUD operations for system prompt templates
 */

import Database from 'better-sqlite3';
import { openDatabase } from './chat-storage';
import type {
  SystemPromptTemplate,
  SystemPromptTemplateInput,
} from '../types/chat';

/**
 * Convert database row to SystemPromptTemplate
 */
function rowToTemplate(row: any): SystemPromptTemplate {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    category: row.category || 'custom',
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all system prompt templates
 */
export function getAllSystemPromptTemplates(): SystemPromptTemplate[] {
  const db = openDatabase();
  try {
    const stmt = db.prepare(`
      SELECT * FROM system_prompt_templates
      ORDER BY is_default DESC, category ASC, name ASC
    `);
    const rows = stmt.all();
    return rows.map(rowToTemplate);
  } finally {
    db.close();
  }
}

/**
 * Get a system prompt template by ID
 */
export function getSystemPromptTemplate(
  id: string
): SystemPromptTemplate | null {
  const db = openDatabase();
  try {
    const stmt = db.prepare(`
      SELECT * FROM system_prompt_templates WHERE id = ?
    `);
    const row = stmt.get(id);
    return row ? rowToTemplate(row) : null;
  } finally {
    db.close();
  }
}

/**
 * Get the default system prompt template
 */
export function getDefaultSystemPromptTemplate(): SystemPromptTemplate | null {
  const db = openDatabase();
  try {
    const stmt = db.prepare(`
      SELECT * FROM system_prompt_templates
      WHERE is_default = 1
      ORDER BY created_at ASC
      LIMIT 1
    `);
    const row = stmt.get();
    return row ? rowToTemplate(row) : null;
  } finally {
    db.close();
  }
}

/**
 * Create a new system prompt template
 */
export function createSystemPromptTemplate(
  input: SystemPromptTemplateInput
): SystemPromptTemplate {
  const db = openDatabase();
  try {
    const id = `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO system_prompt_templates (id, name, content, category, tags, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.name,
      input.content,
      input.category || 'custom',
      input.tags ? JSON.stringify(input.tags) : null,
      input.isDefault ? 1 : 0,
      now,
      now
    );

    return getSystemPromptTemplate(id)!;
  } finally {
    db.close();
  }
}

/**
 * Update an existing system prompt template
 */
export function updateSystemPromptTemplate(
  id: string,
  input: Partial<SystemPromptTemplateInput>
): SystemPromptTemplate | null {
  const db = openDatabase();
  try {
    const existing = getSystemPromptTemplate(id);
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.content !== undefined) {
      updates.push('content = ?');
      values.push(input.content);
    }
    if (input.category !== undefined) {
      updates.push('category = ?');
      values.push(input.category);
    }
    if (input.tags !== undefined) {
      updates.push('tags = ?');
      values.push(input.tags ? JSON.stringify(input.tags) : null);
    }
    if (input.isDefault !== undefined) {
      updates.push('is_default = ?');
      values.push(input.isDefault ? 1 : 0);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = db.prepare(`
      UPDATE system_prompt_templates
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return getSystemPromptTemplate(id);
  } finally {
    db.close();
  }
}

/**
 * Delete a system prompt template
 */
export function deleteSystemPromptTemplate(id: string): boolean {
  const db = openDatabase();
  try {
    // Don't allow deleting default templates
    const template = getSystemPromptTemplate(id);
    if (!template) {
      return false;
    }

    const stmt = db.prepare(`
      DELETE FROM system_prompt_templates WHERE id = ? AND is_default = 0
    `);
    const result = stmt.run(id);
    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * Set a template as the default (unsets other defaults)
 */
export function setDefaultSystemPromptTemplate(id: string): boolean {
  const db = openDatabase();
  try {
    const existing = getSystemPromptTemplate(id);
    if (!existing) {
      return false;
    }

    // Unset all defaults
    db.prepare('UPDATE system_prompt_templates SET is_default = 0').run();

    // Set new default
    const stmt = db.prepare(`
      UPDATE system_prompt_templates
      SET is_default = 1, updated_at = ?
      WHERE id = ?
    `);
    const result = stmt.run(Date.now(), id);

    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * Get templates by category
 */
export function getSystemPromptTemplatesByCategory(
  category: string
): SystemPromptTemplate[] {
  const db = openDatabase();
  try {
    const stmt = db.prepare(`
      SELECT * FROM system_prompt_templates
      WHERE category = ?
      ORDER BY is_default DESC, name ASC
    `);
    const rows = stmt.all(category);
    return rows.map(rowToTemplate);
  } finally {
    db.close();
  }
}

/**
 * Search system prompt templates
 */
export function searchSystemPromptTemplates(
  query: string
): SystemPromptTemplate[] {
  const db = openDatabase();
  try {
    const stmt = db.prepare(`
      SELECT * FROM system_prompt_templates
      WHERE name LIKE ? OR content LIKE ? OR category LIKE ?
      ORDER BY is_default DESC, name ASC
    `);
    const searchPattern = `%${query}%`;
    const rows = stmt.all(searchPattern, searchPattern, searchPattern);
    return rows.map(rowToTemplate);
  } finally {
    db.close();
  }
}

/**
 * Get all categories
 */
export function getSystemPromptCategories(): string[] {
  const db = openDatabase();
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT category FROM system_prompt_templates
      ORDER BY category ASC
    `);
    const rows = stmt.all() as Array<{ category: string }>;
    return rows.map((r) => r.category);
  } finally {
    db.close();
  }
}

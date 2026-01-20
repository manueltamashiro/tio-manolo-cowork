/**
 * API Route for System Prompt Templates
 * Handles CRUD operations for system prompt templates
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSystemPromptTemplates,
  createSystemPromptTemplate,
  getDefaultSystemPromptTemplate,
} from '@/lib/db/system-prompts';
import type { SystemPromptTemplateInput } from '@/lib/types/chat';

/**
 * GET /api/system-prompts
 * Get all system prompt templates or the default template
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const defaultOnly = searchParams.get('default') === 'true';

    if (defaultOnly) {
      const template = getDefaultSystemPromptTemplate();
      return NextResponse.json({ template });
    }

    const templates = getAllSystemPromptTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching system prompt templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system prompt templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/system-prompts
 * Create a new system prompt template
 */
export async function POST(request: NextRequest) {
  try {
    const body: SystemPromptTemplateInput = await request.json();

    // Validate required fields
    if (!body.name || !body.content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      );
    }

    const template = createSystemPromptTemplate(body);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating system prompt template:', error);
    return NextResponse.json(
      { error: 'Failed to create system prompt template' },
      { status: 500 }
    );
  }
}

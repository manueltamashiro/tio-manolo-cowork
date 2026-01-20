/**
 * API Route for Individual System Prompt Templates
 * Handles operations on specific templates
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSystemPromptTemplate,
  updateSystemPromptTemplate,
  deleteSystemPromptTemplate,
  setDefaultSystemPromptTemplate,
} from '@/lib/db/system-prompts';
import type { SystemPromptTemplateInput } from '@/lib/types/chat';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/system-prompts/[id]
 * Get a specific system prompt template
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const template = getSystemPromptTemplate(id);

    if (!template) {
      return NextResponse.json(
        { error: 'System prompt template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching system prompt template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system prompt template' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/system-prompts/[id]
 * Update a system prompt template
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body: Partial<SystemPromptTemplateInput> = await request.json();

    const template = updateSystemPromptTemplate(id, body);

    if (!template) {
      return NextResponse.json(
        { error: 'System prompt template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error updating system prompt template:', error);
    return NextResponse.json(
      { error: 'Failed to update system prompt template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/system-prompts/[id]
 * Delete a system prompt template
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const success = deleteSystemPromptTemplate(id);

    if (!success) {
      return NextResponse.json(
        { error: 'System prompt template not found or cannot be deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting system prompt template:', error);
    return NextResponse.json(
      { error: 'Failed to delete system prompt template' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/system-prompts/[id]/set-default
 * Set a template as the default
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);

    // Check if this is the set-default action
    if (searchParams.get('action') === 'set-default') {
      const success = setDefaultSystemPromptTemplate(id);

      if (!success) {
        return NextResponse.json(
          { error: 'System prompt template not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error setting default system prompt template:', error);
    return NextResponse.json(
      { error: 'Failed to set default system prompt template' },
      { status: 500 }
    );
  }
}

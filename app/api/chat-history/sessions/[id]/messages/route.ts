/**
 * API route for managing messages in a session
 * POST /api/chat-history/sessions/:id/messages - Add a message to a session
 * GET /api/chat-history/sessions/:id/messages - Get all messages in a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChatStorage } from '@/lib/db/chat-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storage = getChatStorage();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: sessionId } = await context.params;
    const body = await request.json();
    const { role, content, metadata, fileAttachments, thinking } = body as {
      role?: 'user' | 'assistant' | 'system';
      content?: any[];
      metadata?: any;
      fileAttachments?: any[];
      thinking?: string;
    };

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      );
    }

    const message = storage.addMessage(
      sessionId,
      role,
      content,
      metadata,
      fileAttachments,
      thinking
    );

    if (!message) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error adding message:', error);
    return NextResponse.json(
      { error: 'Failed to add message' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: sessionId } = await context.params;

    const messages = storage.getMessagesBySession(sessionId);
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    );
  }
}

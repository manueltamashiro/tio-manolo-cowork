/**
 * API route for individual chat session operations
 * GET /api/chat-history/sessions/:id - Get a session (optionally with messages)
 * PATCH /api/chat-history/sessions/:id - Update a session
 * DELETE /api/chat-history/sessions/:id - Delete a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChatStorage } from '@/lib/db/chat-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storage = getChatStorage();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const includeMessages = searchParams.get('include') === 'messages';

    if (includeMessages) {
      const session = storage.getSessionWithMessages(id);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json(session);
    } else {
      const session = storage.getSession(id);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json(session);
    }
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const success = storage.updateSession(id, body);

    if (!success) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updated = storage.getSession(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const success = storage.deleteSession(id);

    if (!success) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

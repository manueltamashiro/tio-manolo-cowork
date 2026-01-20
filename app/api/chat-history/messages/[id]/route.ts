/**
 * API route for individual message operations
 * GET /api/chat-history/messages/:id - Get a message
 * PATCH /api/chat-history/messages/:id - Update a message
 * DELETE /api/chat-history/messages/:id - Delete a message
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChatStorage } from '@/lib/db/chat-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storage = getChatStorage();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const message = storage.getMessage(id);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error getting message:', error);
    return NextResponse.json(
      { error: 'Failed to get message' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const success = storage.updateMessage(id, body);

    if (!success) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const updated = storage.getMessage(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const success = storage.deleteMessage(id);

    if (!success) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}

/**
 * API route for managing chat sessions
 * POST /api/chat-history/sessions - Create a new session
 * GET /api/chat-history/sessions - List sessions with optional filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChatStorage } from '@/lib/db/chat-storage';
import type { SessionFilters } from '@/lib/types/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storage = getChatStorage();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, metadata } = body as { title?: string; metadata?: any };

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const session = storage.createSession(title, metadata);
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters: SessionFilters = {
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!, 10)
        : undefined,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!, 10)
        : undefined,
      sortBy: (searchParams.get('sortBy') as any) || undefined,
      sortOrder: (searchParams.get('sortOrder') as any) || undefined,
      searchQuery: searchParams.get('searchQuery') || undefined,
    };

    const result = storage.listSessions(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

/**
 * API route for full-text search across sessions, messages, and file attachments
 * GET /api/chat-history/search?q=query - Search with various options
 *
 * Query parameters:
 * - q: Search query string (required)
 * - limit: Maximum number of results per category (default: 50)
 * - offset: Offset for pagination (default: 0)
 * - includeMessages: Include message results (default: true)
 * - includeFiles: Include file results (default: true)
 * - role: Filter by message role (user/assistant/system)
 * - sessionId: Search within a specific session
 * - sortBy: Sort by 'rank' or 'date' (default: rank)
 * - sortOrder: Sort direction 'asc' or 'desc' (default: desc)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SearchResults, SearchOptions } from '@/lib/types/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const options: SearchOptions = {
      query: query.trim(),
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!, 10)
        : 50,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!, 10)
        : 0,
      includeMessages: searchParams.get('includeMessages') !== 'false',
      includeFiles: searchParams.get('includeFiles') !== 'false',
      sortBy: (searchParams.get('sortBy') as 'rank' | 'date') || 'rank',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    const roleParam = searchParams.get('role');
    if (roleParam && ['user', 'assistant', 'system'].includes(roleParam)) {
      options.role = roleParam as 'user' | 'assistant' | 'system';
    }

    const sessionId = searchParams.get('sessionId');
    if (sessionId) {
      options.sessionId = sessionId;
    }

    // Dynamic import to ensure latest module version
    const { getChatStorage } = await import('@/lib/db/chat-storage');
    const storage = getChatStorage();

    // Check if the fullTextSearch method exists
    if (typeof storage.fullTextSearch !== 'function') {
      // Fallback to the legacy searchSessions method
      const sessions = storage.searchSessions(options.query, options.limit);
      return NextResponse.json({
        sessions: sessions.map((s: any) => ({
          session: s,
          rank: 1,
          matches: [],
        })),
        messages: [],
        files: [],
        totalResults: sessions.length,
        query: options.query,
      });
    }

    const results: SearchResults = storage.fullTextSearch(options);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error performing full-text search:', error);
    return NextResponse.json(
      { error: 'Failed to perform search', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * API route for exporting chat sessions
 * GET /api/chat-history/export?sessionId=xxx&format=md&includeAttachments=false
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChatStorage } from '@/lib/db/chat-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storage = getChatStorage();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const format = searchParams.get('format') || 'json';
    const includeAttachments = searchParams.get('includeAttachments') === 'true';

    // If sessionId is provided, export single session; otherwise export all
    let sessionsWithMessages;
    if (sessionId) {
      const session = storage.getSessionWithMessages(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      sessionsWithMessages = [session];
    } else {
      const allSessions = storage.listSessions({ limit: 10000 }).sessions;
      sessionsWithMessages = allSessions
        .map((s) => storage.getSessionWithMessages(s.id))
        .filter((s): s is Exclude<typeof s, null> => s !== null);
    }

    // Generate filename based on what's being exported
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseFilename = sessionId ? sessionsWithMessages[0]?.title.replace(/[^a-z0-9]/gi, '_') : 'all_chats';

    // Handle different export formats
    switch (format) {
      case 'md':
      case 'markdown': {
        const markdown = generateMarkdown(sessionsWithMessages, includeAttachments);
        return new NextResponse(markdown, {
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `attachment; filename="${baseFilename}_${timestamp}.md"`,
          },
        });
      }

      case 'txt':
      case 'text': {
        const text = generatePlainText(sessionsWithMessages, includeAttachments);
        return new NextResponse(text, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${baseFilename}_${timestamp}.txt"`,
          },
        });
      }

      case 'json':
      default: {
        const jsonData = {
          version: '1.0',
          exportedAt: Date.now(),
          includeAttachments,
          sessions: sessionsWithMessages,
        };
        return NextResponse.json(jsonData, {
          headers: {
            'Content-Disposition': `attachment; filename="${baseFilename}_${timestamp}.json"`,
          },
        });
      }
    }
  } catch (error) {
    console.error('Error exporting chat:', error);
    return NextResponse.json(
      { error: 'Failed to export chat' },
      { status: 500 }
    );
  }
}

/**
 * Generate markdown from sessions
 */
function generateMarkdown(sessions: any[], includeAttachments: boolean): string {
  const lines: string[] = [];

  for (const session of sessions) {
    // Session header
    lines.push(`# ${session.title}\n`);
    lines.push(`*Created: ${new Date(session.createdAt).toLocaleString()}*\n`);
    lines.push(`*Last updated: ${new Date(session.updatedAt).toLocaleString()}*\n`);

    if (session.metadata?.model) {
      lines.push(`*Model: ${session.metadata.model}*\n`);
    }

    lines.push('---\n');

    // Messages
    for (const message of session.messages) {
      const roleName = message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System';
      lines.push(`## ${roleName}\n`);

      // Add timestamp if available
      if (message.createdAt) {
        lines.push(`*${new Date(message.createdAt).toLocaleString()}*\n`);
      }

      // Process content blocks
      for (const block of message.content) {
        if (block.type === 'text') {
          lines.push(block.text);
          lines.push('');
        } else if (block.type === 'image' && block.source) {
          if (block.source.type === 'base64') {
            lines.push(`[Image: base64 data (${block.source.mediaType})]`);
          } else {
            lines.push(`[Image: ${block.source.url}]`);
          }
          lines.push('');
        } else if (block.type === 'tool_use') {
          lines.push(`**Tool Use:** \`${block.name}\``);
          lines.push('```json');
          lines.push(JSON.stringify(block.input, null, 2));
          lines.push('```');
          lines.push('');
        } else if (block.type === 'tool_result') {
          lines.push(`**Tool Result**${block.is_error ? ' (Error)' : ''}:`);
          if (block.content) {
            lines.push('```');
            lines.push(block.content);
            lines.push('```');
          }
          lines.push('');
        }
      }

      // Add thinking if present
      if (message.thinking) {
        lines.push('> **Thinking:**');
        lines.push('> ' + message.thinking.split('\n').join('\n> '));
        lines.push('');
      }

      // Add file attachments if included
      if (includeAttachments && message.fileAttachments && message.fileAttachments.length > 0) {
        lines.push('**Attachments:**');
        for (const attachment of message.fileAttachments) {
          const sizeInfo = attachment.fileSize ? ` (${formatFileSize(attachment.fileSize)})` : '';
          lines.push(`- \`${attachment.filePath}\`${sizeInfo}`);
        }
        lines.push('');
      }

      lines.push('---\n');
    }

    lines.push('\n\n');
  }

  return lines.join('\n');
}

/**
 * Generate plain text from sessions
 */
function generatePlainText(sessions: any[], includeAttachments: boolean): string {
  const lines: string[] = [];

  for (const session of sessions) {
    lines.push(`=== ${session.title} ===`);
    lines.push(`Created: ${new Date(session.createdAt).toLocaleString()}`);
    lines.push(`Last updated: ${new Date(session.updatedAt).toLocaleString()}`);
    if (session.metadata?.model) {
      lines.push(`Model: ${session.metadata.model}`);
    }
    lines.push('');

    // Messages
    for (const message of session.messages) {
      const roleName = message.role === 'user' ? 'USER' : message.role === 'assistant' ? 'ASSISTANT' : 'SYSTEM';
      lines.push(`[${roleName}]`);

      if (message.createdAt) {
        lines.push(`${new Date(message.createdAt).toLocaleString()}`);
      }

      lines.push('');

      // Process content blocks
      for (const block of message.content) {
        if (block.type === 'text') {
          lines.push(block.text);
          lines.push('');
        } else if (block.type === 'image' && block.source) {
          if (block.source.type === 'base64') {
            lines.push(`[Image: base64 data (${block.source.mediaType})]`);
          } else {
            lines.push(`[Image: ${block.source.url}]`);
          }
          lines.push('');
        } else if (block.type === 'tool_use') {
          lines.push(`Tool Use: ${block.name}`);
          lines.push(JSON.stringify(block.input, null, 2));
          lines.push('');
        } else if (block.type === 'tool_result') {
          lines.push(`Tool Result${block.is_error ? ' (Error)' : ''}:`);
          if (block.content) {
            lines.push(block.content);
          }
          lines.push('');
        }
      }

      // Add thinking if present
      if (message.thinking) {
        lines.push(`Thinking: ${message.thinking}`);
        lines.push('');
      }

      // Add file attachments if included
      if (includeAttachments && message.fileAttachments && message.fileAttachments.length > 0) {
        lines.push('Attachments:');
        for (const attachment of message.fileAttachments) {
          const sizeInfo = attachment.fileSize ? ` (${formatFileSize(attachment.fileSize)})` : '';
          lines.push(`  - ${attachment.filePath}${sizeInfo}`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    lines.push('');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

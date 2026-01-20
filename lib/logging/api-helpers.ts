/**
 * API logging utilities for Next.js routes
 */

import { headers } from 'next/headers';
import { getLogger } from './logger';
import type { RequestContext } from './types';

/**
 * Extract request context from Next.js headers
 */
export async function getRequestContext(): Promise<RequestContext> {
  const headersList = await headers();

  return {
    requestId: headersList.get('x-request-id') ?? crypto.randomUUID(),
    userAgent: headersList.get('user-agent') ?? undefined,
    ip: headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? undefined,
  };
}

/**
 * Create a timed request logger for API routes
 */
export function createRequestLogger(source: string) {
  return {
    async start(path: string, method: string) {
      const startTime = Date.now();
      const logger = getLogger().child({ source, route: path, method });
      const context = await getRequestContext();

      logger.debug(`${method} ${path} started`, {
        requestId: context.requestId,
        userAgent: context.userAgent,
        ip: context.ip,
      });

      return {
        async end(statusCode: number, error?: Error) {
          const duration = Date.now() - startTime;

          await logger.logApiRequest({
            method,
            path,
            statusCode,
            duration,
            userAgent: context.userAgent,
            ip: context.ip,
          });

          if (error) {
            await logger.error(`${method} ${path} failed`, error, {
              requestId: context.requestId,
              statusCode,
              duration,
            });
          }
        },
        logger,
        context,
      };
    },
  };
}

/**
 * Wrapper for API route handlers with automatic logging
 */
export function withApiLogging(
  source: string,
  handler: (req: Request, context: { logger: ReturnType<typeof getLogger> }) => Response | Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const requestLogger = createRequestLogger(source);
    const url = new URL(req.url);
    const { logger, end } = await requestLogger.start(url.pathname, req.method);

    try {
      const response = await handler(req, { logger });
      const status = response instanceof Response ? response.status : 500;
      await end(status);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await end(500, err);
      throw error;
    }
  };
}

/**
 * Extract error message for API responses
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  statusCode: number = 500
): Response {
  const message = error instanceof Error ? error.message : 'Internal server error';

  return new Response(
    JSON.stringify({ error: message }),
    { status: statusCode, headers: { 'Content-Type': 'application/json' } }
  );
}

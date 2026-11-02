/**
 * Vercel Serverless Function — primary entry point for /api/* requests.
 *
 * All incoming /api/* requests are routed here via vercel.json rewrite:
 *   "source": "/api/:path*" -> "destination": "/api/index?__path=:path*"
 *
 * This explicitly preserves the original path and query parameters without
 * relying on unverified forwarding headers.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local in local preview / test builds if present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import { handleApiRequest } from '../server/apiHandler';

export const config = {
  runtime: 'nodejs',
};

/**
 * Reconstructs the exact requested URL and query parameters from the __path parameter:
 * - If Vercel rewrote /api/:path* to /api/index?__path=:path*, extracts __path and
 *   reconstructs the original path and original query parameters.
 * - Does not depend on proxy forwarding headers.
 */
export function reconstructRequestedUrl(req: IncomingMessage): void {
  const rawUrl = req.url || '/';

  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const pathParam = parsed.searchParams.get('__path');

    if (pathParam !== null) {
      // Remove the internal routing query parameter
      parsed.searchParams.delete('__path');

      // Preserve any remaining query parameters
      const remainingSearch = parsed.searchParams.toString();
      const cleanSearch = remainingSearch ? `?${remainingSearch}` : '';

      // Re-encode path segments to preserve URL-encoded characters in path
      const encodedSegments = pathParam
        .split('/')
        .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
        .join('/');

      // Reconstruct clean canonical path starting with /api
      const cleanPath = encodedSegments.startsWith('/') ? encodedSegments : `/${encodedSegments}`;
      req.url = `/api${cleanPath === '/' ? '' : cleanPath}${cleanSearch}`;
      return;
    }
  } catch {
    // If URL parsing fails, fall through to fallback
  }

  // Fallback for direct invocations without rewrite (e.g. /api/health)
  if (!rawUrl.startsWith('/api')) {
    req.url = '/api' + (rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl);
  }
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  try {
    reconstructRequestedUrl(req);

    const handled = await handleApiRequest(req, res);
    if (!handled && !res.writableEnded) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  } catch (err: unknown) {
    // Detailed error logged only on the server — never leaked to client
    console.error('[API Serverless Error]:', err);

    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Internal Server Error',
          message: 'An error occurred while processing the request.',
        })
      );
    }
  }
}

/**
 * Vercel Serverless Function — catches all /api/* requests.
 *
 * File-based routing: api/[...path].ts → matches /api/anything
 *
 * The Node.js runtime is required (not Edge) because:
 *   - bcryptjs uses synchronous crypto not available in the Edge runtime
 *   - jose JWT signing uses Node crypto
 *   - @neondatabase/serverless works in both, but we need the above
 */
import type { IncomingMessage, ServerResponse } from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local in local preview builds (Vercel injects vars directly in production)
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import { handleApiRequest } from '../server/apiHandler';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  await handleApiRequest(req, res);
}


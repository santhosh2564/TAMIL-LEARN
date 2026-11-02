/**
 * Vercel Serverless Function — fallback for direct /api/[...path] matches.
 * Delegates to the unified handler in api/index.ts
 */
export { default, config } from './index';

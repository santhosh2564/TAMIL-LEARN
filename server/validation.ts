/**
 * Centralised Zod schemas and body-parsing helper for all API routes.
 * Never import from here in client-side code.
 */
import { z } from 'zod';
import { IncomingMessage, ServerResponse } from 'http';

// ── Re-export zod so callers don't need to import it separately ──────────────
export { z };

// ── Generic body parser ──────────────────────────────────────────────────────
/**
 * Reads the request body and validates it against `schema`.
 * Returns `{ ok: true, data }` or sends a 400 and returns `{ ok: false }`.
 *
 * Supports both:
 *  - Vercel Node runtime (body pre-parsed as req.body)
 *  - Raw Node / Vite dev (streaming body)
 */
export async function parseBody<T>(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false }> {
  let raw: unknown;

  if (req.body !== undefined) {
    // Vercel pre-parses the body
    raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } else {
    raw = await readStream(req);
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    sendJson(res, 400, {
      error: 'Invalid request body',
      details: result.error.flatten().fieldErrors,
    });
    return { ok: false };
  }
  return { ok: true, data: result.data };
}

function readStream(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// ── Shared helper (duplicated here to avoid circular imports) ─────────────────
export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

// ── Request body schemas ─────────────────────────────────────────────────────

export const AdminLoginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(200),
});
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;

export const StudentUpsertSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().optional(),
  lastActiveAt: z.string().optional(),
});
export type StudentUpsertInput = z.infer<typeof StudentUpsertSchema>;

export const AttemptRecordSchema = z.object({
  id: z.string().optional(),
  activityId: z.string().min(1),
  category: z.string().optional(),
  attemptNumber: z.number().int().min(1).optional(),
  result: z.enum(['correct', 'incorrect']),
  completed: z.boolean(),
  timestamp: z.string().optional(),
});
export type AttemptRecordInput = z.infer<typeof AttemptRecordSchema>;

// ── Phase 3 Schemas ───────────────────────────────────────────────────────────
export const StudentLoginSchema = z.object({
  classCode: z.string().min(1, 'Class code is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  pin: z.array(z.string()).length(3, 'PIN must be exactly 3 pictures'),
});
export type StudentLoginInput = z.infer<typeof StudentLoginSchema>;

export const CreateClassSchema = z.object({
  name: z.string().min(1, 'Class name is required').max(100),
  grade: z.string().min(1, 'Grade is required').max(50),
  schoolId: z.string().optional(),
});
export type CreateClassInput = z.infer<typeof CreateClassSchema>;

export const CreateStudentSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  name: z.string().min(1, 'Name is required').max(100),
  rollNo: z.string().min(1, 'Roll number is required').max(50),
  avatar: z.string().min(1, 'Avatar is required'),
  pin: z.array(z.string()).length(3, 'PIN must be exactly 3 pictures'),
});
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

export const ResetPinSchema = z.object({
  pin: z.array(z.string()).length(3, 'PIN must be exactly 3 pictures'),
});
export type ResetPinInput = z.infer<typeof ResetPinSchema>;

// ── Phase 4 Schemas: Learning Sessions ────────────────────────────────────────
export const CreateSessionSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  subject: z.enum(['tamil', 'english']),
  categoryOrModule: z.string().min(1).max(64),
  activityIds: z.array(z.string().min(1)).min(1),
  currentIndex: z.number().int().min(0).default(0),
});
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const UpdateSessionSchema = z.object({
  currentIndex: z.number().int().min(0).optional(),
  status: z.enum(['active', 'completed', 'abandoned']).optional(),
});
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;



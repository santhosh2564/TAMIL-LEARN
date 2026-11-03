/**
 * Centralised Zod schemas and body-parsing helper for all API routes.
 * Never import from here in client-side code.
 */
import { z } from 'zod';
import { IncomingMessage, ServerResponse } from 'http';

// â”€â”€ Re-export zod so callers don't need to import it separately â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export { z };

// â”€â”€ Generic body parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    try {
      raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON request body' });
      return { ok: false };
    }
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

// â”€â”€ Shared helper (duplicated here to avoid circular imports) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

// â”€â”€ Request body schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const AdminLoginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(200),
});
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;

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

// â”€â”€ Phase 3 Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const StudentSelectSchema = z.object({
  schoolId: z.string().optional(),
  classId: z.string().optional(),
  studentId: z.string().min(1, 'Student ID is required'),
  pin: z.array(z.string()).optional(),
});
export type StudentSelectInput = z.infer<typeof StudentSelectSchema>;

export const StudentResolveSchema = z.object({
  name: z.string().trim().min(1, 'Student name is required').max(100),
  schoolId: z.string().min(1, 'School ID is required'),
});
export type StudentResolveInput = z.infer<typeof StudentResolveSchema>;

export const StudentLoginSchema = z.object({
  schoolId: z.string().optional(),
  schoolCode: z.string().optional(),
  classCode: z.string().optional(),
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
  schoolId: z.string().optional(),
  classId: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(100),
  rollNo: z.string().max(50).optional(),
  rollNumber: z.string().max(50).optional(),
  section: z.string().max(20).default('A').optional(),
  avatar: z.string().min(1).default('avatar_default').optional(),
  pin: z.array(z.string()).optional(),
});
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

export const UpdateStudentSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(100).optional(),
  rollNumber: z.string().max(50).optional(),
  schoolId: z.string().optional(),
  classId: z.string().optional(),
  section: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

export const ResetPinSchema = z.object({
  pin: z.array(z.string()).length(3, 'PIN must be exactly 3 pictures'),
});
export type ResetPinInput = z.infer<typeof ResetPinSchema>;

// â”€â”€ Phase 4 Schemas: Learning Sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Academic Year Dynamic Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function getCurrentAcademicYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  // Standard Indian academic year begins around June (month >= 6)
  if (month >= 6) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

// â”€â”€ Assessment & Multi-School Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const CreateSchoolSchema = z.object({
  schoolName: z.string().min(1, 'School name is required').max(200),
  schoolCode: z.string().min(1, 'School code is required').max(50).optional(),
  address: z.string().max(500).optional(),
  academicYear: z.string().min(4).max(20).optional(),
});
export type CreateSchoolInput = z.infer<typeof CreateSchoolSchema>;

export const UpdateSchoolSchema = z.object({
  schoolName: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  academicYear: z.string().min(4).max(20).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateSchoolInput = z.infer<typeof UpdateSchoolSchema>;

export const CreateAssessmentSessionSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  studentId: z.string().min(1, 'Student ID is required'),
  subjectId: z.enum(['tamil', 'english']),
  moduleId: z.number().int().optional().nullable(),
  activityIds: z.array(z.string().min(1)).min(1),
  currentActivityId: z.string().optional(),
  currentQuestionId: z.string().optional(),
  currentIndex: z.number().int().min(0).default(0),
});
export type CreateAssessmentSessionInput = z.infer<typeof CreateAssessmentSessionSchema>;

export const UpdateAssessmentSessionSchema = z.object({
  currentActivityId: z.string().optional(),
  currentQuestionId: z.string().optional(),
  currentIndex: z.number().int().min(0).optional(),
  sessionStatus: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
});
export type UpdateAssessmentSessionInput = z.infer<typeof UpdateAssessmentSessionSchema>;

export const RecordQuestionAttemptSchema = z.object({
  id: z.string().optional(),
  sessionId: z.string().min(1, 'Session ID is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  subjectId: z.enum(['tamil', 'english']),
  moduleId: z.number().int().optional().nullable(),
  activityId: z.string().min(1, 'Activity ID is required'),
  questionId: z.string().min(1, 'Question ID is required'),
  answerPayload: z.record(z.string(), z.unknown()).default({}),
  isCorrect: z.boolean(),
  isCompleted: z.boolean(),
  attemptedAt: z.string().optional(),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});
export type RecordQuestionAttemptInput = z.infer<typeof RecordQuestionAttemptSchema>;

export const ImportStudentsSchema = z.object({
  classId: z.string().optional(),
  schoolId: z.string().optional(),
  students: z.array(
    z.object({
      name: z.string().min(1, 'Student name is required'),
      rollNumber: z.string().optional(),
      rollNo: z.string().optional(),
      section: z.string().default('A').optional(),
      avatar: z.string().default('avatar_default').optional(),
      schoolId: z.string().optional(),
      schoolCode: z.string().optional(),
      classId: z.string().optional(),
      className: z.string().optional(),
      pin: z.array(z.string()).optional(),
    })
  ).min(1, 'At least one student record is required'),
});
export type ImportStudentsInput = z.infer<typeof ImportStudentsSchema>;

/**
 * Central API request handler.
 * Shared by:
 *   - The Vite dev/preview plugin (vite.config.ts)
 *   - The Vercel serverless entry (api/[...path].ts)
 *
 * PUBLIC routes (no auth):
 *   GET  /api/health
 *   POST /api/admin/login
 *   POST /api/admin/logout
 *   GET  /api/admin/session
 *
 * ADMIN-ONLY routes (require valid admin session cookie):
 *   GET    /api/students
 *   DELETE /api/students/:id
 *   GET    /api/students/:id/progress
 *   POST   /api/students/:id/progress
 *   GET    /api/students/:id/attempts
 *   POST   /api/students/:id/attempts
 *
 * Student-scoped routes (Phase 3 will add student sessions):
 *   All student-related writes currently return 401 until Phase 3.
 */

import { IncomingMessage, ServerResponse } from 'http';
import {
  getDb,
  getStudentsFromDb,
  upsertStudentInDb,
  archiveStudentInDb,
  getProgressForStudentFromDb,
  recordAttemptInDb,
  getAttemptsForStudentFromDb,
  getAdminByUsername,
  incrementAdminFailedAttempts,
  resetAdminFailedAttempts,
  getClassByCode,
  getClassById,
  getClassesForSchool,
  createClassWithUniqueCode,
  archiveClassInDb,
  getStudentsForClassRoster,
  checkAndIncrementClassLookupRateLimit,
  getStudentById,
  getOrCreateStudentByNameAndSchool,
  unlockStudentPinInDb,
  updateStudentPinInDb,
  getActiveSessionForStudentFromDb,
  upsertActiveSessionInDb,
  updateSessionProgressInDb,
  getAdminDashboardMetrics,
  getAdminStudentSummaries,
  getAdminStudentDetail,
  getSchoolsWithStatsFromDb,
  getSchoolById,
  getActiveSchoolsFromDb,
  getStudentsForSchoolRoster,
  createSchoolInDb,
  updateSchoolInDb,
  getStudentsWithFiltersFromDb,
  updateStudentInDb,
  updateClassInDb,
  bulkImportStudentsInDb,
  createOrGetAssessmentSessionInDb,
  getAssessmentSessionByIdFromDb,
  getActiveAssessmentSessionForStudentFromDb,
  updateAssessmentSessionInDb,
  recordQuestionAttemptInDb,
  getQuestionAttemptsForSessionFromDb,
  getQuestionAttemptsForStudentFromDb,
  getOverallAdminMetrics,
  getSchoolReportFromDb,
  getStudentModuleProgressFromDb,
  getStudentSessionsReportFromDb,
  getSessionDetailReportFromDb,
  type StudentRow,
  type SessionRow,
} from './db.js';
import {
  requireAdminSession,
  signAdminSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
  verifyAdminSession,
  signStudentSession,
  setStudentCookie,
  clearStudentCookie,
  getStudentSession,
  requireStudentAccess,
  adminCanAccessStudent,
} from './auth.js';
import { verifyStudentPin, hashPin } from './studentPin.js';
import {
  sendJson,
  parseBody,
  AdminLoginSchema,
  AttemptRecordSchema,
  StudentLoginSchema,
  StudentSelectSchema,
  StudentResolveSchema,
  CreateClassSchema,
  CreateStudentSchema,
  UpdateStudentSchema,
  ResetPinSchema,
  CreateSessionSchema,
  UpdateSessionSchema,
  CreateSchoolSchema,
  UpdateSchoolSchema,
  CreateAssessmentSessionSchema,
  UpdateAssessmentSessionSchema,
  RecordQuestionAttemptSchema,
  ImportStudentsSchema,
} from './validation.js';
import bcrypt from 'bcryptjs';

// ── Client IP Helper ──────────────────────────────────────────────────────────
function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

// ── Startup validation ────────────────────────────────────────────────────────
// Validate env vars eagerly so a misconfigured deployment fails loudly.
export interface EnvValidationResult {
  valid: boolean;
  missingVars: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const missingVars: string[] = [];
  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!dbUrl) {
    missingVars.push('DATABASE_URL or DATABASE_URL_UNPOOLED');
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    missingVars.push('SESSION_SECRET');
  } else if (secret.length < 32) {
    missingVars.push('SESSION_SECRET (must be at least 32 characters)');
  }
  return {
    valid: missingVars.length === 0,
    missingVars,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function handleApiRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api')) {
    return false;
  }

  const [pathname] = url.split('?');

  // Allow OPTIONS for CORS pre-flight (no-op in practice; Vercel handles it)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  try {
    // ── PUBLIC: GET /api/health ───────────────────────────────────────────────
    if (pathname === '/api/health' && req.method === 'GET') {
      const envCheck = validateEnvironment();
      if (!envCheck.valid) {
        console.error('[Health Check Error] Missing configuration:', envCheck.missingVars.join(', '));
        sendJson(res, 503, {
          status: 'error',
          database: 'not_configured',
          message: 'Required environment variables are not configured.',
          missing: envCheck.missingVars,
        });
        return true;
      }

      try {
        const sql = getDb();
        await sql.query('SELECT 1;');
        sendJson(res, 200, { status: 'ok', database: 'connected' });
      } catch (dbErr: unknown) {
        console.error('[Health Check Error] Database query failed:', dbErr);
        sendJson(res, 503, {
          status: 'error',
          database: 'disconnected',
          message: 'Database service is currently unreachable.',
        });
      }
      return true;
    }

    // Validate environment for operational endpoints
    const envStatus = validateEnvironment();
    if (!envStatus.valid) {
      console.error('[Configuration Error] Missing required environment variables:', envStatus.missingVars.join(', '));
      sendJson(res, 500, {
        error: 'Server configuration error',
        message: 'The server is not properly configured. Please contact the administrator.',
      });
      return true;
    }

    // ── PUBLIC: POST /api/admin/login ─────────────────────────────────────────
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const parsed = await parseBody(req, res, AdminLoginSchema);
      if (!parsed.ok) return true;

      const { username, password } = parsed.data;

      // Always take the same code path regardless of whether the user exists
      const admin = await getAdminByUsername(username);

      // Check lockout
      if (admin?.locked_until && new Date(admin.locked_until) > new Date()) {
        // Use the same generic message to avoid username enumeration
        sendJson(res, 401, { error: 'Invalid username or password' });
        return true;
      }

      const passwordValid =
        admin !== null && (await bcrypt.compare(password, admin.password_hash));

      if (!passwordValid || !admin) {
        // Increment failed attempts if the admin row exists
        if (admin) {
          await incrementAdminFailedAttempts(admin.id);
        }
        sendJson(res, 401, { error: 'Invalid username or password' });
        return true;
      }

      // Successful login — reset failed attempts
      await resetAdminFailedAttempts(admin.id);

      const token = await signAdminSession({
        sub: admin.id,
        username: admin.username,
        role: admin.role,
        schoolId: admin.school_id,
      });

      setSessionCookie(res, token);
      sendJson(res, 200, {
        user: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
          schoolId: admin.school_id,
        },
      });
      return true;
    }

    // ── PUBLIC: POST /api/admin/logout ────────────────────────────────────────
    if (pathname === '/api/admin/logout' && req.method === 'POST') {
      clearSessionCookie(res);
      sendJson(res, 200, { success: true });
      return true;
    }

    // ── PUBLIC: GET /api/admin/session ────────────────────────────────────────
    if (pathname === '/api/admin/session' && req.method === 'GET') {
      const token = getSessionToken(req);
      if (!token) {
        sendJson(res, 401, { error: 'Not authenticated' });
        return true;
      }
      const payload = await verifyAdminSession(token);
      if (!payload) {
        clearSessionCookie(res);
        sendJson(res, 401, { error: 'Session expired or invalid' });
        return true;
      }
      sendJson(res, 200, {
        user: {
          id: payload.sub,
          username: payload.username,
          role: payload.role,
          schoolId: payload.schoolId,
        },
      });
      return true;
    }

    // ── PUBLIC: GET /api/public/schools ───────────────────────────────────────
    if (pathname === '/api/public/schools' && req.method === 'GET') {
      const schools = await getActiveSchoolsFromDb();
      sendJson(res, 200, { schools });
      return true;
    }

    // ── PUBLIC: GET /api/schools/:schoolId/roster ─────────────────────────────
    const schoolRosterMatch = pathname.match(/^\/api\/schools\/([^/]+)\/roster$/);
    if (schoolRosterMatch && req.method === 'GET') {
      const schoolId = decodeURIComponent(schoolRosterMatch[1]);
      const school = await getSchoolById(schoolId);
      if (!school || Boolean(school.archived_at)) {
        sendJson(res, 404, { error: 'School not found' });
        return true;
      }
      const students = await getStudentsForSchoolRoster(school.id);
      sendJson(res, 200, {
        school: {
          id: school.id,
          name: school.school_name || school.name,
          schoolCode: school.school_code,
        },
        students,
      });
      return true;
    }

    // ── PUBLIC: GET /api/classes/:classId/roster ─────────────────────────────
    const classRosterMatch = pathname.match(/^\/api\/classes\/([^/]+)\/roster$/);
    if (classRosterMatch && req.method === 'GET') {
      const classId = decodeURIComponent(classRosterMatch[1]);
      const cls = await getClassById(classId);
      if (!cls || Boolean(cls.archived_at)) {
        sendJson(res, 404, { error: 'Class not found' });
        return true;
      }
      const students = await getStudentsForClassRoster(cls.id);
      sendJson(res, 200, {
        class: {
          id: cls.id,
          name: cls.name,
          grade: cls.grade,
          schoolId: cls.school_id,
        },
        students,
      });
      return true;
    }

    // ── PUBLIC: POST /api/student/resolve ─────────────────────────────────────
    // Automatic student resolution by normalized name and school.
    // If student exists in the school with the same normalized name, resumes that learner.
    // Otherwise, automatically provisions a new student record in Neon.
    if (pathname === '/api/student/resolve' && req.method === 'POST') {
      const parsed = await parseBody(req, res, StudentResolveSchema);
      if (!parsed.ok) return true;

      const { name, schoolId } = parsed.data;
      const school = await getSchoolById(schoolId);
      if (!school || school.archived_at !== null) {
        sendJson(res, 404, { error: 'School not found or archived' });
        return true;
      }

      try {
        const { student, isNew } = await getOrCreateStudentByNameAndSchool(name, schoolId);

        const token = await signStudentSession({
          studentId: student.id,
          schoolId: student.school_id,
          classId: student.class_id || '',
        });
        setStudentCookie(res, token);

        sendJson(res, 200, {
          success: true,
          isNew,
          student: {
            id: student.id,
            name: student.name.trim(),
            avatar: student.avatar,
            classId: student.class_id,
            schoolId: student.school_id,
          },
        });
      } catch (err: unknown) {
        console.error('[Student Resolve Error]:', err);
        sendJson(res, 500, {
          error: 'Failed to resolve student',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
      return true;
    }

    // ── PUBLIC: POST /api/student/select ──────────────────────────────────────
    if (pathname === '/api/student/select' && req.method === 'POST') {
      const parsed = await parseBody(req, res, StudentSelectSchema);
      if (!parsed.ok) return true;

      const { classId, schoolId, studentId, pin } = parsed.data;

      const student = await getStudentById(studentId);
      if (!student || student.archived_at !== null) {
        sendJson(res, 404, { error: 'Student not found or archived' });
        return true;
      }

      if (schoolId) {
        if (student.school_id !== schoolId) {
          sendJson(res, 404, { error: 'Student not found in this school' });
          return true;
        }
      } else if (classId && student.class_id && student.class_id !== classId) {
        sendJson(res, 404, { error: 'Student not found in this class' });
        return true;
      }

      if (student.pin_hash && pin) {
        const pinResult = await verifyStudentPin(studentId, pin);
        if (!pinResult.success) {
          sendJson(res, pinResult.locked ? 423 : 401, { error: pinResult.error, locked: pinResult.locked });
          return true;
        }
      }

      const sql = getDb();
      await sql.query('UPDATE students SET last_active_at = NOW() WHERE id = $1;', [student.id]);

      const token = await signStudentSession({
        studentId: student.id,
        schoolId: student.school_id,
        classId: student.class_id || '',
      });
      setStudentCookie(res, token);

      sendJson(res, 200, {
        success: true,
        student: {
          id: student.id,
          name: student.name.trim().split(' ')[0],
          avatar: student.avatar,
          classId: student.class_id || '',
          schoolId: student.school_id,
        },
      });
      return true;
    }

    // ── PUBLIC: GET /api/classes/by-code/:classCode ──────────────────────────
    const getClassByCodeMatch = pathname.match(/^\/api\/classes\/by-code\/([^/]+)$/);
    if (getClassByCodeMatch && req.method === 'GET') {
      const classCode = decodeURIComponent(getClassByCodeMatch[1]).trim().toUpperCase();
      const ip = getClientIp(req);

      const cls = await getClassByCode(classCode);
      const isInvalid = !cls || cls.id === 'class_legacy' || cls.class_code === 'LEGACY' || Boolean(cls.archived_at);
      const kind: 'invalid' | 'valid' = isInvalid ? 'invalid' : 'valid';

      const dbRateLimit = await checkAndIncrementClassLookupRateLimit(ip, kind);
      if (!dbRateLimit.allowed) {
        sendJson(res, 429, { error: 'Too many requests. Please wait before trying again.' });
        return true;
      }

      if (isInvalid) {
        sendJson(res, 404, { error: 'Class not found' });
        return true;
      }

      const students = await getStudentsForClassRoster(cls.id);
      sendJson(res, 200, {
        class: {
          id: cls.id,
          name: cls.name,
          grade: cls.grade,
          classCode: cls.class_code,
        },
        students,
      });
      return true;
    }
    // ── PUBLIC: POST /api/student/login ───────────────────────────────────────
    if (pathname === '/api/student/login' && req.method === 'POST') {
      const parsed = await parseBody(req, res, StudentLoginSchema);
      if (!parsed.ok) return true;

      const { classCode, studentId, pin, schoolId } = parsed.data;
      const student = await getStudentById(studentId);
      if (!student || student.archived_at !== null) {
        sendJson(res, 404, { error: 'Student not found' });
        return true;
      }

      if (classCode) {
        const cls = await getClassByCode(classCode);
        if (!cls || cls.id === 'class_legacy' || cls.class_code === 'LEGACY' || cls.archived_at !== null) {
          sendJson(res, 404, { error: 'Class not found' });
          return true;
        }
        if (student.class_id !== cls.id) {
          sendJson(res, 404, { error: 'Student not found in this class' });
          return true;
        }
      } else if (schoolId) {
        if (student.school_id !== schoolId) {
          sendJson(res, 404, { error: 'Student not found in this school' });
          return true;
        }
      }

      const pinResult = await verifyStudentPin(studentId, pin);
      if (!pinResult.success) {
        if (pinResult.locked) {
          sendJson(res, 423, { error: pinResult.error, locked: true });
          return true;
        }
        sendJson(res, 401, { error: pinResult.error, locked: false });
        return true;
      }

      const token = await signStudentSession({
        studentId: student.id,
        schoolId: student.school_id,
        classId: student.class_id,
      });

      setStudentCookie(res, token);
      sendJson(res, 200, {
        success: true,
        student: {
          id: student.id,
          name: student.name.trim().split(' ')[0],
          avatar: student.avatar,
          classId: student.class_id,
        },
      });
      return true;
    }

    // ── PUBLIC: POST /api/student/logout ──────────────────────────────────────
    if (pathname === '/api/student/logout' && req.method === 'POST') {
      clearStudentCookie(res);
      sendJson(res, 200, { success: true });
      return true;
    }

    // ── PUBLIC: GET /api/student/session ──────────────────────────────────────
    if (pathname === '/api/student/session' && req.method === 'GET') {
      const session = await getStudentSession(req);
      if (!session) {
        sendJson(res, 401, { error: 'No active student session' });
        return true;
      }

      const student = await getStudentById(session.sub);
      if (!student || student.archived_at !== null) {
        clearStudentCookie(res);
        sendJson(res, 401, { error: 'Student not found or archived' });
        return true;
      }

      sendJson(res, 200, {
        student: {
          id: student.id,
          name: student.name.trim().split(' ')[0],
          avatar: student.avatar,
          classId: student.class_id,
          schoolId: student.school_id,
        },
      });
      return true;
    }

    // ── STUDENT / ADMIN SCOPED DATA ROUTES ────────────────────────────────────
    // ── GET /api/students/:studentId/progress ─────────────────────────────────
    const getProgressMatch = pathname.match(/^\/api\/students\/([^/]+)\/progress$/);
    if (getProgressMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(getProgressMatch[1]);
      const caller = await requireStudentAccess(req, res, studentId);
      if (!caller) return true; // 401 or 403 sent

      const rows = await getProgressForStudentFromDb(studentId);
      const progress = rows.map((r) => ({
        studentId: r.student_id,
        activityId: r.activity_id,
        category: r.category,
        completed: r.completed,
        correct: r.correct,
        attempts: r.attempts,
        correctAttempts: r.correct_attempts,
        incorrectAttempts: r.incorrect_attempts,
        retryCount: r.retry_count,
        firstAttemptCorrect: r.first_attempt_correct ?? undefined,
        finalCorrect: r.final_correct ?? undefined,
        lastCompletedAt: r.last_completed_at ?? undefined,
        lastAttemptedAt: r.last_attempted_at,
      }));
      sendJson(res, 200, { studentId, progress });
      return true;
    }

    // ── GET /api/students/:studentId/attempts ─────────────────────────────────
    const getAttemptsMatch = pathname.match(/^\/api\/students\/([^/]+)\/attempts$/);
    if (getAttemptsMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(getAttemptsMatch[1]);
      const caller = await requireStudentAccess(req, res, studentId);
      if (!caller) return true;

      const rows = await getAttemptsForStudentFromDb(studentId);
      const attempts = rows.map((r) => ({
        id: r.id,
        studentId: r.student_id,
        activityId: r.activity_id,
        category: r.category,
        attemptNumber: r.attempt_number,
        result: r.result,
        completed: r.completed,
        timestamp: r.timestamp,
      }));
      sendJson(res, 200, { studentId, attempts });
      return true;
    }

    // ── POST /api/students/:studentId/attempts ────────────────────────────────
    const postAttemptsMatch = pathname.match(/^\/api\/students\/([^/]+)\/attempts$/);
    if (postAttemptsMatch && req.method === 'POST') {
      const studentId = decodeURIComponent(postAttemptsMatch[1]);
      const caller = await requireStudentAccess(req, res, studentId);
      if (!caller) return true;

      const parsed = await parseBody(req, res, AttemptRecordSchema);
      if (!parsed.ok) return true;

      const a = parsed.data;

      const result = await recordAttemptInDb({
        id: a.id ?? `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        studentId,
        activityId: a.activityId,
        category: a.category,
        attemptNumber: a.attemptNumber ?? 1,
        result: a.result,
        completed: a.completed,
        timestamp: a.timestamp ?? new Date().toISOString(),
      });

      if (result.status === 'not_found') {
        sendJson(res, 404, { error: 'Student not found or archived' });
        return true;
      }

      sendJson(res, 200, { success: true, status: result.status });
      return true;
    }

    // ── Helper to format SessionRow into API response ─────────────────────────
    function formatSession(r: SessionRow) {
      return {
        id: r.id,
        schoolId: r.school_id,
        studentId: r.student_id,
        subject: r.subject,
        categoryOrModule: r.category_or_module,
        activityIds: r.activity_ids,
        currentIndex: r.current_index,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }

    // ── GET /api/students/:studentId/sessions/active ───────────────────────────
    const getActiveSessionMatch = pathname.match(/^\/api\/students\/([^/]+)\/sessions\/active$/);
    if (getActiveSessionMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(getActiveSessionMatch[1]);
      const caller = await requireStudentAccess(req, res, studentId);
      if (!caller) return true;

      const searchParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
      const subject = searchParams.get('subject') || undefined;
      const category = searchParams.get('category') || undefined;

      const sessionRow = await getActiveSessionForStudentFromDb(studentId, subject, category);
      sendJson(res, 200, { session: sessionRow ? formatSession(sessionRow) : null });
      return true;
    }

    // ── POST /api/students/:studentId/sessions ────────────────────────────────
    const postSessionMatch = pathname.match(/^\/api\/students\/([^/]+)\/sessions$/);
    if (postSessionMatch && req.method === 'POST') {
      const studentId = decodeURIComponent(postSessionMatch[1]);
      const caller = await requireStudentAccess(req, res, studentId);
      if (!caller) return true;

      const parsed = await parseBody(req, res, CreateSessionSchema);
      if (!parsed.ok) return true;

      const b = parsed.data;
      try {
        const sessionRow = await upsertActiveSessionInDb({
          id: b.id ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          studentId,
          subject: b.subject,
          categoryOrModule: b.categoryOrModule,
          activityIds: b.activityIds,
          currentIndex: b.currentIndex,
        });
        sendJson(res, 201, { session: formatSession(sessionRow) });
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Student not found')) {
          sendJson(res, 404, { error: 'Student not found or archived' });
          return true;
        }
        throw err;
      }
    }

    // ── PATCH /api/students/:studentId/sessions/:sessionId ────────────────────
    const patchSessionMatch = pathname.match(/^\/api\/students\/([^/]+)\/sessions\/([^/]+)$/);
    if (patchSessionMatch && req.method === 'PATCH') {
      const studentId = decodeURIComponent(patchSessionMatch[1]);
      const sessionId = decodeURIComponent(patchSessionMatch[2]);
      const caller = await requireStudentAccess(req, res, studentId);
      if (!caller) return true;

      const parsed = await parseBody(req, res, UpdateSessionSchema);
      if (!parsed.ok) return true;

      const sessionRow = await updateSessionProgressInDb({
        sessionId,
        studentId,
        currentIndex: parsed.data.currentIndex,
        status: parsed.data.status,
      });

      if (!sessionRow) {
        sendJson(res, 404, { error: 'Session not found for student' });
        return true;
      }

      sendJson(res, 200, { session: formatSession(sessionRow) });
      return true;
    }

    // ── ASSESSMENT SESSIONS (STUDENT / ADMIN ACCESSIBLE) ───────────────────────
    // ── GET /api/students/:studentId/assessment-sessions/active ────────────────
    const getActiveAssessmentSessionMatch = pathname.match(/^\/api\/students\/([^/]+)\/assessment-sessions\/active$/);
    if (getActiveAssessmentSessionMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(getActiveAssessmentSessionMatch[1]);
      const caller = await requireStudentAccess(req, res, studentId);
      if (!caller) return true;

      const searchParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
      const subjectId = searchParams.get('subject') || undefined;
      const moduleIdStr = searchParams.get('module');
      const moduleId = moduleIdStr ? Number(moduleIdStr) : null;

      const session = await getActiveAssessmentSessionForStudentFromDb(studentId, subjectId, moduleId);
      sendJson(res, 200, { session });
      return true;
    }

    // ── POST /api/assessment-sessions ─────────────────────────────────────────
    if (pathname === '/api/assessment-sessions' && req.method === 'POST') {
      const parsed = await parseBody(req, res, CreateAssessmentSessionSchema);
      if (!parsed.ok) return true;

      const caller = await requireStudentAccess(req, res, parsed.data.studentId);
      if (!caller) return true;

      // Always bind studentId to the verified caller when called with a student session
      const studentId = caller.type === 'student' ? caller.student.sub : parsed.data.studentId;

      try {
        const session = await createOrGetAssessmentSessionInDb({
          id: parsed.data.id,
          studentId,
          subjectId: parsed.data.subjectId,
          moduleId: parsed.data.moduleId,
          activityIds: parsed.data.activityIds,
          currentActivityId: parsed.data.currentActivityId,
          currentQuestionId: parsed.data.currentQuestionId,
          currentIndex: parsed.data.currentIndex,
        });
        sendJson(res, 201, { session });
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Student not found')) {
          sendJson(res, 404, { error: 'Student not found or archived' });
          return true;
        }
        throw err;
      }
    }

    // ── GET /api/assessment-sessions/:sessionId ───────────────────────────────
    const getAssessmentSessionMatch = pathname.match(/^\/api\/assessment-sessions\/([^/]+)$/);
    if (getAssessmentSessionMatch && req.method === 'GET') {
      const sessionId = decodeURIComponent(getAssessmentSessionMatch[1]);
      const session = await getAssessmentSessionByIdFromDb(sessionId);
      if (!session) {
        sendJson(res, 404, { error: 'Assessment session not found' });
        return true;
      }

      const caller = await requireStudentAccess(req, res, session.student_id);
      if (!caller) return true;

      sendJson(res, 200, { session });
      return true;
    }

    // ── PATCH /api/assessment-sessions/:sessionId ─────────────────────────────
    if (getAssessmentSessionMatch && req.method === 'PATCH') {
      const sessionId = decodeURIComponent(getAssessmentSessionMatch[1]);
      const existing = await getAssessmentSessionByIdFromDb(sessionId);
      if (!existing) {
        sendJson(res, 404, { error: 'Assessment session not found' });
        return true;
      }

      const caller = await requireStudentAccess(req, res, existing.student_id);
      if (!caller) return true;

      const parsed = await parseBody(req, res, UpdateAssessmentSessionSchema);
      if (!parsed.ok) return true;

      const updated = await updateAssessmentSessionInDb({
        sessionId,
        studentId: existing.student_id,
        currentActivityId: parsed.data.currentActivityId,
        currentQuestionId: parsed.data.currentQuestionId,
        currentIndex: parsed.data.currentIndex,
        sessionStatus: parsed.data.sessionStatus,
      });

      sendJson(res, 200, { session: updated });
      return true;
    }

    // ── POST /api/assessment-sessions/:sessionId/complete ─────────────────────
    const completeSessionMatch = pathname.match(/^\/api\/assessment-sessions\/([^/]+)\/complete$/);
    if (completeSessionMatch && req.method === 'POST') {
      const sessionId = decodeURIComponent(completeSessionMatch[1]);
      const existing = await getAssessmentSessionByIdFromDb(sessionId);
      if (!existing) {
        sendJson(res, 404, { error: 'Assessment session not found' });
        return true;
      }

      const caller = await requireStudentAccess(req, res, existing.student_id);
      if (!caller) return true;

      const updated = await updateAssessmentSessionInDb({
        sessionId,
        studentId: existing.student_id,
        sessionStatus: 'completed',
      });

      sendJson(res, 200, { session: updated });
      return true;
    }

    // ── QUESTION ATTEMPTS (STUDENT / ADMIN ACCESSIBLE) ─────────────────────────
    // ── POST /api/question-attempts ───────────────────────────────────────────
    if (pathname === '/api/question-attempts' && req.method === 'POST') {
      const parsed = await parseBody(req, res, RecordQuestionAttemptSchema);
      if (!parsed.ok) return true;

      const caller = await requireStudentAccess(req, res, parsed.data.studentId);
      if (!caller) return true;

      // Always bind studentId to the verified caller when called with a student session
      const studentId = caller.type === 'student' ? caller.student.sub : parsed.data.studentId;

      try {
        const result = await recordQuestionAttemptInDb({
          id: parsed.data.id,
          sessionId: parsed.data.sessionId,
          studentId,
          subjectId: parsed.data.subjectId,
          moduleId: parsed.data.moduleId,
          activityId: parsed.data.activityId,
          questionId: parsed.data.questionId,
          answerPayload: parsed.data.answerPayload as Record<string, unknown>,
          isCorrect: parsed.data.isCorrect,
          isCompleted: parsed.data.isCompleted,
          attemptedAt: parsed.data.attemptedAt,
          idempotencyKey: parsed.data.idempotencyKey,
        });

        sendJson(res, result.status === 'duplicate' ? 200 : 201, result);
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Student not found')) {
          sendJson(res, 404, { error: 'Student not found or archived' });
          return true;
        }
        throw err;
      }
    }

    // ── GET /api/assessment-sessions/:sessionId/attempts ──────────────────────
    const getSessionAttemptsMatch = pathname.match(/^\/api\/assessment-sessions\/([^/]+)\/attempts$/);
    if (getSessionAttemptsMatch && req.method === 'GET') {
      const sessionId = decodeURIComponent(getSessionAttemptsMatch[1]);
      const session = await getAssessmentSessionByIdFromDb(sessionId);
      if (!session) {
        sendJson(res, 404, { error: 'Assessment session not found' });
        return true;
      }

      const caller = await requireStudentAccess(req, res, session.student_id);
      if (!caller) return true;

      const attempts = await getQuestionAttemptsForSessionFromDb(sessionId);
      sendJson(res, 200, { sessionId, attempts });
      return true;
    }

    // ── GET /api/students/:studentId/question-attempts ────────────────────────
    const getStudentQuestionAttemptsMatch = pathname.match(/^\/api\/students\/([^/]+)\/question-attempts$/);
    if (getStudentQuestionAttemptsMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(getStudentQuestionAttemptsMatch[1]);
      const caller = await requireStudentAccess(req, res, studentId);
      if (!caller) return true;

      const attempts = await getQuestionAttemptsForStudentFromDb(studentId);
      sendJson(res, 200, { studentId, attempts });
      return true;
    }

    // ── All routes below require a valid ADMIN session ────────────────────────
    const isAdminRoute =
      pathname.startsWith('/api/admin/') ||
      pathname.startsWith('/api/students') ||
      pathname.startsWith('/api/schools');

    if (!isAdminRoute) {
      sendJson(res, 404, { error: 'Not found' });
      return true;
    }

    const session = await requireAdminSession(req, res);
    if (!session) return true; // 401 already sent

    // ── Enforce school_admin scope: missing school_id must DENY (403) ──────────
    if (session.role === 'school_admin' && !session.schoolId) {
      sendJson(res, 403, { error: 'Access denied: school_admin has no assigned school scope' });
      return true;
    }

    // ── GET /api/admin/metrics ────────────────────────────────────────────────
    if (pathname === '/api/admin/metrics' && req.method === 'GET') {
      const schoolScope = session.role === 'school_admin' ? (session.schoolId ?? undefined) : undefined;
      const metrics = await getAdminDashboardMetrics(schoolScope);
      sendJson(res, 200, { metrics });
      return true;
    }

    // ── GET /api/admin/reports/students ────────────────────────────────────────
    if (pathname === '/api/admin/reports/students' && req.method === 'GET') {
      const schoolScope = session.role === 'school_admin' ? (session.schoolId ?? undefined) : undefined;
      const students = await getAdminStudentSummaries(schoolScope);
      sendJson(res, 200, { students });
      return true;
    }

    // ── GET /api/admin/students/:studentId/detail ─────────────────────────────
    const getStudentDetailMatch = pathname.match(/^\/api\/admin\/students\/([^/]+)\/detail$/);
    if (getStudentDetailMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(getStudentDetailMatch[1]);
      if (!(await adminCanAccessStudent(session, studentId))) {
        sendJson(res, 403, { error: 'Forbidden: student belongs to another school' });
        return true;
      }
      const detail = await getAdminStudentDetail(studentId);
      if (!detail) {
        sendJson(res, 404, { error: 'Student not found' });
        return true;
      }
      sendJson(res, 200, { detail });
      return true;
    }

    // ── GET /api/admin/classes ────────────────────────────────────────────────
    if (pathname === '/api/admin/classes' && req.method === 'GET') {
      const schoolScope = session.role === 'school_admin' ? session.schoolId : undefined;
      const classes = await getClassesForSchool(schoolScope);
      sendJson(res, 200, { classes });
      return true;
    }

    // ── SCHOOLS (ADMIN ONLY) ──────────────────────────────────────────────────
    // ── GET /api/schools ──────────────────────────────────────────────────────
    if (pathname === '/api/schools' && req.method === 'GET') {
      const schools = await getSchoolsWithStatsFromDb();
      sendJson(res, 200, { schools });
      return true;
    }

    // ── POST /api/schools ─────────────────────────────────────────────────────
    if (pathname === '/api/schools' && req.method === 'POST') {
      const parsed = await parseBody(req, res, CreateSchoolSchema);
      if (!parsed.ok) return true;

      const newSchool = await createSchoolInDb({
        schoolName: parsed.data.schoolName,
        schoolCode: parsed.data.schoolCode,
        address: parsed.data.address,
        academicYear: parsed.data.academicYear,
      });
      sendJson(res, 201, { school: newSchool });
      return true;
    }

    // ── PATCH /api/schools/:id ────────────────────────────────────────────────
    const patchSchoolMatch = pathname.match(/^\/api\/schools\/([^/]+)$/);
    if (patchSchoolMatch && req.method === 'PATCH') {
      const schoolId = decodeURIComponent(patchSchoolMatch[1]);
      const parsed = await parseBody(req, res, UpdateSchoolSchema);
      if (!parsed.ok) return true;

      const updated = await updateSchoolInDb(schoolId, {
        schoolName: parsed.data.schoolName,
        address: parsed.data.address,
        academicYear: parsed.data.academicYear,
        isActive: parsed.data.isActive,
      });

      if (!updated) {
        sendJson(res, 404, { error: 'School not found' });
        return true;
      }

      sendJson(res, 200, { school: updated });
      return true;
    }

    // ── POST /api/admin/students/import ───────────────────────────────────────
    if (pathname === '/api/admin/students/import' && req.method === 'POST') {
      const parsed = await parseBody(req, res, ImportStudentsSchema);
      if (!parsed.ok) return true;

      let defaultSchoolId = parsed.data.schoolId;
      if (!defaultSchoolId && parsed.data.classId) {
        const targetClass = await getClassById(parsed.data.classId);
        if (targetClass) defaultSchoolId = targetClass.school_id;
      }
      if (session.role === 'school_admin') {
        defaultSchoolId = session.schoolId ?? undefined;
      }

      try {
        const imported = await bulkImportStudentsInDb({
          classId: parsed.data.classId,
          schoolId: defaultSchoolId,
          students: parsed.data.students,
        });

        sendJson(res, 201, {
          success: true,
          count: imported.length,
          importedCount: imported.length,
          students: imported,
        });
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        sendJson(res, 400, { error: `Failed to import: ${message}` });
        return true;
      }
    }

    // ── REPORTS (ADMIN ONLY) ──────────────────────────────────────────────────
    // ── GET /api/admin/reports/overall ────────────────────────────────────────
    if (pathname === '/api/admin/reports/overall' && req.method === 'GET') {
      const metrics = await getOverallAdminMetrics();
      sendJson(res, 200, { metrics });
      return true;
    }

    // ── GET /api/admin/reports/schools/:schoolId ──────────────────────────────
    const getSchoolReportMatch = pathname.match(/^\/api\/admin\/reports\/schools\/([^/]+)$/);
    if (getSchoolReportMatch && req.method === 'GET') {
      const schoolId = decodeURIComponent(getSchoolReportMatch[1]);
      if (session.role === 'school_admin' && schoolId !== session.schoolId) {
        sendJson(res, 403, { error: 'Forbidden: Cannot access report for another school' });
        return true;
      }
      const report = await getSchoolReportFromDb(schoolId);
      if (!report) {
        sendJson(res, 404, { error: 'School not found' });
        return true;
      }
      sendJson(res, 200, { report });
      return true;
    }

    // ── GET /api/admin/reports/students/:studentId/progress ───────────────────
    const getStudentProgressReportMatch = pathname.match(/^\/api\/admin\/reports\/students\/([^/]+)\/progress$/);
    if (getStudentProgressReportMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(getStudentProgressReportMatch[1]);
      if (!(await adminCanAccessStudent(session, studentId))) {
        sendJson(res, 403, { error: 'Forbidden: student belongs to another school' });
        return true;
      }
      const progress = await getStudentModuleProgressFromDb(studentId);
      sendJson(res, 200, { studentId, progress });
      return true;
    }

    // ── GET /api/admin/reports/students/:studentId/sessions ───────────────────
    const getStudentSessionsReportMatch = pathname.match(/^\/api\/admin\/reports\/students\/([^/]+)\/sessions$/);
    if (getStudentSessionsReportMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(getStudentSessionsReportMatch[1]);
      if (!(await adminCanAccessStudent(session, studentId))) {
        sendJson(res, 403, { error: 'Forbidden: student belongs to another school' });
        return true;
      }
      const sessions = await getStudentSessionsReportFromDb(studentId);
      sendJson(res, 200, { studentId, sessions });
      return true;
    }

    // ── GET /api/admin/reports/sessions/:sessionId ────────────────────────────
    const getSessionReportMatch = pathname.match(/^\/api\/admin\/reports\/sessions\/([^/]+)$/);
    if (getSessionReportMatch && req.method === 'GET') {
      const sessionId = decodeURIComponent(getSessionReportMatch[1]);
      const report = await getSessionDetailReportFromDb(sessionId);
      if (!report) {
        sendJson(res, 404, { error: 'Session report not found' });
        return true;
      }
      if (!(await adminCanAccessStudent(session, report.session.student_id))) {
        sendJson(res, 403, { error: 'Forbidden: session belongs to another school' });
        return true;
      }
      sendJson(res, 200, { report });
      return true;
    }

    // ── POST /api/admin/classes ───────────────────────────────────────────────
    if (pathname === '/api/admin/classes' && req.method === 'POST') {
      const parsed = await parseBody(req, res, CreateClassSchema);
      if (!parsed.ok) return true;

      if (session.role === 'school_admin') {
        const bodySchoolId = parsed.data.schoolId || (req.body as Record<string, unknown> | undefined)?.schoolId;
        if (bodySchoolId && bodySchoolId !== session.schoolId) {
          sendJson(res, 403, { error: 'Forbidden: Cannot create class for another school' });
          return true;
        }
      }

      const schoolId = session.role === 'school_admin' ? session.schoolId! : (parsed.data.schoolId || 'school_unassigned');
      const newClass = await createClassWithUniqueCode({
        id: `cls_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        schoolId,
        name: parsed.data.name,
        grade: parsed.data.grade,
      });
      sendJson(res, 201, { class: newClass });
      return true;
    }

    // ── PATCH /api/admin/classes/:id ──────────────────────────────────────────
    const classMatch = pathname.match(/^\/api\/admin\/classes\/([^/]+)$/);
    if (classMatch && req.method === 'PATCH') {
      const classId = decodeURIComponent(classMatch[1]);
      const targetClass = await getClassById(classId);
      if (!targetClass) {
        sendJson(res, 404, { error: 'Class not found' });
        return true;
      }
      if (session.role === 'school_admin' && targetClass.school_id !== session.schoolId) {
        sendJson(res, 403, { error: 'Forbidden: Cannot edit class belonging to another school' });
        return true;
      }
      const parsed = await parseBody(req, res, CreateClassSchema.partial());
      if (!parsed.ok) return true;

      const updated = await updateClassInDb(classId, parsed.data);
      sendJson(res, 200, { class: updated });
      return true;
    }

    // ── DELETE /api/admin/classes/:id ─────────────────────────────────────────
    const deleteClassMatch = pathname.match(/^\/api\/admin\/classes\/([^/]+)$/);
    if (deleteClassMatch && req.method === 'DELETE') {
      const classId = decodeURIComponent(deleteClassMatch[1]);
      const targetClass = await getClassById(classId);
      if (!targetClass) {
        sendJson(res, 404, { error: 'Class not found' });
        return true;
      }
      if (session.role === 'school_admin' && targetClass.school_id !== session.schoolId) {
        sendJson(res, 403, { error: 'Forbidden: Cannot delete class belonging to another school' });
        return true;
      }
      await archiveClassInDb(classId);
      sendJson(res, 200, { success: true, archivedClassId: classId });
      return true;
    }

    // ── POST /api/admin/students ──────────────────────────────────────────────
    if (pathname === '/api/admin/students' && req.method === 'POST') {
      const parsed = await parseBody(req, res, CreateStudentSchema);
      if (!parsed.ok) return true;

      const { classId, schoolId: inputSchoolId, name, rollNo, rollNumber, section, avatar, pin } = parsed.data;

      let schoolId = inputSchoolId;
      if (classId) {
        const targetClass = await getClassById(classId);
        if (!targetClass || targetClass.archived_at !== null) {
          sendJson(res, 404, { error: 'Class not found' });
          return true;
        }
        if (session.role === 'school_admin' && targetClass.school_id !== session.schoolId) {
          sendJson(res, 403, { error: 'Forbidden: Cannot add student to another school' });
          return true;
        }
        schoolId = targetClass.school_id;
      }
      if (session.role === 'school_admin') {
        if (inputSchoolId && inputSchoolId !== session.schoolId) {
          sendJson(res, 403, { error: 'Forbidden: Cannot add student to another school' });
          return true;
        }
        schoolId = session.schoolId ?? undefined;
      }
      if (!schoolId) {
        const activeSchools = await getActiveSchoolsFromDb();
        if (activeSchools.length === 1) {
          schoolId = activeSchools[0].id;
        } else {
          sendJson(res, 400, { error: 'School ID is required' });
          return true;
        }
      }

      if (session.role === 'school_admin' && schoolId !== session.schoolId) {
        sendJson(res, 403, { error: 'Forbidden: Cannot add student to another school' });
        return true;
      }

      const rawRoll = rollNumber || rollNo;
      const studentRollNo = rawRoll && rawRoll.trim() ? rawRoll.trim() : `R${Date.now().toString().slice(-4)}`;

      // Check if roll number already exists in this school
      const sql = getDb();
      const existingRoll = await sql.query(
        `SELECT id FROM students WHERE school_id = $1 AND (roll_no = $2 OR roll_number = $2) AND archived_at IS NULL LIMIT 1;`,
        [schoolId, studentRollNo]
      );
      if (existingRoll.length > 0) {
        sendJson(res, 400, { error: `Roll number "${studentRollNo}" already exists in this school` });
        return true;
      }

      const pinHash = pin && pin.length === 3 ? await hashPin(pin) : null;
      const studentId = `stud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const studentAvatar = avatar || 'avatar_default';
      const studentSection = section && section.trim() ? section.trim().toUpperCase() : 'A';

      await upsertStudentInDb({
        id: studentId,
        name,
        schoolId,
        classId: classId || null,
        rollNo: studentRollNo,
        avatar: studentAvatar,
        pinHash,
      });

      await updateStudentInDb(studentId, { section: studentSection, rollNumber: studentRollNo });

      sendJson(res, 201, {
        success: true,
        student: {
          id: studentId,
          name,
          rollNo: studentRollNo,
          rollNumber: studentRollNo,
          roll_number: studentRollNo,
          section: studentSection,
          avatar: studentAvatar,
          classId: classId || '',
          schoolId,
        },
      });
      return true;
    }

    // ── POST /api/admin/students/:id/unlock ───────────────────────────────────
    const unlockStudentMatch = pathname.match(/^\/api\/admin\/students\/([^/]+)\/unlock$/);
    if (unlockStudentMatch && req.method === 'POST') {
      const studentId = decodeURIComponent(unlockStudentMatch[1]);
      const student = await getStudentById(studentId);
      if (!student) {
        sendJson(res, 404, { error: 'Student not found' });
        return true;
      }
      if (session.role === 'school_admin' && student.school_id !== session.schoolId) {
        sendJson(res, 403, { error: 'Forbidden: Cannot unlock student from another school' });
        return true;
      }
      await unlockStudentPinInDb(studentId);
      sendJson(res, 200, { success: true, unlockedStudentId: studentId });
      return true;
    }

    // ── POST /api/admin/students/:id/reset-pin ────────────────────────────────
    const resetPinMatch = pathname.match(/^\/api\/admin\/students\/([^/]+)\/reset-pin$/);
    if (resetPinMatch && req.method === 'POST') {
      const studentId = decodeURIComponent(resetPinMatch[1]);
      const student = await getStudentById(studentId);
      if (!student) {
        sendJson(res, 404, { error: 'Student not found' });
        return true;
      }
      if (session.role === 'school_admin' && student.school_id !== session.schoolId) {
        sendJson(res, 403, { error: 'Forbidden: Cannot reset PIN for student from another school' });
        return true;
      }
      const parsed = await parseBody(req, res, ResetPinSchema);
      if (!parsed.ok) return true;

      const pinHash = await hashPin(parsed.data.pin);
      await updateStudentPinInDb(studentId, pinHash);
      sendJson(res, 200, { success: true, resetStudentId: studentId });
      return true;
    }

    // ── GET /api/admin/classes/:id/cards ──────────────────────────────────────
    const classCardsMatch = pathname.match(/^\/api\/admin\/classes\/([^/]+)\/cards$/);
    if (classCardsMatch && req.method === 'GET') {
      const classId = decodeURIComponent(classCardsMatch[1]);
      const cls = await getClassById(classId);
      if (!cls || Boolean(cls.archived_at)) {
        sendJson(res, 404, { error: 'Class not found' });
        return true;
      }
      if (session.role === 'school_admin' && cls.school_id !== session.schoolId) {
        sendJson(res, 403, { error: 'Forbidden: Cannot view cards for another school' });
        return true;
      }
      const sql = getDb();
      const students = (await sql.query(
        'SELECT id, name, roll_no, avatar, failed_pin_attempts, locked_until FROM students WHERE class_id = $1 AND archived_at IS NULL ORDER BY roll_no ASC, name ASC;',
        [classId]
      )) as StudentRow[];

      sendJson(res, 200, {
        class: cls,
        students: students.map((s) => ({
          id: s.id,
          name: s.name,
          rollNo: s.roll_no,
          avatar: s.avatar,
          isLocked:
            s.failed_pin_attempts >= 5 ||
            (s.locked_until !== null && new Date(s.locked_until) > new Date()),
        })),
      });
      return true;
    }

    // ── GET /api/students ─────────────────────────────────────────────────────
    if (pathname === '/api/students' && req.method === 'GET') {
      const searchParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
      const schoolParam = searchParams.get('schoolId') || (session.role === 'school_admin' ? (session.schoolId ?? undefined) : undefined);
      const classParam = searchParams.get('classId') || undefined;
      const sectionParam = searchParams.get('section') || undefined;
      const searchStr = searchParams.get('search') || undefined;
      const statusParam = (searchParams.get('status') as 'active' | 'archived' | 'all') || undefined;
      const limitStr = searchParams.get('limit') || searchParams.get('pageSize');
      const offsetStr = searchParams.get('offset');
      const pageStr = searchParams.get('page');

      // If query parameters or pagination requested, return rich filtered student list
      if (classParam || sectionParam || searchStr || limitStr || offsetStr || pageStr || statusParam || searchParams.has('paginated')) {
        const limit = limitStr ? Number(limitStr) : 20;
        const page = pageStr ? Math.max(Number(pageStr), 1) : 1;
        const offset = offsetStr ? Number(offsetStr) : (page - 1) * limit;

        const result = await getStudentsWithFiltersFromDb({
          schoolId: schoolParam ?? undefined,
          classId: classParam,
          section: sectionParam,
          search: searchStr,
          status: statusParam,
          limit,
          offset,
        });

        const totalPages = Math.ceil(result.total / limit);

        sendJson(res, 200, {
          students: result.students.map((r) => ({
            id: r.id,
            name: r.name,
            studentName: r.name,
            rollNumber: r.roll_number,
            section: r.section,
            schoolId: r.school_id,
            schoolName: r.school_name,
            classId: r.class_id,
            className: r.class_name,
            avatar: r.avatar,
            isActive: (r.is_active !== false && !r.archived_at),
            is_active: (r.is_active !== false && !r.archived_at),
            archivedAt: r.archived_at,
            createdAt: r.created_at,
            lastActiveAt: r.last_active_at,
          })),
          total: result.total,
          page,
          pageSize: limit,
          totalPages,
        });
        return true;
      }

      const schoolScope = session.role === 'school_admin' ? session.schoolId : undefined;
      const rows = await getStudentsFromDb(schoolScope);
      const students = rows.map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        lastActiveAt: r.last_active_at,
      }));
      sendJson(res, 200, { students });
      return true;
    }

    // ── GET /api/students/:studentId ──────────────────────────────────────────
    const studentMatch = pathname.match(/^\/api\/students\/([^/]+)$/);
    if (studentMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(studentMatch[1]);
      if (!(await adminCanAccessStudent(session, studentId))) {
        sendJson(res, 403, { error: 'Forbidden: student belongs to another school' });
        return true;
      }
      const student = await getStudentById(studentId);
      if (!student) {
        sendJson(res, 404, { error: 'Student not found' });
        return true;
      }
      sendJson(res, 200, { student });
      return true;
    }

    // ── PATCH /api/students/:studentId ────────────────────────────────────────
    if (studentMatch && req.method === 'PATCH') {
      const studentId = decodeURIComponent(studentMatch[1]);
      if (!(await adminCanAccessStudent(session, studentId))) {
        sendJson(res, 403, { error: 'Forbidden: student belongs to another school' });
        return true;
      }
      const parsed = await parseBody(req, res, UpdateStudentSchema);
      if (!parsed.ok) return true;

      const updated = await updateStudentInDb(studentId, parsed.data);
      if (!updated) {
        sendJson(res, 404, { error: 'Student not found' });
        return true;
      }
      sendJson(res, 200, { student: updated });
      return true;
    }

    // ── DELETE /api/students/:studentId ───────────────────────────────────────
    if (studentMatch && req.method === 'DELETE') {
      const studentId = decodeURIComponent(studentMatch[1]);
      if (!(await adminCanAccessStudent(session, studentId))) {
        sendJson(res, 403, { error: 'Forbidden: student belongs to another school' });
        return true;
      }
      await archiveStudentInDb(studentId);
      sendJson(res, 200, { success: true, deletedStudentId: studentId });
      return true;
    }

    sendJson(res, 404, { error: 'Not found' });
    return true;
  } catch (err: unknown) {
    console.error(`API Error on ${req.method} ${url}:`, err instanceof Error ? err.message : err);
    sendJson(res, 500, { error: 'Internal server error' });
    return true;
  }
}

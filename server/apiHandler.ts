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
 *   POST   /api/students
 *   DELETE /api/students/:id
 *   GET    /api/students/:id/progress
 *   POST   /api/students/:id/progress
 *   GET    /api/students/:id/attempts
 *   POST   /api/students/:id/attempts
 *   POST   /api/sync
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
  getClassesForSchool,
  createClassWithUniqueCode,
  archiveClassInDb,
  getStudentsForClassRoster,
  checkAndIncrementClassLookupRateLimit,
  getStudentById,
  unlockStudentPinInDb,
  updateStudentPinInDb,
  type ClassRow,
  type StudentRow,
} from './db';
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
} from './auth';
import { verifyStudentPin, hashPin } from './studentPin';
import {
  sendJson,
  parseBody,
  AdminLoginSchema,
  StudentUpsertSchema,
  AttemptRecordSchema,
  SyncBatchSchema,
  StudentLoginSchema,
  CreateClassSchema,
  CreateStudentSchema,
  ResetPinSchema,
} from './validation';
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
function validateEnv(): void {
  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL env var is not set. ' +
        'The server cannot start without a database connection string.'
    );
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET env var is missing or shorter than 32 characters. ' +
        'Generate one with: openssl rand -base64 48'
    );
  }
}

let envValidated = false;

// ── Main handler ──────────────────────────────────────────────────────────────
export async function handleApiRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api')) {
    return false;
  }

  // Validate env once per process (throws on bad config)
  if (!envValidated) {
    validateEnv();
    envValidated = true;
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
      const sql = getDb();
      await sql.query('SELECT 1;');
      sendJson(res, 200, { status: 'ok', database: 'connected' });
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

    // ── PUBLIC: GET /api/classes/by-code/:classCode ──────────────────────────
    const getClassByCodeMatch = pathname.match(/^\/api\/classes\/by-code\/([^/]+)$/);
    if (getClassByCodeMatch && req.method === 'GET') {
      const classCode = decodeURIComponent(getClassByCodeMatch[1]).trim().toUpperCase();
      const ip = getClientIp(req);
      const rateLimit = await checkAndIncrementClassLookupRateLimit(ip);
      if (!rateLimit.allowed) {
        sendJson(res, 429, { error: 'Too many requests. Please wait before trying again.' });
        return true;
      }

      const cls = await getClassByCode(classCode);
      if (!cls || cls.id === 'class_legacy' || cls.class_code === 'LEGACY' || cls.archived_at !== null) {
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

      const { classCode, studentId, pin } = parsed.data;
      const cls = await getClassByCode(classCode);
      if (!cls || cls.id === 'class_legacy' || cls.class_code === 'LEGACY' || cls.archived_at !== null) {
        sendJson(res, 404, { error: 'Class not found' });
        return true;
      }

      const student = await getStudentById(studentId);
      if (!student || student.class_id !== cls.id || student.archived_at !== null) {
        sendJson(res, 404, { error: 'Student not found in this class' });
        return true;
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

    // ── All routes below require a valid ADMIN session ────────────────────────
    const session = await requireAdminSession(req, res);
    if (!session) return true; // 401 already sent

    // ── Enforce school_admin scope: missing school_id must DENY (403) ──────────
    if (session.role === 'school_admin' && !session.schoolId) {
      sendJson(res, 403, { error: 'Access denied: school_admin has no assigned school scope' });
      return true;
    }

    // ── GET /api/admin/classes ────────────────────────────────────────────────
    if (pathname === '/api/admin/classes' && req.method === 'GET') {
      const schoolScope = session.role === 'school_admin' ? session.schoolId : undefined;
      const classes = await getClassesForSchool(schoolScope);
      sendJson(res, 200, { classes });
      return true;
    }

    // ── POST /api/admin/classes ───────────────────────────────────────────────
    if (pathname === '/api/admin/classes' && req.method === 'POST') {
      const parsed = await parseBody(req, res, CreateClassSchema);
      if (!parsed.ok) return true;

      const schoolId = session.role === 'school_admin' ? session.schoolId! : 'school_unassigned';
      const newClass = await createClassWithUniqueCode({
        id: `cls_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        schoolId,
        name: parsed.data.name,
        grade: parsed.data.grade,
      });
      sendJson(res, 201, { class: newClass });
      return true;
    }

    // ── DELETE /api/admin/classes/:id ─────────────────────────────────────────
    const deleteClassMatch = pathname.match(/^\/api\/admin\/classes\/([^/]+)$/);
    if (deleteClassMatch && req.method === 'DELETE') {
      const classId = decodeURIComponent(deleteClassMatch[1]);
      await archiveClassInDb(classId);
      sendJson(res, 200, { success: true, archivedClassId: classId });
      return true;
    }

    // ── POST /api/admin/students ──────────────────────────────────────────────
    if (pathname === '/api/admin/students' && req.method === 'POST') {
      const parsed = await parseBody(req, res, CreateStudentSchema);
      if (!parsed.ok) return true;

      const { classId, name, rollNo, avatar, pin } = parsed.data;
      const schoolId = session.role === 'school_admin' ? session.schoolId! : 'school_unassigned';
      const pinHash = await hashPin(pin);
      const studentId = `stud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      await upsertStudentInDb({
        id: studentId,
        name,
        schoolId,
        classId,
        rollNo,
        avatar,
        pinHash,
      });

      sendJson(res, 201, {
        success: true,
        student: { id: studentId, name, rollNo, avatar, classId, schoolId },
      });
      return true;
    }

    // ── POST /api/admin/students/:id/unlock ───────────────────────────────────
    const unlockStudentMatch = pathname.match(/^\/api\/admin\/students\/([^/]+)\/unlock$/);
    if (unlockStudentMatch && req.method === 'POST') {
      const studentId = decodeURIComponent(unlockStudentMatch[1]);
      await unlockStudentPinInDb(studentId);
      sendJson(res, 200, { success: true, unlockedStudentId: studentId });
      return true;
    }

    // ── POST /api/admin/students/:id/reset-pin ────────────────────────────────
    const resetPinMatch = pathname.match(/^\/api\/admin\/students\/([^/]+)\/reset-pin$/);
    if (resetPinMatch && req.method === 'POST') {
      const studentId = decodeURIComponent(resetPinMatch[1]);
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
      const sql = getDb();
      const classRows = (await sql.query(
        'SELECT * FROM classes WHERE id = $1 AND archived_at IS NULL LIMIT 1;',
        [classId]
      )) as ClassRow[];
      if (!classRows[0]) {
        sendJson(res, 404, { error: 'Class not found' });
        return true;
      }
      const cls = classRows[0];
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

    // ── POST /api/students ────────────────────────────────────────────────────
    if (pathname === '/api/students' && req.method === 'POST') {
      const parsed = await parseBody(req, res, StudentUpsertSchema);
      if (!parsed.ok) return true;

      const now = new Date().toISOString();
      const student = {
        id: parsed.data.id,
        name: parsed.data.name,
        createdAt: parsed.data.createdAt || now,
        lastActiveAt: parsed.data.lastActiveAt || now,
      };
      await upsertStudentInDb(student);
      sendJson(res, 200, { success: true, student });
      return true;
    }

    // ── DELETE /api/students/:studentId ───────────────────────────────────────
    const deleteStudentMatch = pathname.match(/^\/api\/students\/([^/]+)$/);
    if (deleteStudentMatch && req.method === 'DELETE') {
      const studentId = decodeURIComponent(deleteStudentMatch[1]);
      await archiveStudentInDb(studentId);
      sendJson(res, 200, { success: true, deletedStudentId: studentId });
      return true;
    }

    // ── POST /api/sync ────────────────────────────────────────────────────────
    if (pathname === '/api/sync' && req.method === 'POST') {
      const parsed = await parseBody(req, res, SyncBatchSchema);
      if (!parsed.ok) return true;

      const body = parsed.data;
      let syncedStudents = 0;
      let syncedAttempts = 0;

      if (body.students) {
        for (const s of body.students) {
          await upsertStudentInDb(s);
          syncedStudents++;
        }
      }

      if (body.attemptsByStudent) {
        for (const [sId, attList] of Object.entries(body.attemptsByStudent)) {
          for (const a of attList) {
            await recordAttemptInDb({
              id: a.id ?? `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              studentId: sId,
              activityId: a.activityId,
              category: a.category,
              attemptNumber: a.attemptNumber ?? 1,
              result: a.result,
              completed: a.completed,
              timestamp: a.timestamp ?? new Date().toISOString(),
            });
            syncedAttempts++;
          }
        }
      }

      sendJson(res, 200, {
        success: true,
        synced: { students: syncedStudents, attempts: syncedAttempts },
      });
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

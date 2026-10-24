import { IncomingMessage, ServerResponse } from 'http';
import {
  getDb,
  getStudentsFromDb,
  upsertStudentInDb,
  deleteStudentFromDb,
  getProgressForStudentFromDb,
  upsertProgressInDb,
  recordAttemptInDb,
  getAttemptsForStudentFromDb
} from './db';

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
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

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api')) {
    return false;
  }

  // Parse path without query string
  const [pathname] = url.split('?');

  try {
    // GET /api/health
    if (pathname === '/api/health' && req.method === 'GET') {
      const sql = getDb();
      await sql.query('SELECT 1;');
      sendJson(res, 200, {
        status: 'ok',
        database: 'connected',
        provider: 'Neon Lakebase Postgres',
        branch: process.env.NEON_BRANCH || 'production',
        timestamp: new Date().toISOString()
      });
      return true;
    }

    // GET /api/students
    if (pathname === '/api/students' && req.method === 'GET') {
      const rows = await getStudentsFromDb();
      const students = rows.map(r => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        lastActiveAt: r.last_active_at
      }));
      sendJson(res, 200, { students });
      return true;
    }

    // POST /api/students
    if (pathname === '/api/students' && req.method === 'POST') {
      const body = (await parseJsonBody(req)) as { id: string; name: string; createdAt?: string; lastActiveAt?: string };
      if (!body.id || !body.name) {
        sendJson(res, 400, { error: 'id and name are required' });
        return true;
      }
      const now = new Date().toISOString();
      const student = {
        id: body.id,
        name: body.name,
        createdAt: body.createdAt || now,
        lastActiveAt: body.lastActiveAt || now
      };
      await upsertStudentInDb(student);
      sendJson(res, 200, { success: true, student });
      return true;
    }

    // DELETE /api/students/:studentId
    const deleteStudentMatch = pathname.match(/^\/api\/students\/([^/]+)$/);
    if (deleteStudentMatch && req.method === 'DELETE') {
      const studentId = decodeURIComponent(deleteStudentMatch[1]);
      await deleteStudentFromDb(studentId);
      sendJson(res, 200, { success: true, deletedStudentId: studentId });
      return true;
    }

    // GET /api/students/:studentId/progress
    const getProgressMatch = pathname.match(/^\/api\/students\/([^/]+)\/progress$/);
    if (getProgressMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(getProgressMatch[1]);
      const rows = await getProgressForStudentFromDb(studentId);
      const progress = rows.map(r => ({
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
        lastAttemptAt: r.last_attempted_at
      }));
      sendJson(res, 200, { studentId, progress });
      return true;
    }

    // POST /api/students/:studentId/progress
    const postProgressMatch = pathname.match(/^\/api\/students\/([^/]+)\/progress$/);
    if (postProgressMatch && req.method === 'POST') {
      const studentId = decodeURIComponent(postProgressMatch[1]);
      const body = (await parseJsonBody(req)) as Record<string, unknown>;
      await upsertProgressInDb({
        studentId,
        activityId: String(body.activityId),
        category: String(body.category),
        completed: Boolean(body.completed),
        correct: Boolean(body.correct),
        attempts: Number(body.attempts || 1),
        correctAttempts: body.correctAttempts ? Number(body.correctAttempts) : undefined,
        incorrectAttempts: body.incorrectAttempts ? Number(body.incorrectAttempts) : undefined,
        retryCount: body.retryCount ? Number(body.retryCount) : undefined,
        firstAttemptCorrect: body.firstAttemptCorrect !== undefined ? Boolean(body.firstAttemptCorrect) : undefined,
        finalCorrect: body.finalCorrect !== undefined ? Boolean(body.finalCorrect) : undefined,
        lastCompletedAt: body.lastCompletedAt ? String(body.lastCompletedAt) : undefined,
        lastAttemptedAt: body.lastAttemptedAt ? String(body.lastAttemptedAt) : new Date().toISOString()
      });
      sendJson(res, 200, { success: true });
      return true;
    }

    // GET /api/students/:studentId/attempts
    const getAttemptsMatch = pathname.match(/^\/api\/students\/([^/]+)\/attempts$/);
    if (getAttemptsMatch && req.method === 'GET') {
      const studentId = decodeURIComponent(getAttemptsMatch[1]);
      const rows = await getAttemptsForStudentFromDb(studentId);
      const attempts = rows.map(r => ({
        id: r.id,
        studentId: r.student_id,
        activityId: r.activity_id,
        category: r.category,
        attemptNumber: r.attempt_number,
        result: r.result,
        completed: r.completed,
        timestamp: r.timestamp
      }));
      sendJson(res, 200, { studentId, attempts });
      return true;
    }

    // POST /api/students/:studentId/attempts
    const postAttemptsMatch = pathname.match(/^\/api\/students\/([^/]+)\/attempts$/);
    if (postAttemptsMatch && req.method === 'POST') {
      const studentId = decodeURIComponent(postAttemptsMatch[1]);
      const body = (await parseJsonBody(req)) as Record<string, unknown>;
      await recordAttemptInDb({
        id: String(body.id || `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        studentId,
        activityId: String(body.activityId),
        category: body.category ? String(body.category) : undefined,
        attemptNumber: Number(body.attemptNumber || 1),
        result: String(body.result || 'incorrect'),
        completed: Boolean(body.completed),
        timestamp: body.timestamp ? String(body.timestamp) : new Date().toISOString()
      });
      sendJson(res, 200, { success: true });
      return true;
    }

    // POST /api/sync (Batch synchronization)
    if (pathname === '/api/sync' && req.method === 'POST') {
      const body = (await parseJsonBody(req)) as {
        students?: { id: string; name: string; createdAt: string; lastActiveAt: string }[];
        progressByStudent?: Record<string, unknown[]>;
        attemptsByStudent?: Record<string, unknown[]>;
      };

      let syncedStudents = 0;
      let syncedProgress = 0;
      let syncedAttempts = 0;

      if (Array.isArray(body.students)) {
        for (const s of body.students) {
          await upsertStudentInDb(s);
          syncedStudents++;
        }
      }

      if (body.progressByStudent && typeof body.progressByStudent === 'object') {
        for (const [sId, progList] of Object.entries(body.progressByStudent)) {
          if (Array.isArray(progList)) {
            for (const item of progList) {
              const p = item as Record<string, unknown>;
              await upsertProgressInDb({
                studentId: sId,
                activityId: String(p.activityId),
                category: String(p.category),
                completed: Boolean(p.completed),
                correct: Boolean(p.correct),
                attempts: Number(p.attempts || 1),
                correctAttempts: p.correctAttempts ? Number(p.correctAttempts) : undefined,
                incorrectAttempts: p.incorrectAttempts ? Number(p.incorrectAttempts) : undefined,
                retryCount: p.retryCount ? Number(p.retryCount) : undefined,
                firstAttemptCorrect: p.firstAttemptCorrect !== undefined ? Boolean(p.firstAttemptCorrect) : undefined,
                finalCorrect: p.finalCorrect !== undefined ? Boolean(p.finalCorrect) : undefined,
                lastCompletedAt: p.lastCompletedAt ? String(p.lastCompletedAt) : undefined,
                lastAttemptedAt: p.lastAttemptedAt ? String(p.lastAttemptedAt) : undefined
              });
              syncedProgress++;
            }
          }
        }
      }

      if (body.attemptsByStudent && typeof body.attemptsByStudent === 'object') {
        for (const [sId, attList] of Object.entries(body.attemptsByStudent)) {
          if (Array.isArray(attList)) {
            for (const item of attList) {
              const a = item as Record<string, unknown>;
              await recordAttemptInDb({
                id: String(a.id),
                studentId: sId,
                activityId: String(a.activityId),
                category: a.category ? String(a.category) : undefined,
                attemptNumber: Number(a.attemptNumber || 1),
                result: String(a.result || 'incorrect'),
                completed: Boolean(a.completed),
                timestamp: String(a.timestamp || new Date().toISOString())
              });
              syncedAttempts++;
            }
          }
        }
      }

      sendJson(res, 200, {
        success: true,
        syncedStudents,
        syncedProgress,
        syncedAttempts,
        branch: process.env.NEON_BRANCH || 'production'
      });
      return true;
    }

    sendJson(res, 404, { error: `Not found: ${pathname}` });
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`API Error on ${req.method} ${pathname}:`, message);
    sendJson(res, 500, { error: message });
    return true;
  }
}

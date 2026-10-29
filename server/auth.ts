/**
 * Session management for admin authentication.
 *
 * Uses `jose` to create/verify signed JWT tokens stored in httpOnly cookies.
 * SESSION_SECRET must be ≥32 characters — throws at startup if not.
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from './validation';
import { getStudentSchoolId } from './db';

// ── Startup secret validation ────────────────────────────────────────────────
function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET env var is missing or shorter than 32 characters. ' +
        'Set a random secret of at least 32 chars before starting the server.'
    );
  }
  return new TextEncoder().encode(secret);
}

// Evaluated once at module load — throws if secret is invalid
let _secretKey: Uint8Array | null = null;
function getKey(): Uint8Array {
  if (!_secretKey) {
    _secretKey = getSessionSecret();
  }
  return _secretKey;
}

// ── Token shape ───────────────────────────────────────────────────────────────
export interface AdminSessionPayload extends JWTPayload {
  sub: string;        // admin id
  username: string;
  role: 'super_admin' | 'school_admin';
  schoolId: string | null;
}

const SESSION_COOKIE = 'sara_admin_session';
const SESSION_DURATION_SEC = 8 * 60 * 60; // 8 hours

// ── Sign ──────────────────────────────────────────────────────────────────────
export async function signAdminSession(payload: Omit<AdminSessionPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SEC}s`)
    .sign(getKey());
}

// ── Verify ────────────────────────────────────────────────────────────────────
export async function verifyAdminSession(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey());
    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

// ── Cookie helpers ─────────────────────────────────────────────────────────────
export function setSessionCookie(res: ServerResponse, token: string): void {
  const cookieParts = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_DURATION_SEC}`,
    'Path=/',
  ];
  // Only add Secure in production (Vercel sets NODE_ENV=production)
  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

export function clearSessionCookie(res: ServerResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/`
  );
}

export function getSessionToken(req: IncomingMessage): string | null {
  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name.trim() === SESSION_COOKIE) {
      return rest.join('=').trim();
    }
  }
  return null;
}

// ── Middleware ─────────────────────────────────────────────────────────────────
/**
 * Reads the session cookie and returns the payload.
 * Returns null and sends 401 if missing / invalid / expired.
 */
export async function requireAdminSession(
  req: IncomingMessage,
  res: ServerResponse
): Promise<AdminSessionPayload | null> {
  const token = getSessionToken(req);
  if (!token) {
    sendJson(res, 401, { error: 'Authentication required' });
    return null;
  }
  const payload = await verifyAdminSession(token);
  if (!payload) {
    clearSessionCookie(res);
    sendJson(res, 401, { error: 'Session expired or invalid' });
    return null;
  }
  return payload;
}

// ── Student Session Management ────────────────────────────────────────────────
export const STUDENT_SESSION_COOKIE = 'sara_student_session';
export const STUDENT_SESSION_DURATION_SEC = 2 * 60 * 60; // 2 hours

export interface StudentSessionPayload extends JWTPayload {
  sub: string; // studentId
  role: 'student';
  schoolId: string;
  classId: string;
}

export async function signStudentSession(payload: {
  studentId: string;
  schoolId: string;
  classId: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.studentId,
    role: 'student',
    schoolId: payload.schoolId,
    classId: payload.classId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${STUDENT_SESSION_DURATION_SEC}s`)
    .sign(getKey());
}

export async function verifyStudentSession(token: string): Promise<StudentSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey());
    if (payload.role !== 'student') return null;
    return payload as StudentSessionPayload;
  } catch {
    return null;
  }
}

export function setStudentCookie(res: ServerResponse, token: string): void {
  const cookieParts = [
    `${STUDENT_SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${STUDENT_SESSION_DURATION_SEC}`,
    'Path=/',
  ];
  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

export function clearStudentCookie(res: ServerResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${STUDENT_SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/`
  );
}

export function getStudentSessionToken(req: IncomingMessage): string | null {
  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name.trim() === STUDENT_SESSION_COOKIE) {
      return rest.join('=').trim();
    }
  }
  return null;
}

export async function getStudentSession(req: IncomingMessage): Promise<StudentSessionPayload | null> {
  const token = getStudentSessionToken(req);
  if (!token) return null;
  return verifyStudentSession(token);
}

export type RequestCaller =
  | { type: 'admin'; admin: AdminSessionPayload }
  | { type: 'student'; student: StudentSessionPayload };

export async function getCaller(req: IncomingMessage): Promise<RequestCaller | null> {
  // Check admin first
  const adminToken = getSessionToken(req);
  if (adminToken) {
    const admin = await verifyAdminSession(adminToken);
    if (admin) return { type: 'admin', admin };
  }

  // Check student
  const studentToken = getStudentSessionToken(req);
  if (studentToken) {
    const student = await verifyStudentSession(studentToken);
    if (student) return { type: 'student', student };
  }

  return null;
}

/**
 * Whether an admin may act on a student: super_admin always; school_admin only for an
 * existing student in its own school (a missing student is denied, not 404, so ids
 * from other schools cannot be probed).
 */
export async function adminCanAccessStudent(admin: AdminSessionPayload, studentId: string): Promise<boolean> {
  if (admin.role === 'super_admin') return true;
  if (!admin.schoolId) return false;
  return (await getStudentSchoolId(studentId)) === admin.schoolId;
}

/**
 * Authorizes access to a student's data.
 * Caller must be an admin in scope for the student (see adminCanAccessStudent) or the student itself.
 */
export async function requireStudentAccess(
  req: IncomingMessage,
  res: ServerResponse,
  targetStudentId: string
): Promise<RequestCaller | null> {
  const caller = await getCaller(req);
  if (!caller) {
    sendJson(res, 401, { error: 'Authentication required' });
    return null;
  }

  if (caller.type === 'admin') {
    if (caller.admin.role === 'school_admin' && !caller.admin.schoolId) {
      sendJson(res, 403, { error: 'Access denied: school_admin has no assigned school' });
      return null;
    }
    if (!(await adminCanAccessStudent(caller.admin, targetStudentId))) {
      sendJson(res, 403, { error: 'Access denied: student belongs to different school' });
      return null;
    }
    return caller;
  }

  // Caller is student
  if (caller.student.sub !== targetStudentId) {
    sendJson(res, 403, { error: 'Access denied: student session mismatch' });
    return null;
  }

  return caller;
}


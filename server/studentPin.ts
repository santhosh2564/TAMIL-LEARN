/**
 * Picture PIN hashing, verification, and lockout service.
 *
 * Requirements:
 *   - Picture PIN: 3 ordered picks out of 9 pictures (e.g. ['cat', 'star', 'sun'])
 *   - Hashed with bcrypt (cost factor 10)
 *   - Lockout after 5 wrong attempts
 *   - When locked, any attempt (even with correct PIN) is rejected until admin unlocks
 */

import bcrypt from 'bcryptjs';
import { getDb } from './db';

export function normalizePin(pin: string | string[] | number[]): string {
  if (Array.isArray(pin)) {
    return pin.map((p) => String(p).trim()).join('-');
  }
  return String(pin).trim();
}

export async function hashPin(pin: string | string[] | number[]): Promise<string> {
  const normalized = normalizePin(pin);
  return bcrypt.hash(normalized, 10);
}

export interface VerifyPinResult {
  success: boolean;
  error?: string;
  locked?: boolean;
  student?: {
    id: string;
    name: string;
    schoolId: string;
    classId: string;
    rollNo: string;
    avatar: string;
  };
}

export async function verifyStudentPin(
  studentId: string,
  inputPin: string | string[] | number[]
): Promise<VerifyPinResult> {
  const sql = getDb();
  const rows = (await sql.query(
    `SELECT id, name, school_id, class_id, roll_no, avatar, pin_hash, failed_pin_attempts, locked_until
     FROM students WHERE id = $1 LIMIT 1;`,
    [studentId]
  )) as Array<{
    id: string;
    name: string;
    school_id: string;
    class_id: string;
    roll_no: string;
    avatar: string;
    pin_hash: string | null;
    failed_pin_attempts: number;
    locked_until: string | null;
  }>;

  if (rows.length === 0) {
    return { success: false, error: 'Student not found' };
  }

  const student = rows[0];

  // Lockout check: 5 or more failed attempts or locked_until in the future
  const isLocked =
    student.failed_pin_attempts >= 5 ||
    (student.locked_until !== null && new Date(student.locked_until) > new Date());

  if (isLocked) {
    return {
      success: false,
      error: 'Account locked due to too many failed attempts. Please ask your teacher to unlock.',
      locked: true,
    };
  }

  if (!student.pin_hash) {
    return { success: false, error: 'PIN is not set for this student' };
  }

  const normalized = normalizePin(inputPin);
  const isValid = await bcrypt.compare(normalized, student.pin_hash);

  if (!isValid) {
    const nextAttempts = student.failed_pin_attempts + 1;
    await sql.query(
      `UPDATE students
       SET failed_pin_attempts = failed_pin_attempts + 1,
           locked_until = CASE
             WHEN failed_pin_attempts + 1 >= 5 THEN NOW() + INTERVAL '100 years'
             ELSE locked_until
           END
       WHERE id = $1;`,
      [studentId]
    );

    if (nextAttempts >= 5) {
      return {
        success: false,
        error: 'Account locked due to too many failed attempts. Please ask your teacher to unlock.',
        locked: true,
      };
    }

    return { success: false, error: 'Incorrect PIN' };
  }

  // Success: reset failed attempts
  await sql.query(
    `UPDATE students SET failed_pin_attempts = 0, locked_until = NULL WHERE id = $1;`,
    [studentId]
  );

  return {
    success: true,
    student: {
      id: student.id,
      name: student.name,
      schoolId: student.school_id,
      classId: student.class_id,
      rollNo: student.roll_no,
      avatar: student.avatar,
    },
  };
}

export async function unlockStudentPin(studentId: string): Promise<void> {
  const sql = getDb();
  await sql.query(
    `UPDATE students SET failed_pin_attempts = 0, locked_until = NULL WHERE id = $1;`,
    [studentId]
  );
}


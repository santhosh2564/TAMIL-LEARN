// @vitest-environment node
/**
 * Tests for student picture PIN hashing, verification, and lockout.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  hashPin,
  normalizePin,
  verifyStudentPin,
  unlockStudentPin,
} from '../studentPin';
import { setDb } from '../db';
import type { NeonQueryFunction } from '@neondatabase/serverless';

describe('Picture PIN normalization and hashing', () => {
  it('normalizes 3 ordered picture choices into a hyphenated string', () => {
    expect(normalizePin(['cat', 'star', 'sun'])).toBe('cat-star-sun');
    expect(normalizePin([1, 4, 9])).toBe('1-4-9');
    expect(normalizePin('1-4-9')).toBe('1-4-9');
  });

  it('hashes pin with bcrypt so that plaintext pin is not stored', async () => {
    const hashed = await hashPin(['cat', 'star', 'sun']);
    expect(hashed).toMatch(/^\$2[aby]\$/);
    const matches = await bcrypt.compare('cat-star-sun', hashed);
    expect(matches).toBe(true);
  });
});

describe('Student PIN Verification and Lockout', () => {
  const CORRECT_PIN = ['apple', 'car', 'tree'];
  let studentRecord: {
    id: string;
    name: string;
    school_id: string;
    class_id: string;
    roll_no: string;
    avatar: string;
    pin_hash: string;
    failed_pin_attempts: number;
    locked_until: string | null;
  };

  beforeEach(async () => {
    const pinHash = await bcrypt.hash('apple-car-tree', 10);
    studentRecord = {
      id: 'stud_123',
      name: 'Anitha',
      school_id: 'sch_1',
      class_id: 'cls_2a',
      roll_no: '101',
      avatar: 'avatar_star',
      pin_hash: pinHash,
      failed_pin_attempts: 0,
      locked_until: null,
    };

    const mockQuery = (queryText: string) => {
      if (queryText.includes('SELECT')) {
        return Promise.resolve([studentRecord]);
      }
      if (queryText.includes('UPDATE students')) {
        if (queryText.includes('failed_pin_attempts = 0')) {
          studentRecord.failed_pin_attempts = 0;
          studentRecord.locked_until = null;
        } else if (queryText.includes('failed_pin_attempts + 1')) {
          studentRecord.failed_pin_attempts += 1;
          if (studentRecord.failed_pin_attempts >= 5) {
            studentRecord.locked_until = new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000).toISOString();
          }
        }
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    };

    const mockSql = Object.assign(
      (queryText: string) => mockQuery(queryText),
      {
        query: (queryText: string) => mockQuery(queryText),
      }
    ) as unknown as NeonQueryFunction<false, false>;

    setDb(mockSql);
  });

  afterEach(() => {
    setDb(null);
  });

  it('authenticates when correct PIN is provided on first try', async () => {
    const res = await verifyStudentPin('stud_123', CORRECT_PIN);
    expect(res.success).toBe(true);
    expect(res.student?.name).toBe('Anitha');
    expect(res.student?.rollNo).toBe('101');
    expect(res.locked).toBeUndefined();
  });

  it('rejects incorrect PIN and increments failed attempts', async () => {
    const res = await verifyStudentPin('stud_123', ['wrong', 'car', 'tree']);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Incorrect PIN');
    expect(studentRecord.failed_pin_attempts).toBe(1);
  });

  it('locks out after 5 consecutive failed attempts, and REJECTS the 6th attempt even with the correct PIN', async () => {
    const WRONG_PIN = ['dog', 'boat', 'moon'];

    // Attempts 1 to 4: wrong PIN
    for (let i = 1; i <= 4; i++) {
      const res = await verifyStudentPin('stud_123', WRONG_PIN);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Incorrect PIN');
      expect(studentRecord.failed_pin_attempts).toBe(i);
      expect(res.locked).toBeUndefined();
    }

    // 5th attempt: wrong PIN -> account becomes locked
    const attempt5 = await verifyStudentPin('stud_123', WRONG_PIN);
    expect(attempt5.success).toBe(false);
    expect(attempt5.locked).toBe(true);
    expect(studentRecord.failed_pin_attempts).toBe(5);
    expect(studentRecord.locked_until).not.toBeNull();

    // 6th attempt: with the CORRECT PIN -> must be REJECTED because account is locked!
    const attempt6 = await verifyStudentPin('stud_123', CORRECT_PIN);
    expect(attempt6.success).toBe(false);
    expect(attempt6.locked).toBe(true);
    expect(attempt6.error).toMatch(/locked/i);
  });

  it('allows login after admin unlocks the student', async () => {
    studentRecord.failed_pin_attempts = 5;
    studentRecord.locked_until = new Date(Date.now() + 100000000).toISOString();

    // Verify currently locked
    const lockedRes = await verifyStudentPin('stud_123', CORRECT_PIN);
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.locked).toBe(true);

    // Admin unlocks student
    await unlockStudentPin('stud_123');
    expect(studentRecord.failed_pin_attempts).toBe(0);
    expect(studentRecord.locked_until).toBeNull();

    // Now correct PIN succeeds
    const unlockedRes = await verifyStudentPin('stud_123', CORRECT_PIN);
    expect(unlockedRes.success).toBe(true);
  });
});

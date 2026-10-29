// @vitest-environment node
/**
 * T4. PIN lockout:
 * - 5 wrong attempts -> locked
 * - 6th attempt with the correct PIN is rejected
 * - After 10 minutes (fake clock), the correct PIN succeeds
 * - Teacher unlock succeeds immediately
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';

// Mock DB for studentPin testing
const mockStudent = {
  id: 'stud_lockout_1',
  name: 'கவின்',
  school_id: 'school_1',
  class_id: 'class_1',
  roll_no: '01',
  avatar: 'avatar_sun',
  pin_hash: '',
  failed_pin_attempts: 0,
  locked_until: null as string | null,
};

vi.mock('../db', () => ({
  getDb: () => ({
    query: vi.fn(async (sqlText: string, params: unknown[]) => {
      if (sqlText.includes('SELECT id, name')) {
        return [mockStudent];
      }
      if (sqlText.includes('UPDATE students SET failed_pin_attempts = failed_pin_attempts + 1')) {
        mockStudent.failed_pin_attempts += 1;
        if (mockStudent.failed_pin_attempts >= 5) {
          // Current implementation erroneously locks for 100 years or 15 mins instead of 10 mins!
          mockStudent.locked_until = new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000).toISOString();
        }
        return [];
      }
      if (sqlText.includes('failed_pin_attempts = 0')) {
        mockStudent.failed_pin_attempts = 0;
        mockStudent.locked_until = null;
        return [];
      }
      return [];
    }),
  }),
}));

import { verifyStudentPin, unlockStudentPin } from '../studentPin';

describe('T4: PIN lockout window and unlock lifecycle', () => {
  const correctPin = ['sun', 'star', 'tree'];
  const wrongPin = ['car', 'house', 'apple'];

  beforeEach(async () => {
    vi.useFakeTimers();
    mockStudent.pin_hash = await bcrypt.hash(correctPin.join('-'), 10);
    mockStudent.failed_pin_attempts = 0;
    mockStudent.locked_until = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('locks for exactly 10 minutes after 5 wrong attempts; expires after 10m; teacher unlock succeeds immediately', async () => {
    // 1. Submit 4 wrong attempts -> not locked yet
    for (let i = 1; i <= 4; i++) {
      const res = await verifyStudentPin(mockStudent.id, wrongPin);
      expect(res.success).toBe(false);
      expect(res.locked).toBeFalsy();
    }

    // 2. 5th wrong attempt -> triggers 10 minute lock
    const res5 = await verifyStudentPin(mockStudent.id, wrongPin);
    expect(res5.success).toBe(false);
    expect(res5.locked).toBe(true);
    expect(mockStudent.locked_until).not.toBeNull();

    const lockDurationMs = new Date(mockStudent.locked_until!).getTime() - Date.now();
    // Must be exactly 10 minutes (600,000 ms)!
    expect(lockDurationMs, 'Lockout must be set to 10 minutes').toBeLessThanOrEqual(10 * 60 * 1000 + 1000);
    expect(lockDurationMs, 'Lockout must be set to 10 minutes').toBeGreaterThanOrEqual(10 * 60 * 1000 - 1000);

    // 3. 6th attempt with CORRECT PIN -> must STILL be rejected while locked
    const res6 = await verifyStudentPin(mockStudent.id, correctPin);
    expect(res6.locked, '6th attempt with correct PIN must be rejected when locked').toBe(true);
    expect(res6.success).toBe(false);

    // 4. Advance fake clock by 9 minutes -> STILL locked
    vi.advanceTimersByTime(9 * 60 * 1000);
    const resAfter9m = await verifyStudentPin(mockStudent.id, correctPin);
    expect(resAfter9m.locked).toBe(true);

    // 5. Advance fake clock past the 10-minute window (+2 minutes, total 11m) -> correct PIN now SUCCEEDS
    vi.advanceTimersByTime(2 * 60 * 1000);
    const resAfter11m = await verifyStudentPin(mockStudent.id, correctPin);
    expect(resAfter11m.success, 'Correct PIN must succeed after 10 minutes lock expires').toBe(true);
    expect(resAfter11m.locked).toBeFalsy();

    // 6. Test teacher unlock: lock it again with 5 wrong attempts
    for (let i = 1; i <= 5; i++) {
      await verifyStudentPin(mockStudent.id, wrongPin);
    }
    expect(mockStudent.locked_until).not.toBeNull();

    // Teacher unlock succeeds immediately without waiting
    await unlockStudentPin(mockStudent.id);
    expect(mockStudent.locked_until).toBeNull();
    expect(mockStudent.failed_pin_attempts).toBe(0);

    const resUnlocked = await verifyStudentPin(mockStudent.id, correctPin);
    expect(resUnlocked.success).toBe(true);
  });
});

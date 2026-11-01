// @vitest-environment node
/**
 * Tests for the Architecture Correction: Removing Classes & Sections.
 *
 * Verifies:
 * - Public school list (GET /api/public/schools)
 * - School roster retrieval (GET /api/schools/:schoolId/roster)
 * - Student selection with schoolId without classId (POST /api/student/select)
 * - Student creation directly in school without class (POST /api/admin/students)
 * - Bulk import directly in school without class (POST /api/admin/students/import)
 * - School report generation with Tamil and English progress metrics
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';

const mockQuery = vi.fn().mockResolvedValue([]);

vi.mock('../db', () => ({
  getDb: vi.fn(() => ({
    query: mockQuery,
  })),
  getActiveSchoolsFromDb: vi.fn(),
  getSchoolById: vi.fn(),
  getStudentsForSchoolRoster: vi.fn(),
  getStudentById: vi.fn(),
  upsertStudentInDb: vi.fn(),
  updateStudentInDb: vi.fn(),
  bulkImportStudentsInDb: vi.fn(),
  getSchoolReportFromDb: vi.fn(),
  getOverallReportFromDb: vi.fn(),
  getStudentReportFromDb: vi.fn(),
  verifyStudentPin: vi.fn(),
  createAssessmentSessionInDb: vi.fn(),
  getAdminByUsername: vi.fn(),
  incrementAdminFailedAttempts: vi.fn(),
  resetAdminFailedAttempts: vi.fn(),
}));

import * as db from '../db';
import { handleApiRequest } from '../apiHandler';
import { signAdminSession } from '../auth';

const VALID_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';

function makeMockRes() {
  const state = { statusCode: 200, headers: {} as Record<string, string | string[]>, body: '' };
  return {
    get statusCode() { return state.statusCode; },
    set statusCode(v: number) { state.statusCode = v; },
    get headers() { return state.headers; },
    get body() { return state.body; },
    setHeader(name: string, value: string) { state.headers[name] = value; },
    end(data?: string) { if (data) state.body += data; },
  } as unknown as ServerResponse & { statusCode: number; body: string };
}

function makeMockReq(opts: {
  method: string;
  url: string;
  cookie?: string;
  body?: unknown;
}): IncomingMessage & { body?: unknown } {
  return {
    method: opts.method,
    url: opts.url,
    headers: {
      host: 'localhost',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      'content-type': 'application/json',
    },
    body: opts.body,
    on: vi.fn((event: string, cb: (data?: unknown) => void) => {
      if (event === 'end') cb();
      return this;
    }),
  } as unknown as IncomingMessage & { body?: unknown };
}

describe('Architecture Correction — No Classes/Sections Hierarchy', () => {
  let adminCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = VALID_SECRET;
    process.env.DATABASE_URL = 'postgresql://fake:fake@fake/fake';
    vi.clearAllMocks();
    mockQuery.mockResolvedValue([]);

    const token = await signAdminSession({
      sub: 'adm_super_01',
      username: 'admin',
      role: 'super_admin',
      schoolId: null,
    });
    adminCookie = `sara_admin_session=${token}`;
  });

  describe('GET /api/public/schools', () => {
    it('returns active schools for device setup and student selection', async () => {
      vi.mocked(db.getActiveSchoolsFromDb).mockResolvedValue([
        {
          id: 'sch_1',
          name: 'St. Marys School',
          school_name: 'St. Marys School',
          school_code: 'SMS01',
          academic_year: '2026-2027',
          student_count: 42,
          archived_at: null,
          created_at: '2026-01-01',
        },
      ]);

      const req = makeMockReq({ method: 'GET', url: '/api/public/schools' });
      const res = makeMockRes();
      await handleApiRequest(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.schools).toHaveLength(1);
      expect(data.schools[0].name).toBe('St. Marys School');
    });
  });

  describe('GET /api/schools/:schoolId/roster', () => {
    it('returns student roster for a specific school without class requirement', async () => {
      vi.mocked(db.getSchoolById).mockResolvedValue({
        id: 'sch_1',
        name: 'St. Marys School',
        school_name: 'St. Marys School',
        school_code: 'SMS01',
        academic_year: '2026-2027',
        archived_at: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      });
      vi.mocked(db.getStudentsForSchoolRoster).mockResolvedValue([
        {
          id: 'stu_101',
          name: 'Kavitha S',
          rollNumber: '101',
          avatar: 'bear',
          hasPin: false,
        },
        {
          id: 'stu_102',
          name: 'Ravi M',
          rollNumber: '102',
          avatar: 'lion',
          hasPin: true,
        },
      ]);

      const req = makeMockReq({ method: 'GET', url: '/api/schools/sch_1/roster' });
      const res = makeMockRes();
      await handleApiRequest(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.students).toHaveLength(2);
      expect(data.students[0].name).toBe('Kavitha S');
      expect(data.students[1].hasPin).toBe(true);
    });
  });

  describe('POST /api/student/select', () => {
    it('allows student selection using schoolId and studentId (no class required)', async () => {
      vi.mocked(db.getStudentById).mockResolvedValue({
        id: 'stu_101',
        school_id: 'sch_1',
        class_id: null,
        name: 'Kavitha S',
        roll_number: '101',
        avatar: 'bear',
        pin_hash: null,
        pin_failed_attempts: 0,
        pin_locked_until: null,
        archived_at: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      });
      vi.mocked(db.verifyStudentPin).mockResolvedValue({ success: true });
      vi.mocked(db.createAssessmentSessionInDb).mockResolvedValue({
        id: 'sess_123',
        student_id: 'stu_101',
        school_id: 'sch_1',
        class_id: null,
        module_id: 'tamil_module_1',
        status: 'active',
        subject: 'tamil',
        academic_year: '2026-2027',
        started_at: '2026-01-01',
        completed_at: null,
        last_activity_at: '2026-01-01',
        metadata: {},
      });

      const req = makeMockReq({
        method: 'POST',
        url: '/api/student/select',
        body: { schoolId: 'sch_1', studentId: 'stu_101' },
      });
      const res = makeMockRes();
      await handleApiRequest(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.student.id).toBe('stu_101');
      expect(data.student.schoolId).toBe('sch_1');
    });

    it('rejects student selection if student does not belong to specified school', async () => {
      vi.mocked(db.getStudentById).mockResolvedValue({
        id: 'stu_101',
        school_id: 'sch_other',
        class_id: null,
        name: 'Kavitha S',
        roll_number: '101',
        avatar: 'bear',
        pin_hash: null,
        pin_failed_attempts: 0,
        pin_locked_until: null,
        archived_at: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      });

      const req = makeMockReq({
        method: 'POST',
        url: '/api/student/select',
        body: { schoolId: 'sch_1', studentId: 'stu_101' },
      });
      const res = makeMockRes();
      await handleApiRequest(req, res);

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('Student not found in this school');
    });
  });

  describe('POST /api/admin/students', () => {
    it('creates student directly within a school without class assignment', async () => {
      vi.mocked(db.getSchoolById).mockResolvedValue({
        id: 'sch_1',
        name: 'St. Marys School',
        school_name: 'St. Marys School',
        school_code: 'SMS01',
        academic_year: '2026-2027',
        archived_at: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      });
      vi.mocked(db.upsertStudentInDb).mockResolvedValue({
        id: 'stu_new',
        school_id: 'sch_1',
        class_id: null,
        name: 'Anitha R',
        roll_number: 'R105',
        avatar: 'fox',
        archived_at: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      });

      const req = makeMockReq({
        method: 'POST',
        url: '/api/admin/students',
        cookie: adminCookie,
        body: {
          schoolId: 'sch_1',
          name: 'Anitha R',
          rollNumber: 'R105',
          avatar: 'fox',
        },
      });
      const res = makeMockRes();
      await handleApiRequest(req, res);

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.student.id).toMatch(/^stud_/);
      expect(data.student.schoolId).toBe('sch_1');
    });

    it('rejects duplicate roll numbers in the same school with 400', async () => {
      vi.mocked(db.getSchoolById).mockResolvedValue({
        id: 'sch_1',
        name: 'St. Marys School',
        school_name: 'St. Marys School',
        school_code: 'SMS01',
        academic_year: '2026-2027',
        archived_at: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      });
      // Simulate existing roll number found in database query
      mockQuery.mockResolvedValueOnce([{ id: 'existing_stu' }]);

      const req = makeMockReq({
        method: 'POST',
        url: '/api/admin/students',
        cookie: adminCookie,
        body: {
          schoolId: 'sch_1',
          name: 'Anitha R',
          rollNumber: 'R105',
        },
      });
      const res = makeMockRes();
      await handleApiRequest(req, res);

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toContain('already exists in this school');
    });
  });

  describe('POST /api/admin/students/import', () => {
    it('bulk imports students directly into school without requiring class', async () => {
      vi.mocked(db.bulkImportStudentsInDb).mockResolvedValue([
        {
          id: 'stu_imp_1',
          school_id: 'sch_1',
          class_id: null,
          name: 'Karthik S',
          roll_number: '201',
          avatar: 'rabbit',
          archived_at: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'stu_imp_2',
          school_id: 'sch_1',
          class_id: null,
          name: 'Meena K',
          roll_number: '202',
          avatar: 'bear',
          archived_at: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ]);

      const req = makeMockReq({
        method: 'POST',
        url: '/api/admin/students/import',
        cookie: adminCookie,
        body: {
          schoolId: 'sch_1',
          students: [
            { name: 'Karthik S', rollNumber: '201', schoolId: 'sch_1' },
            { name: 'Meena K', rollNumber: '202', schoolId: 'sch_1' },
          ],
        },
      });
      const res = makeMockRes();
      await handleApiRequest(req, res);

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.importedCount).toBe(2);
    });
  });

  describe('GET /api/admin/reports/schools/:schoolId', () => {
    it('returns school report with Tamil and English progress metrics (no class aggregation)', async () => {
      vi.mocked(db.getSchoolReportFromDb).mockResolvedValue({
        schoolId: 'sch_1',
        schoolName: 'St. Marys School',
        academicYear: '2026-2027',
        studentCount: 50,
        activeStudentCount: 45,
        totalAttempts: 1200,
        tamilProgress: {
          totalStudents: 50,
          completedModules: 120,
          averageAccuracy: 88.5,
        },
        englishProgress: {
          totalStudents: 50,
          completedModules: 95,
          averageAccuracy: 84.2,
        },
        modulePerformance: [],
        firstAttemptAccuracy: 82.0,
        finalAccuracy: 91.5,
        retryRate: 1.4,
      });

      const req = makeMockReq({
        method: 'GET',
        url: '/api/admin/reports/schools/sch_1',
        cookie: adminCookie,
      });
      const res = makeMockRes();
      await handleApiRequest(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.report.schoolName).toBe('St. Marys School');
      expect(data.report.tamilProgress).toBeDefined();
      expect(data.report.englishProgress).toBeDefined();
      expect(data.report.classes).toBeUndefined(); // Verify no class aggregation in response
    });
  });
});

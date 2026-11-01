// @vitest-environment node
/**
 * Phase 5 Integration Tests: School, Class & Student Management + Bulk Excel Import
 * Runs against the isolated test database branch (TEST_DATABASE_URL).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import {
  setDb,
  runMigrations,
  createSchoolInDb,
  createClassWithUniqueCode,
  updateSchoolInDb,
} from '../db';
import { handleApiRequest } from '../apiHandler';
import { signAdminSession } from '../auth';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';

const testDbUrl = process.env.TEST_DATABASE_URL;
const mainDbUrl = process.env.DATABASE_URL;

const shouldRun = Boolean(testDbUrl && (!mainDbUrl || testDbUrl.trim() !== mainDbUrl.trim()));
const suiteDescribe = shouldRun ? describe : describe.skip;

function mockRequest(options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}): { req: IncomingMessage & { body?: unknown }; res: ServerResponse; getResult: () => { statusCode: number; data: Record<string, unknown> } } {
  const socket = new Socket();
  const req = new IncomingMessage(socket) as IncomingMessage & { body?: unknown };
  req.method = options.method;
  req.url = options.url;
  req.headers = { host: 'localhost', ...(options.headers || {}) };
  req.body = options.body;

  let statusCode = 200;
  let responseData = '';
  const res = new ServerResponse(req);
  res.end = function (chunk?: string | Buffer) {
    if (chunk) responseData += chunk.toString();
    return this;
  } as typeof res.end;
  Object.defineProperty(res, 'statusCode', {
    get: () => statusCode,
    set: (v) => { statusCode = v; },
  });

  return {
    req,
    res,
    getResult: () => ({
      statusCode,
      data: responseData ? (JSON.parse(responseData) as Record<string, unknown>) : {},
    }),
  };
}

suiteDescribe('Phase 5 School & Student Management Integration', () => {
  let sql: NeonQueryFunction<false, false>;
  let adminCookie: string;

  beforeAll(async () => {
    sql = neon(testDbUrl!);
    setDb(sql);
    await runMigrations(sql);

    const token = await signAdminSession({
      id: 'super_admin_id',
      username: 'admin',
      role: 'super_admin',
    });
    adminCookie = `sara_admin_session=${token}`;
  }, 30000);

  afterAll(() => {
    setDb(null);
  });

  it('School Management: Create and update school with configurable academic year', async () => {
    const schoolCode = `P5_SCH_${Date.now()}`;
    const school = await createSchoolInDb({
      schoolName: 'Phase 5 Test Academy',
      schoolCode,
      academicYear: '2026-2027',
      address: 'Trichy Main Road',
    });

    expect(school.school_name).toBe('Phase 5 Test Academy');
    expect(school.academic_year).toBe('2026-2027');
    expect(school.is_active).toBe(true);

    // Update via API PATCH /api/schools/:schoolId
    const { req, res, getResult } = mockRequest({
      method: 'PATCH',
      url: `/api/schools/${school.id}`,
      headers: { cookie: adminCookie },
      body: {
        schoolName: 'Phase 5 Test Academy (Updated)',
        academicYear: '2027-2028',
        isActive: false,
      },
    });

    await handleApiRequest(req, res);
    const result = getResult();
    expect(result.statusCode).toBe(200);
    const updated = result.data.school as { school_name: string; academic_year: string; is_active: boolean };
    expect(updated.school_name).toBe('Phase 5 Test Academy (Updated)');
    expect(updated.academic_year).toBe('2027-2028');
    expect(updated.is_active).toBe(false);

    // Reactivate for downstream tests
    await updateSchoolInDb(school.id, { isActive: true });
  }, 30000);

  it('Class Management: Duplicate class prevention & editing class details', async () => {
    const schoolCode = `P5_CLS_${Date.now()}`;
    const school = await createSchoolInDb({
      schoolName: 'Class Test School',
      schoolCode,
      academicYear: '2026-2027',
    });

    // Create class 1
    const classId1 = `cls_dup_${Date.now()}`;
    const class1 = await createClassWithUniqueCode({
      id: classId1,
      schoolId: school.id,
      name: 'Class 4-A',
      grade: 'Class 4',
    });
    expect(class1.id).toBe(classId1);
    expect(class1.name).toBe('Class 4-A');

    // Attempt to create duplicate active class with same name and grade in same school
    const class2 = await createClassWithUniqueCode({
      id: `cls_dup_2_${Date.now()}`,
      schoolId: school.id,
      name: 'Class 4-A',
      grade: 'Class 4',
    });
    // Must return the existing class to avoid duplicate records
    expect(class2.id).toBe(class1.id);

    // Edit class via PATCH /api/admin/classes/:id
    const { req, res, getResult } = mockRequest({
      method: 'PATCH',
      url: `/api/admin/classes/${class1.id}`,
      headers: { cookie: adminCookie },
      body: {
        name: 'Class 4-A Senior',
        grade: 'Class 4',
      },
    });
    await handleApiRequest(req, res);
    const result = getResult();
    expect(result.statusCode).toBe(200);
    const updated = result.data.class as { name: string };
    expect(updated.name).toBe('Class 4-A Senior');
  }, 30000);

  it('Student Management: Create student with section, update details, filter & pagination', async () => {
    const schoolCode = `P5_STU_${Date.now()}`;
    const school = await createSchoolInDb({
      schoolName: 'Student Test School',
      schoolCode,
      academicYear: '2026-2027',
    });

    const cls = await createClassWithUniqueCode({
      id: `cls_stu_${Date.now()}`,
      schoolId: school.id,
      name: 'Class 5-B',
      grade: 'Class 5',
    });

    // 1. Create student via POST /api/admin/students
    const { req: createReq, res: createRes, getResult: getCreateResult } = mockRequest({
      method: 'POST',
      url: '/api/admin/students',
      headers: { cookie: adminCookie },
      body: {
        name: 'Dharani',
        rollNumber: 'R501',
        classId: cls.id,
        section: 'B',
        schoolId: school.id,
      },
    });
    await handleApiRequest(createReq, createRes);
    const createResult = getCreateResult();
    expect(createResult.statusCode).toBe(201);
    const createdStudent = createResult.data.student as { id: string; name: string; section: string; roll_number: string };
    expect(createdStudent.name).toBe('Dharani');
    expect(createdStudent.section).toBe('B');
    expect(createdStudent.roll_number).toBe('R501');

    // 2. Fetch single student via GET /api/students/:studentId
    const { req: getReq, res: getRes, getResult: getStudentResult } = mockRequest({
      method: 'GET',
      url: `/api/students/${createdStudent.id}`,
      headers: { cookie: adminCookie },
    });
    await handleApiRequest(getReq, getRes);
    const studentResult = getStudentResult();
    expect(studentResult.statusCode).toBe(200);
    const fetched = studentResult.data.student as { id: string; name: string; roll_number: string };
    expect(fetched.id).toBe(createdStudent.id);
    expect(fetched.roll_number).toBe('R501');

    // 3. Update student via PATCH /api/students/:studentId
    const { req: patchReq, res: patchRes, getResult: getPatchResult } = mockRequest({
      method: 'PATCH',
      url: `/api/students/${createdStudent.id}`,
      headers: { cookie: adminCookie },
      body: {
        name: 'Dharani S',
        rollNumber: 'R502',
        section: 'C',
      },
    });
    await handleApiRequest(patchReq, patchRes);
    const patchResult = getPatchResult();
    expect(patchResult.statusCode).toBe(200);
    const updatedStudent = patchResult.data.student as { name: string; roll_number: string; section: string };
    expect(updatedStudent.name).toBe('Dharani S');
    expect(updatedStudent.roll_number).toBe('R502');
    expect(updatedStudent.section).toBe('C');

    // 4. Archive student
    const { req: archiveReq, res: archiveRes, getResult: getArchiveResult } = mockRequest({
      method: 'PATCH',
      url: `/api/students/${createdStudent.id}`,
      headers: { cookie: adminCookie },
      body: {
        isActive: false,
      },
    });
    await handleApiRequest(archiveReq, archiveRes);
    expect(getArchiveResult().statusCode).toBe(200);

    // 5. Test filtered pagination API: GET /api/students
    const { req: listReq, res: listRes, getResult: getListResult } = mockRequest({
      method: 'GET',
      url: `/api/students?page=1&pageSize=10&schoolId=${school.id}&status=all`,
      headers: { cookie: adminCookie },
    });
    await handleApiRequest(listReq, listRes);
    const listResult = getListResult();
    expect(listResult.statusCode).toBe(200);
    expect(listResult.data.total).toBe(1);
    const students = listResult.data.students as Array<{ id: string; is_active: boolean }>;
    expect(students[0].id).toBe(createdStudent.id);
    expect(students[0].is_active).toBe(false);
  }, 30000);

  it('Bulk Import API: Handles per-row school/class data, prevents duplicates and reports invalid records', async () => {
    const schoolCode = `P5_BULK_${Date.now()}`;
    const school = await createSchoolInDb({
      schoolName: 'Bulk Import High School',
      schoolCode,
      academicYear: '2026-2027',
    });

    const cls = await createClassWithUniqueCode({
      id: `cls_bulk_${Date.now()}`,
      schoolId: school.id,
      name: 'Class 3-C',
      grade: 'Class 3',
    });

    // 1. Successful bulk import with valid rows
    const { req: importReq, res: importRes, getResult: getImportResult } = mockRequest({
      method: 'POST',
      url: '/api/admin/students/import',
      headers: { cookie: adminCookie },
      body: {
        classId: cls.id,
        schoolId: school.id,
        students: [
          { name: 'Siddharth', rollNumber: 'R301', section: 'C' },
          { name: 'Ananya', rollNumber: 'R302', section: 'C' },
          { name: 'Muthu', rollNumber: 'R303', section: 'C' },
        ],
      },
    });
    await handleApiRequest(importReq, importRes);
    const importResult = getImportResult();
    expect(importResult.statusCode).toBe(201);
    expect(importResult.data.importedCount).toBe(3);

    // 2. Import duplicate roll number within the same school and class
    const { req: dupReq, res: dupRes, getResult: getDupResult } = mockRequest({
      method: 'POST',
      url: '/api/admin/students/import',
      headers: { cookie: adminCookie },
      body: {
        classId: cls.id,
        schoolId: school.id,
        students: [
          { name: 'Duplicate Siddharth', rollNumber: 'R301', section: 'C' },
        ],
      },
    });
    await handleApiRequest(dupReq, dupRes);
    const dupResult = getDupResult();
    expect(dupResult.statusCode).toBe(400);
    expect(String(dupResult.data.error)).toContain('duplicate roll numbers');

    // 3. Validation rejection on invalid input (e.g. empty student list)
    const { req: invReq, res: invRes, getResult: getInvResult } = mockRequest({
      method: 'POST',
      url: '/api/admin/students/import',
      headers: { cookie: adminCookie },
      body: {
        classId: cls.id,
        schoolId: school.id,
        students: [],
      },
    });
    await handleApiRequest(invReq, invRes);
    expect(getInvResult().statusCode).toBe(400);
  }, 30000);
});
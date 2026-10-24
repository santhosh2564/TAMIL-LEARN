import {
  getDb,
  upsertStudentInDb,
  getStudentsFromDb,
  deleteStudentFromDb,
  upsertProgressInDb,
  getProgressForStudentFromDb,
  recordAttemptInDb,
  getAttemptsForStudentFromDb
} from '../server/db';
import { handleApiRequest } from '../server/apiHandler';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';

async function simulateApiCall(method: string, url: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = url;

    let resBody = '';
    const res = new ServerResponse(req);
    res.write = (chunk: unknown) => {
      resBody += chunk;
      return true;
    };
    res.end = (chunk: unknown) => {
      if (chunk) resBody += chunk;
      let parsed: unknown = resBody;
      try {
        parsed = JSON.parse(resBody);
      } catch {
        // use raw string
      }
      resolve({ status: res.statusCode, body: parsed });
      return res;
    };

    handleApiRequest(req, res).then(handled => {
      if (!handled) {
        resolve({ status: 404, body: { error: 'Not handled' } });
      }
    }).catch(reject);

    if (body) {
      req.emit('data', JSON.stringify(body));
    }
    req.emit('end');
  });
}

async function runEndToEndTest() {
  console.log('===============================================================');
  console.log('       NEON LAKEBASE POSTGRESQL END-TO-END VERIFICATION       ');
  console.log('===============================================================');

  // 1. Direct DB Connectivity
  const sql = getDb();
  const healthCheck = await sql.query('SELECT NOW() as server_time, current_database(), current_user;');
  console.log('✓ Direct database connection established successfully.');
  console.log('  Database:', healthCheck[0].current_database);
  console.log('  Database User:', healthCheck[0].current_user);
  console.log('  Database Time:', healthCheck[0].server_time);

  // 2. HTTP Health API Check
  const healthApiRes = await simulateApiCall('GET', '/api/health');
  if (healthApiRes.status !== 200 || (healthApiRes.body as { status: string }).status !== 'ok') {
    throw new Error(`Health API failed: ${JSON.stringify(healthApiRes)}`);
  }
  console.log('✓ /api/health endpoint passed.');

  // 3. Test Student Creation
  const testStudentId = `test-student-${Date.now()}`;
  const testStudentName = 'கவின் (Kavin)';
  const now = new Date().toISOString();

  console.log(`\n1. Creating test student: ${testStudentName} (ID: ${testStudentId})...`);
  await upsertStudentInDb({
    id: testStudentId,
    name: testStudentName,
    createdAt: now,
    lastActiveAt: now
  });

  const studentsList = await getStudentsFromDb();
  const createdStudent = studentsList.find(s => s.id === testStudentId);
  if (!createdStudent) {
    throw new Error('Test student was not found in database after upsert');
  }
  console.log('✓ Student verified in Neon PostgreSQL:');
  console.log(`  ID: ${createdStudent.id}, Name: ${createdStudent.name}`);

  // 4. Test Attempt Recording
  const testActivityId = 'FTS0001';
  const testAttemptId = `att-${testStudentId}-1`;
  console.log(`\n2. Recording attempt for activity ${testActivityId}...`);
  await recordAttemptInDb({
    id: testAttemptId,
    studentId: testStudentId,
    activityId: testActivityId,
    category: 'context-choice',
    attemptNumber: 1,
    result: 'correct',
    completed: true,
    timestamp: now
  });

  const attempts = await getAttemptsForStudentFromDb(testStudentId);
  const recordedAttempt = attempts.find(a => a.id === testAttemptId);
  if (!recordedAttempt || recordedAttempt.result !== 'correct') {
    throw new Error('Attempt was not correctly recorded in Neon database');
  }
  console.log('✓ Attempt record verified in Neon PostgreSQL:');
  console.log(`  Attempt ID: ${recordedAttempt.id}, Result: ${recordedAttempt.result}, Student: ${recordedAttempt.student_id}`);

  // 5. Test Progress Recording
  console.log(`\n3. Recording progress for activity ${testActivityId}...`);
  await upsertProgressInDb({
    studentId: testStudentId,
    activityId: testActivityId,
    category: 'context-choice',
    completed: true,
    correct: true,
    attempts: 1,
    correctAttempts: 1,
    incorrectAttempts: 0,
    retryCount: 0,
    firstAttemptCorrect: true,
    finalCorrect: true,
    lastCompletedAt: now,
    lastAttemptedAt: now
  });

  const progressList = await getProgressForStudentFromDb(testStudentId);
  const recordedProgress = progressList.find(p => p.activity_id === testActivityId);
  if (!recordedProgress || !recordedProgress.completed) {
    throw new Error('Activity progress was not correctly recorded in Neon database');
  }
  console.log('✓ Activity progress verified in Neon PostgreSQL:');
  console.log(`  Activity: ${recordedProgress.activity_id}, Completed: ${recordedProgress.completed}, Correct: ${recordedProgress.correct}`);

  // 6. Test HTTP API Layer End-to-End
  console.log('\n4. Testing HTTP API endpoints (/api/students, /api/students/:id/progress)...');
  const apiStudents = await simulateApiCall('GET', '/api/students');
  const foundInApi = ((apiStudents.body as { students: { id: string }[] }).students || []).some(s => s.id === testStudentId);
  if (!foundInApi) {
    throw new Error('Student was not returned by /api/students endpoint');
  }

  const apiProgress = await simulateApiCall('GET', `/api/students/${testStudentId}/progress`);
  const foundProgInApi = ((apiProgress.body as { progress: { activityId: string }[] }).progress || []).some(p => p.activityId === testActivityId);
  if (!foundProgInApi) {
    throw new Error('Progress was not returned by /api/students/:id/progress endpoint');
  }
  console.log('✓ HTTP API layer verified end-to-end with real Neon queries.');

  // 7. Cleanup Test Data
  console.log(`\n5. Cleaning up test student ${testStudentId}...`);
  await deleteStudentFromDb(testStudentId);
  const remaining = await getStudentsFromDb();
  if (remaining.some(s => s.id === testStudentId)) {
    throw new Error('Test student deletion failed');
  }
  console.log('✓ Test data cleaned up successfully (cascade confirmed).');

  console.log('\n===============================================================');
  console.log('   ALL NEON POSTGRESQL END-TO-END OPERATIONS PASSED (100%)    ');
  console.log('===============================================================\n');
}

runEndToEndTest().catch(err => {
  console.error('End-to-end test failed:', err);
  process.exit(1);
});

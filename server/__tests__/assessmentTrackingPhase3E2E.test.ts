// @vitest-environment node
/**
 * Phase 3 Integration Test: Unified Question-Level Attempt Tracking on Real Neon PostgreSQL
 * Validates the complete submission lifecycle across all activity families,
 * monotonic attempt numbering, mathematical progress accuracy, and cross-module isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import {
  setDb,
  runMigrations,
  createSchoolInDb,
  createClassWithUniqueCode,
  bulkImportStudentsInDb,
  createOrGetAssessmentSessionInDb,
  recordQuestionAttemptInDb,
  getQuestionAttemptsForSessionFromDb,
  getStudentModuleProgressFromDb,
} from '../db';

const testDbUrl = process.env.TEST_DATABASE_URL;
const mainDbUrl = process.env.DATABASE_URL;

const shouldRun = Boolean(testDbUrl && (!mainDbUrl || testDbUrl.trim() !== mainDbUrl.trim()));
const suiteDescribe = shouldRun ? describe : describe.skip;

suiteDescribe('Phase 3 Unified Question Attempt Tracking E2E (Real Postgres)', () => {
  let sql: NeonQueryFunction<false, false>;

  beforeAll(async () => {
    sql = neon(testDbUrl!);
    setDb(sql);
    await runMigrations(sql);
  }, 30000);

  afterAll(() => {
    setDb(null);
  });

  it('records attempts across all six activity families with exact attempt numbering', async () => {
    const school = await createSchoolInDb({
      schoolName: 'All Activities Test School',
      schoolCode: `SCH_ACT_${Date.now()}`,
    });

    const cls = await createClassWithUniqueCode({
      id: `cls_act_${Date.now()}`,
      schoolId: school.id,
      name: 'Class 3-C',
      grade: 'Class 3',
    });

    const [student] = await bulkImportStudentsInDb({
      classId: cls.id,
      schoolId: school.id,
      students: [{ name: 'Deepa', section: 'C', rollNumber: 'R301' }],
    });

    const session = await createOrGetAssessmentSessionInDb({
      studentId: student.id,
      subjectId: 'tamil',
      moduleId: 1,
      activityIds: [
        'act_pic_rec',
        'act_spell_ch',
        'act_mean_match',
        'act_ctx_choice',
        'act_arr_word',
        'act_word_comp',
      ],
    });

    const activities = [
      { id: 'act_pic_rec', qId: 'FTS0010', category: 'picture-recognition', ans: 'à®…à®£à®¿à®²à¯' },
      { id: 'act_spell_ch', qId: 'FTS0011', category: 'spelling-choice', ans: 'à®†à®¨à¯à®¤à¯ˆ' },
      { id: 'act_mean_match', qId: 'FTS0012', category: 'meaning-match', ans: 'à®®à®°à®®à¯' },
      { id: 'act_ctx_choice', qId: 'FTS0013', category: 'context-choice', ans: 'à®ªà®±à®µà¯ˆ' },
      { id: 'act_arr_word', qId: 'FTS0014', category: 'arrange-word', ans: ['à®šà®¿', 'à®™à¯', 'à®•', 'à®®à¯'] },
      { id: 'act_word_comp', qId: 'FTS0015', category: 'word-completion', ans: 'à®®' },
    ];

    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      const res = await recordQuestionAttemptInDb({
        sessionId: session.id,
        studentId: student.id,
        subjectId: 'tamil',
        moduleId: 1,
        activityId: act.id,
        questionId: act.qId,
        answerPayload: { answer: act.ans, category: act.category },
        isCorrect: true,
        isCompleted: true,
        idempotencyKey: `idem_act_${act.qId}_${Date.now()}`,
      });

      expect(res.status).toBe('recorded');
      expect(res.attempt.attempt_number).toBe(1);
      expect(res.attempt.question_id).toBe(act.qId);
    }

    const sessionAttempts = await getQuestionAttemptsForSessionFromDb(session.id);
    expect(sessionAttempts.length).toBe(6);

    const progress = await getStudentModuleProgressFromDb(student.id);
    const mod1 = progress.find((p) => p.module_id === 1 && p.subject_id === 'tamil');
    expect(mod1?.questions_attempted).toBe(6);
    expect(mod1?.total_attempts).toBe(6);
    expect(mod1?.first_attempt_correct).toBe(6);
    expect(mod1?.finally_correct).toBe(6);
    expect(mod1?.retried_questions).toBe(0);
    expect(mod1?.total_retry_attempts).toBe(0);
  }, 30000);

  it('validates multiple retries: wrong -> wrong -> correct generates 3 immutable attempts', async () => {
    const school = await createSchoolInDb({
      schoolName: 'Retry Validation School',
      schoolCode: `SCH_RETRY_${Date.now()}`,
    });

    const cls = await createClassWithUniqueCode({
      id: `cls_retry_${Date.now()}`,
      schoolId: school.id,
      name: 'Class 3-R',
      grade: 'Class 3',
    });

    const [student] = await bulkImportStudentsInDb({
      classId: cls.id,
      schoolId: school.id,
      students: [{ name: 'Manoj', section: 'A', rollNumber: 'R302' }],
    });

    const session = await createOrGetAssessmentSessionInDb({
      studentId: student.id,
      subjectId: 'english',
      moduleId: 2,
      activityIds: ['ENG-M2-EW050', 'ENG-M2-EW051'],
    });

    // Question 1: EW050
    // Attempt 1: wrong
    await recordQuestionAttemptInDb({
      sessionId: session.id,
      studentId: student.id,
      subjectId: 'english',
      moduleId: 2,
      activityId: 'ENG-M2-EW050',
      questionId: 'EW050',
      answerPayload: { answer: 'bad' },
      isCorrect: false,
      isCompleted: false,
      idempotencyKey: `m2_ew050_att1_${Date.now()}`,
    });

    // Attempt 2: wrong
    await recordQuestionAttemptInDb({
      sessionId: session.id,
      studentId: student.id,
      subjectId: 'english',
      moduleId: 2,
      activityId: 'ENG-M2-EW050',
      questionId: 'EW050',
      answerPayload: { answer: 'badd' },
      isCorrect: false,
      isCompleted: false,
      idempotencyKey: `m2_ew050_att2_${Date.now()}`,
    });

    // Attempt 3: correct
    await recordQuestionAttemptInDb({
      sessionId: session.id,
      studentId: student.id,
      subjectId: 'english',
      moduleId: 2,
      activityId: 'ENG-M2-EW050',
      questionId: 'EW050',
      answerPayload: { answer: 'bed' },
      isCorrect: true,
      isCompleted: true,
      idempotencyKey: `m2_ew050_att3_${Date.now()}`,
    });

    // Question 2: EW051 -> 1 attempt: correct
    await recordQuestionAttemptInDb({
      sessionId: session.id,
      studentId: student.id,
      subjectId: 'english',
      moduleId: 2,
      activityId: 'ENG-M2-EW051',
      questionId: 'EW051',
      answerPayload: { answer: 'cat' },
      isCorrect: true,
      isCompleted: true,
      idempotencyKey: `m2_ew051_att1_${Date.now()}`,
    });

    // Check all session attempts
    const attempts = await getQuestionAttemptsForSessionFromDb(session.id);
    expect(attempts.length).toBe(4);

    const ew050Attempts = attempts.filter((a) => a.question_id === 'EW050');
    expect(ew050Attempts.length).toBe(3);
    expect(ew050Attempts.map((a) => a.attempt_number)).toEqual([1, 2, 3]);
    expect(ew050Attempts.map((a) => a.is_correct)).toEqual([false, false, true]);

    const ew051Attempts = attempts.filter((a) => a.question_id === 'EW051');
    expect(ew051Attempts.length).toBe(1);
    expect(ew051Attempts[0].attempt_number).toBe(1);
    expect(ew051Attempts[0].is_correct).toBe(true);

    // Verify statistical calculations in student_module_progress view
    const progress = await getStudentModuleProgressFromDb(student.id);
    const mod2 = progress.find((p) => p.module_id === 2 && p.subject_id === 'english');

    expect(mod2?.questions_attempted).toBe(2);
    expect(mod2?.total_attempts).toBe(4);
    expect(mod2?.retried_questions).toBe(1);
    expect(mod2?.total_retry_attempts).toBe(2);
    expect(mod2?.first_attempt_correct).toBe(1); // EW051 was correct on first attempt; EW050 was not
    expect(mod2?.finally_correct).toBe(2); // Both ended up correct
    expect(mod2?.questions_completed).toBe(2);
  }, 30000);
});

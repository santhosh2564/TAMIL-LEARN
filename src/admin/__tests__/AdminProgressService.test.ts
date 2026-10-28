import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminProgressService } from '../AdminProgressService';
import { StudentService } from '../../student/StudentService';
import { LocalStudentRepository } from '../../student/LocalStudentRepository';
import { ProgressService } from '../../progress/ProgressService';
import { LocalProgressRepository } from '../../progress/LocalProgressRepository';
import { AttemptService } from '../../attempts/AttemptService';
import { LocalAttemptRepository } from '../../attempts/LocalAttemptRepository';
import { LocalContentRepository } from '../../repositories/implementations/LocalContentRepository';

describe('AdminProgressService & Metrics Aggregation', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
  });

  function createServices() {
    const studentRepo = new LocalStudentRepository();
    const studentService = new StudentService(studentRepo);

    const progressRepo = new LocalProgressRepository();
    const attemptRepo = new LocalAttemptRepository();
    const attemptService = new AttemptService(attemptRepo);
    const progressService = new ProgressService(progressRepo, attemptService);
    const contentRepo = new LocalContentRepository();

    const adminService = new AdminProgressService(
      studentService,
      progressService,
      attemptService,
      contentRepo
    );

    return {
      studentService,
      progressService,
      attemptService,
      adminService,
    };
  }

  describe('Single-Student Attempt & Retry Tracking', () => {
    it('calculates first-attempt correct: attempts = 1, retries = 0, firstAttemptCorrect = true, completed = true', async () => {
      const { studentService, progressService, adminService } = createServices();

      const student = await studentService.createStudent('Ananya');

      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'Q001',
        category: 'picture-recognition',
        isCorrect: true,
        isCompleted: true,
      });

      const summaries = await adminService.getStudentSummaries();
      expect(summaries.length).toBe(1);

      const s = summaries[0];
      expect(s.studentName).toBe('Ananya');
      expect(s.totalQuestionsAttempted).toBe(1);
      expect(s.questionsCompleted).toBe(1);
      expect(s.firstAttemptCorrectCount).toBe(1);
      expect(s.questionsRetriedCount).toBe(0);
      expect(s.totalRetriesCount).toBe(0);
    });

    it('calculates first attempt incorrect: attempts = 1, retries = 0, firstAttemptCorrect = false, completed = false', async () => {
      const { studentService, progressService, adminService } = createServices();

      const student = await studentService.createStudent('Kavin');

      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'Q002',
        category: 'spelling-choice',
        isCorrect: false,
        isCompleted: false,
      });

      const summaries = await adminService.getStudentSummaries();
      const s = summaries[0];
      expect(s.totalQuestionsAttempted).toBe(1);
      expect(s.questionsCompleted).toBe(0);
      expect(s.firstAttemptCorrectCount).toBe(0);
      expect(s.questionsRetriedCount).toBe(0);
      expect(s.totalRetriesCount).toBe(0);
    });

    it('calculates retry then correct: attempts = 2, retries = 1, firstAttemptCorrect = false, completed = true', async () => {
      const { studentService, progressService, adminService } = createServices();

      const student = await studentService.createStudent('Meera');

      // Attempt 1: wrong
      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'Q003',
        category: 'arrange-word',
        isCorrect: false,
        isCompleted: false,
      });

      // Attempt 2: correct
      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'Q003',
        category: 'arrange-word',
        isCorrect: true,
        isCompleted: true,
      });

      const summaries = await adminService.getStudentSummaries();
      const s = summaries[0];
      expect(s.totalQuestionsAttempted).toBe(1);
      expect(s.questionsCompleted).toBe(1);
      expect(s.firstAttemptCorrectCount).toBe(0);
      expect(s.questionsRetriedCount).toBe(1);
      expect(s.totalRetriesCount).toBe(1);
    });

    it('calculates multiple retries: wrong -> wrong -> correct => attempts = 3, retries = 2, firstAttemptCorrect = false, completed = true', async () => {
      const { studentService, progressService, adminService } = createServices();

      const student = await studentService.createStudent('Suriya');

      // Attempt 1: wrong
      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'Q004',
        category: 'word-completion',
        isCorrect: false,
        isCompleted: false,
      });

      // Attempt 2: wrong
      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'Q004',
        category: 'word-completion',
        isCorrect: false,
        isCompleted: false,
      });

      // Attempt 3: correct
      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'Q004',
        category: 'word-completion',
        isCorrect: true,
        isCompleted: true,
      });

      const summaries = await adminService.getStudentSummaries();
      const s = summaries[0];
      expect(s.totalQuestionsAttempted).toBe(1);
      expect(s.questionsCompleted).toBe(1);
      expect(s.firstAttemptCorrectCount).toBe(0);
      expect(s.questionsRetriedCount).toBe(1);
      expect(s.totalRetriesCount).toBe(2);
    });
  });

  describe('Multi-Question Verification (Prompt Specification Test)', () => {
    it('matches exact specification: Question A (1 attempt correct) + Question B (wrong then correct) => questionsCompleted=2, firstAttemptSuccesses=1, questionsRetried=1, totalRetries=1', async () => {
      const { studentService, progressService, adminService } = createServices();

      const student = await studentService.createStudent('TestStudent');

      // Question A: attempt 1 -> correct
      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'QA_001',
        category: 'picture-recognition',
        isCorrect: true,
        isCompleted: true,
      });

      // Question B: attempt 1 -> wrong
      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'QB_002',
        category: 'spelling-choice',
        isCorrect: false,
        isCompleted: false,
      });

      // Question B: attempt 2 -> correct
      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'QB_002',
        category: 'spelling-choice',
        isCorrect: true,
        isCompleted: true,
      });

      const summaries = await adminService.getStudentSummaries();
      const s = summaries[0];

      expect(s.questionsCompleted).toBe(2);
      expect(s.firstAttemptCorrectCount).toBe(1);
      expect(s.questionsRetriedCount).toBe(1);
      expect(s.totalRetriesCount).toBe(1);

      const metrics = await adminService.getDashboardMetrics();
      expect(metrics.totalQuestionsCompleted).toBe(2);
      expect(metrics.firstAttemptSuccesses).toBe(1);
      expect(metrics.questionsRetried).toBe(1);
      expect(metrics.totalRetries).toBe(1);
    });
  });

  describe('Cross-Student Aggregation', () => {
    it('aggregates correctly across multiple students with varying activity levels', async () => {
      const { studentService, progressService, adminService } = createServices();

      // Student 1: 1 question, 1st attempt correct
      const s1 = await studentService.createStudent('Student 1');
      await progressService.recordAttempt({
        studentId: s1.id,
        activityId: 'Q001',
        category: 'picture-recognition',
        isCorrect: true,
        isCompleted: true,
      });

      // Student 2: 1 question, 2 attempts (1 retry)
      const s2 = await studentService.createStudent('Student 2');
      await progressService.recordAttempt({
        studentId: s2.id,
        activityId: 'Q001',
        category: 'picture-recognition',
        isCorrect: false,
        isCompleted: false,
      });
      await progressService.recordAttempt({
        studentId: s2.id,
        activityId: 'Q001',
        category: 'picture-recognition',
        isCorrect: true,
        isCompleted: true,
      });

      // Student 3: Registered, but zero attempts
      await studentService.createStudent('Student 3 (Inactive)');

      const metrics = await adminService.getDashboardMetrics();
      expect(metrics.totalStudents).toBe(3);
      expect(metrics.activeStudents).toBe(2);
      expect(metrics.totalQuestionsCompleted).toBe(2);
      expect(metrics.firstAttemptSuccesses).toBe(1);
      expect(metrics.questionsRetried).toBe(1);
      expect(metrics.totalRetries).toBe(1);
    });
  });

  describe('Student Detail & Category Mastery', () => {
    it('returns structured category mastery and chronological question history', async () => {
      const { studentService, progressService, adminService } = createServices();

      const student = await studentService.createStudent('DeepDive');

      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'Q010',
        category: 'spelling-choice',
        isCorrect: false,
        isCompleted: false,
      });

      await progressService.recordAttempt({
        studentId: student.id,
        activityId: 'Q010',
        category: 'spelling-choice',
        isCorrect: true,
        isCompleted: true,
      });

      const detail = await adminService.getStudentDetail(student.id);
      expect(detail).not.toBeNull();
      expect(detail!.studentName).toBe('DeepDive');
      expect(detail!.summary.totalRetriesCount).toBe(1);

      // Check category mastery
      const spellingCat = detail!.categoryMastery.find((c) => c.category === 'spelling-choice');
      expect(spellingCat).toBeDefined();
      expect(spellingCat!.completed).toBe(1);
      expect(spellingCat!.totalRetries).toBe(1);
      expect(spellingCat!.retried).toBe(1);

      // Check question history
      expect(detail!.questions.length).toBe(1);
      const q = detail!.questions[0];
      expect(q.questionId).toBe('Q010');
      expect(q.attempts).toBe(2);
      expect(q.retries).toBe(1);
      expect(q.firstAttemptCorrect).toBe(false);
      expect(q.status).toBe('completed');
    });

    it('returns null for unknown student ID', async () => {
      const { adminService } = createServices();
      const detail = await adminService.getStudentDetail('non_existent_id');
      expect(detail).toBeNull();
    });
  });
});

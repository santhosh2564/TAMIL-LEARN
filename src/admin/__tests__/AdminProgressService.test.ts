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

    // Seeds a local profile and marks it active, as the removed local "+ New Student" flow did.
    let seq = 0;
    const seedStudent = async (name: string) => {
      seq++;
      const at = new Date(Date.UTC(2026, 9, 1, 0, 0, seq)).toISOString();
      const student = { id: `stu_seed_${seq}`, name, createdAt: at, lastActiveAt: at };
      await studentRepo.saveStudent(student);
      await studentRepo.setActiveStudentId(student.id);
      return student;
    };

    return {
      studentService,
      seedStudent,
      progressService,
      attemptService,
      adminService,
    };
  }

  describe('Single-Student Attempt & Retry Tracking', () => {
    it('calculates first-attempt correct: attempts = 1, retries = 0, firstAttemptCorrect = true, completed = true', async () => {
      const { seedStudent, progressService, adminService } = createServices();

      const student = await seedStudent('Ananya');

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
      const { seedStudent, progressService, adminService } = createServices();

      const student = await seedStudent('Kavin');

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
      const { seedStudent, progressService, adminService } = createServices();

      const student = await seedStudent('Meera');

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
      const { seedStudent, progressService, adminService } = createServices();

      const student = await seedStudent('Suriya');

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
      const { seedStudent, progressService, adminService } = createServices();

      const student = await seedStudent('TestStudent');

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
      const { seedStudent, progressService, adminService } = createServices();

      // Student 1: 1 question, 1st attempt correct
      const s1 = await seedStudent('Student 1');
      await progressService.recordAttempt({
        studentId: s1.id,
        activityId: 'Q001',
        category: 'picture-recognition',
        isCorrect: true,
        isCompleted: true,
      });

      // Student 2: 1 question, 2 attempts (1 retry)
      const s2 = await seedStudent('Student 2');
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
      await seedStudent('Student 3 (Inactive)');

      const metrics = await adminService.getDashboardMetrics();
      expect(metrics.totalStudents).toBe(3);
      expect(metrics.activeStudents).toBe(2);
      expect(metrics.totalQuestionsCompleted).toBe(2);
      expect(metrics.firstAttemptSuccesses).toBe(1);
      expect(metrics.questionsRetried).toBe(1);
      expect(metrics.totalRetries).toBe(1);
    });
    it('aggregates correctly across multiple students with different progress profiles (Section 14 Audit)', async () => {
      const { seedStudent, progressService, adminService } = createServices();

      // Student A: 5 completed, 5 first-attempt successes, 0 retries
      const studentA = await seedStudent('Student A');
      for (let i = 1; i <= 5; i++) {
        await progressService.recordAttempt({
          studentId: studentA.id,
          activityId: `Q_A_${i}`,
          category: 'picture-recognition',
          isCorrect: true,
          isCompleted: true,
        });
      }

      // Student B: 5 completed, 2 first-attempt successes, 3 questions retried, 5 total retries
      const studentB = await seedStudent('Student B');
      // Q1 & Q2: First-attempt success
      for (let i = 1; i <= 2; i++) {
        await progressService.recordAttempt({
          studentId: studentB.id,
          activityId: `Q_B_${i}`,
          category: 'spelling-choice',
          isCorrect: true,
          isCompleted: true,
        });
      }
      // Q3: 1 retry (1 wrong -> 1 correct)
      await progressService.recordAttempt({
        studentId: studentB.id,
        activityId: 'Q_B_3',
        category: 'spelling-choice',
        isCorrect: false,
        isCompleted: false,
      });
      await progressService.recordAttempt({
        studentId: studentB.id,
        activityId: 'Q_B_3',
        category: 'spelling-choice',
        isCorrect: true,
        isCompleted: true,
      });

      // Q4: 1 retry (1 wrong -> 1 correct)
      await progressService.recordAttempt({
        studentId: studentB.id,
        activityId: 'Q_B_4',
        category: 'arrange-word',
        isCorrect: false,
        isCompleted: false,
      });
      await progressService.recordAttempt({
        studentId: studentB.id,
        activityId: 'Q_B_4',
        category: 'arrange-word',
        isCorrect: true,
        isCompleted: true,
      });

      // Q5: 3 retries (3 wrong -> 1 correct = 4 attempts)
      for (let k = 0; k < 3; k++) {
        await progressService.recordAttempt({
          studentId: studentB.id,
          activityId: 'Q_B_5',
          category: 'meaning-match',
          isCorrect: false,
          isCompleted: false,
        });
      }
      await progressService.recordAttempt({
        studentId: studentB.id,
        activityId: 'Q_B_5',
        category: 'meaning-match',
        isCorrect: true,
        isCompleted: true,
      });

      // Student C: 0 completed, 0 attempts
      const studentC = await seedStudent('Student C');

      // Verify individual summaries
      const summaries = await adminService.getStudentSummaries();
      expect(summaries.length).toBe(3);

      const summaryA = summaries.find((s) => s.studentId === studentA.id)!;
      expect(summaryA.questionsCompleted).toBe(5);
      expect(summaryA.firstAttemptCorrectCount).toBe(5);
      expect(summaryA.questionsRetriedCount).toBe(0);
      expect(summaryA.totalRetriesCount).toBe(0);

      const summaryB = summaries.find((s) => s.studentId === studentB.id)!;
      expect(summaryB.questionsCompleted).toBe(5);
      expect(summaryB.firstAttemptCorrectCount).toBe(2);
      expect(summaryB.questionsRetriedCount).toBe(3);
      expect(summaryB.totalRetriesCount).toBe(5);

      const summaryC = summaries.find((s) => s.studentId === studentC.id)!;
      expect(summaryC.questionsCompleted).toBe(0);
      expect(summaryC.totalQuestionsAttempted).toBe(0);
      expect(summaryC.firstAttemptCorrectCount).toBe(0);
      expect(summaryC.questionsRetriedCount).toBe(0);
      expect(summaryC.totalRetriesCount).toBe(0);

      // Verify Dashboard Metrics Aggregation Across All Students
      const metrics = await adminService.getDashboardMetrics();
      expect(metrics.totalStudents).toBe(3);
      expect(metrics.activeStudents).toBe(2);
      expect(metrics.totalQuestionsCompleted).toBe(10);
      expect(metrics.firstAttemptSuccesses).toBe(7);
      expect(metrics.questionsRetried).toBe(3);
      expect(metrics.totalRetries).toBe(5);
    });
  });

  describe('Student Detail & Category Mastery', () => {
    it('returns structured category mastery and chronological question history', async () => {
      const { seedStudent, progressService, adminService } = createServices();

      const student = await seedStudent('DeepDive');

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

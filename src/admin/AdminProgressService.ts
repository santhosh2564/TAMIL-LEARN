import { StudentService } from '../student/StudentService';
import { LocalStudentRepository } from '../student/LocalStudentRepository';
import { ProgressService } from '../progress/ProgressService';
import { LocalProgressRepository, PROGRESS_STORAGE_KEY_V2 } from '../progress/LocalProgressRepository';
import { AttemptService } from '../attempts/AttemptService';
import { LocalAttemptRepository } from '../attempts/LocalAttemptRepository';
import { LocalContentRepository } from '../repositories/implementations/LocalContentRepository';
import { Activity, ActivityCategory } from '../types';
import {
  AdminDashboardMetrics,
  StudentProgressSummary,
  StudentDetailedProgress,
  StudentCategoryMastery,
  QuestionAttemptDetail,
} from './types';

export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'picture-recognition': 'படம் பார்த்து சொல் (Picture Recognition)',
  'word-completion': 'சொல் நிரப்புக (Word Completion)',
  'arrange-word': 'சொல் உருவாக்குக (Arrange Word)',
  'spelling-choice': 'சரியான எழுத்துக்கூட்டல் (Spelling Choice)',
  'context-choice': 'வாக்கியப் பயிற்சி (Context Choice)',
  'meaning-match': 'பொருள் அறிவோம் (Meaning Match)',
};

export class AdminProgressService {
  constructor(
    private readonly studentService: StudentService = new StudentService(new LocalStudentRepository()),
    private readonly progressService: ProgressService = new ProgressService(
      new LocalProgressRepository(PROGRESS_STORAGE_KEY_V2)
    ),
    private readonly attemptService: AttemptService = new AttemptService(new LocalAttemptRepository()),
    private readonly contentRepository: LocalContentRepository = new LocalContentRepository()
  ) {}

  /**
   * Retrieves aggregated summary metrics across all students.
   */
  async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    const summaries = await this.getStudentSummaries();

    const totalStudents = summaries.length;
    // Active student: has attempted at least 1 question
    const activeStudents = summaries.filter((s) => s.totalQuestionsAttempted > 0).length;

    const totalActivitiesCompleted = summaries.reduce((acc, s) => acc + s.activitiesCompleted, 0);
    const totalQuestionsCompleted = summaries.reduce((acc, s) => acc + s.questionsCompleted, 0);
    const firstAttemptSuccesses = summaries.reduce((acc, s) => acc + s.firstAttemptCorrectCount, 0);
    const questionsRetried = summaries.reduce((acc, s) => acc + s.questionsRetriedCount, 0);
    const totalRetries = summaries.reduce((acc, s) => acc + s.totalRetriesCount, 0);

    return {
      totalStudents,
      activeStudents,
      totalActivitiesCompleted,
      totalQuestionsCompleted,
      firstAttemptSuccesses,
      questionsRetried,
      totalRetries,
    };
  }

  /**
   * Retrieves progress summaries for all known students.
   */
  async getStudentSummaries(): Promise<StudentProgressSummary[]> {
    const students = await this.studentService.listStudents();
    const allActivities = await this.contentRepository.getActivities();
    const totalAvailableActivities = allActivities.length;

    // In case there is an active student or storage records not in listStudents (e.g. test setups)
    const activeStudentId = await this.studentService.getActiveStudentId();
    const knownStudentIds = new Set(students.map((s) => s.id));

    if (activeStudentId && !knownStudentIds.has(activeStudentId)) {
      const active = await this.studentService.getStudent(activeStudentId);
      if (active) {
        students.push(active);
        knownStudentIds.add(active.id);
      }
    }

    const summaries: StudentProgressSummary[] = [];

    for (const student of students) {
      const progressMap = await this.progressService.getAllProgress(student.id);
      const attempts = await this.attemptService.getAttempts(student.id);

      // Unique questions attempted
      const attemptedQuestionIds = new Set<string>();
      for (const a of attempts) {
        attemptedQuestionIds.add(a.activityId);
      }
      for (const [id, p] of Object.entries(progressMap)) {
        if (p.attempts > 0 || p.completed) {
          attemptedQuestionIds.add(id);
        }
      }

      let completedCount = 0;
      let firstAttemptCount = 0;
      let questionsWithRetries = 0;
      let totalRetries = 0;

      for (const questionId of attemptedQuestionIds) {
        const metrics = await this.attemptService.getActivityMetrics(student.id, questionId);
        const prog = progressMap[questionId];

        const isCompleted = metrics.completed || (prog?.completed ?? false);
        const isFirstCorrect =
          metrics.attempts > 0
            ? metrics.firstAttemptCorrect
            : (prog?.firstAttemptCorrect ?? false);

        const retries =
          metrics.attempts > 0
            ? metrics.retryCount
            : (prog?.retryCount ?? 0);

        if (isCompleted) {
          completedCount++;
        }
        if (isFirstCorrect) {
          firstAttemptCount++;
        }
        if (retries > 0) {
          questionsWithRetries++;
          totalRetries += retries;
        }
      }

      const completionPercentage =
        totalAvailableActivities > 0
          ? Math.min(100, Math.round((completedCount / totalAvailableActivities) * 100))
          : 0;

      summaries.push({
        studentId: student.id,
        studentName: student.name,
        createdAt: student.createdAt,
        lastActiveAt: student.lastActiveAt,
        activitiesCompleted: completedCount,
        totalQuestionsAttempted: attemptedQuestionIds.size,
        questionsCompleted: completedCount,
        firstAttemptCorrectCount: firstAttemptCount,
        questionsRetriedCount: questionsWithRetries,
        totalRetriesCount: totalRetries,
        completionPercentage,
      });
    }

    return summaries;
  }

  /**
   * Retrieves granular learning details and question attempt history for a specific student.
   */
  async getStudentDetail(studentId: string): Promise<StudentDetailedProgress | null> {
    const student = await this.studentService.getStudent(studentId);
    if (!student) {
      return null;
    }

    const summaries = await this.getStudentSummaries();
    const summary = summaries.find((s) => s.studentId === studentId) || {
      studentId: student.id,
      studentName: student.name,
      createdAt: student.createdAt,
      lastActiveAt: student.lastActiveAt,
      activitiesCompleted: 0,
      totalQuestionsAttempted: 0,
      questionsCompleted: 0,
      firstAttemptCorrectCount: 0,
      questionsRetriedCount: 0,
      totalRetriesCount: 0,
      completionPercentage: 0,
    };

    const allActivities = await this.contentRepository.getActivities();
    const progressMap = await this.progressService.getAllProgress(studentId);
    const attempts = await this.attemptService.getAttempts(studentId);

    // Group attempts by activityId
    const attemptsByActivityId = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const list = attemptsByActivityId.get(a.activityId) || [];
      list.push(a);
      attemptsByActivityId.set(a.activityId, list);
    }

    // Category Mastery Breakdown
    const categories: ActivityCategory[] = [
      'picture-recognition',
      'word-completion',
      'arrange-word',
      'spelling-choice',
      'context-choice',
      'meaning-match',
    ];

    const categoryMastery: StudentCategoryMastery[] = [];

    for (const cat of categories) {
      const catActivities = allActivities.filter((a) => a.category === cat);
      const catActivityIds = new Set(catActivities.map((a) => a.id));

      for (const [id, prog] of Object.entries(progressMap)) {
        if (prog.category === cat) {
          catActivityIds.add(id);
        }
      }
      for (const att of attempts) {
        if (att.category === cat) {
          catActivityIds.add(att.activityId);
        }
      }

      const totalAvailable = Math.max(catActivities.length, catActivityIds.size);

      let catCompleted = 0;
      let catFirstCorrect = 0;
      let catRetried = 0;
      let catTotalRetries = 0;

      for (const actId of catActivityIds) {
        const metrics = await this.attemptService.getActivityMetrics(studentId, actId);
        const prog = progressMap[actId];

        const isCompleted = metrics.completed || (prog?.completed ?? false);
        const isFirstCorrect =
          metrics.attempts > 0
            ? metrics.firstAttemptCorrect
            : (prog?.firstAttemptCorrect ?? false);

        const retries =
          metrics.attempts > 0
            ? metrics.retryCount
            : (prog?.retryCount ?? 0);

        if (isCompleted) catCompleted++;
        if (isFirstCorrect) catFirstCorrect++;
        if (retries > 0) {
          catRetried++;
          catTotalRetries += retries;
        }
      }

      const completionPercentage =
        totalAvailable > 0 ? Math.round((catCompleted / totalAvailable) * 100) : 0;

      categoryMastery.push({
        category: cat,
        categoryTitle: CATEGORY_DISPLAY_NAMES[cat] || cat,
        totalAvailable,
        completed: catCompleted,
        firstAttemptCorrect: catFirstCorrect,
        retried: catRetried,
        totalRetries: catTotalRetries,
        completionPercentage,
      });
    }

    // Question Attempt History
    // First, list all questions that have either attempts or progress
    const activeActivityIds = new Set<string>([
      ...Array.from(attemptsByActivityId.keys()),
      ...Object.keys(progressMap),
    ]);

    // Build map of activity by ID
    const activityMap = new Map<string, Activity>();
    for (const act of allActivities) {
      activityMap.set(act.id, act);
    }

    const questions: QuestionAttemptDetail[] = [];

    for (const actId of activeActivityIds) {
      const act = activityMap.get(actId);
      const metrics = await this.attemptService.getActivityMetrics(studentId, actId);
      const prog = progressMap[actId];

      const attemptsCount = metrics.attempts > 0 ? metrics.attempts : (prog?.attempts ?? 0);
      const retryCount = metrics.attempts > 0 ? metrics.retryCount : (prog?.retryCount ?? 0);
      const isCompleted = metrics.completed || (prog?.completed ?? false);
      const isFirstCorrect =
        metrics.attempts > 0 ? metrics.firstAttemptCorrect : (prog?.firstAttemptCorrect ?? false);

      const status: 'completed' | 'in-progress' | 'not-started' = isCompleted
        ? 'completed'
        : attemptsCount > 0
        ? 'in-progress'
        : 'not-started';

      const lastAttempt = metrics.lastAttemptAt || prog?.lastAttemptAt || prog?.lastAttemptedAt;
      const completedAt = isCompleted ? (prog?.lastCompletedAt || metrics.lastAttemptAt) : undefined;

      const category = (act?.category || prog?.category || 'unknown') as ActivityCategory;

      questions.push({
        questionId: actId,
        activityTitle: act?.prompt || act?.targetWord || `Activity ${actId}`,
        category,
        categoryTitle: CATEGORY_DISPLAY_NAMES[category] || String(category),
        subject: act?.subject || (actId.startsWith('E') || actId.startsWith('class3-english') ? 'English' : 'Tamil'),
        attempts: attemptsCount,
        retries: retryCount,
        firstAttemptCorrect: isFirstCorrect,
        status,
        lastAttemptAt: lastAttempt,
        completedAt,
      });
    }

    // Sort questions by most recent attempt first
    questions.sort((a, b) => {
      const tA = a.lastAttemptAt ? new Date(a.lastAttemptAt).getTime() : 0;
      const tB = b.lastAttemptAt ? new Date(b.lastAttemptAt).getTime() : 0;
      return tB - tA;
    });

    return {
      studentId: student.id,
      studentName: student.name,
      createdAt: student.createdAt,
      lastActiveAt: student.lastActiveAt,
      summary,
      categoryMastery,
      questions,
    };
  }
}

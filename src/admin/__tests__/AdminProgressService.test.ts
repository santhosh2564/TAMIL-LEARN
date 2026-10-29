import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AdminProgressService } from '../AdminProgressService';

describe('AdminProgressService (Server-Backed)', () => {
  let service: AdminProgressService;

  beforeEach(() => {
    service = new AdminProgressService();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches dashboard metrics from /api/admin/metrics', async () => {
    const mockMetrics = {
      totalStudents: 15,
      activeStudents: 10,
      totalActivitiesCompleted: 25,
      totalQuestionsCompleted: 30,
      firstAttemptSuccesses: 20,
      questionsRetried: 5,
      totalRetries: 7,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ metrics: mockMetrics }),
      })
    );

    const result = await service.getDashboardMetrics();
    expect(fetch).toHaveBeenCalledWith('/api/admin/metrics');
    expect(result).toEqual(mockMetrics);
  });

  it('fetches student progress summaries from /api/admin/reports/students', async () => {
    const mockStudents = [
      {
        studentId: 'stud_1',
        studentName: 'Praveen',
        createdAt: '2026-10-29T00:00:00.000Z',
        lastActiveAt: '2026-10-29T12:00:00.000Z',
        activitiesCompleted: 5,
        totalQuestionsAttempted: 5,
        questionsCompleted: 5,
        firstAttemptCorrectCount: 4,
        questionsRetriedCount: 1,
        totalRetriesCount: 2,
        completionPercentage: 50,
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ students: mockStudents }),
      })
    );

    const result = await service.getStudentSummaries();
    expect(fetch).toHaveBeenCalledWith('/api/admin/reports/students');
    expect(result).toEqual(mockStudents);
  });

  it('fetches student detail from /api/admin/students/:id/detail', async () => {
    const mockDetail = {
      studentId: 'stud_1',
      studentName: 'Praveen',
      createdAt: '2026-10-29T00:00:00.000Z',
      lastActiveAt: '2026-10-29T12:00:00.000Z',
      summary: {} as any,
      categoryMastery: [],
      questions: [],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ detail: mockDetail }),
      })
    );

    const result = await service.getStudentDetail('stud_1');
    expect(fetch).toHaveBeenCalledWith('/api/admin/students/stud_1/detail');
    expect(result).toEqual(mockDetail);
  });

  it('returns null when student detail is 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })
    );

    const result = await service.getStudentDetail('unknown');
    expect(result).toBeNull();
  });

  it('throws an error when metrics fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    await expect(service.getDashboardMetrics()).rejects.toThrow('Failed to fetch admin metrics');
  });
});

import {
  AdminDashboardMetrics,
  StudentProgressSummary,
  StudentDetailedProgress,
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
  /**
   * Retrieves aggregated summary metrics across all students from the server.
   */
  async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    const res = await fetch('/api/admin/metrics');
    if (!res.ok) {
      throw new Error(`Failed to fetch admin metrics: ${res.statusText}`);
    }
    const data = await res.json();
    return data.metrics;
  }

  /**
   * Retrieves progress summaries for all students from the server.
   */
  async getStudentSummaries(): Promise<StudentProgressSummary[]> {
    const res = await fetch('/api/admin/reports/students');
    if (!res.ok) {
      throw new Error(`Failed to fetch student progress summaries: ${res.statusText}`);
    }
    const data = await res.json();
    return data.students;
  }

  /**
   * Retrieves granular learning details and question attempt history for a specific student.
   */
  async getStudentDetail(studentId: string): Promise<StudentDetailedProgress | null> {
    const res = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/detail`);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to fetch student detail: ${res.statusText}`);
    }
    const data = await res.json();
    return data.detail;
  }
}

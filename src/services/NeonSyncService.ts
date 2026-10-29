import { StudentProfile } from '../student/types';
import { ActivityProgress } from '../progress/types';
import { AttemptRecord } from '../attempts/types';

export interface NeonCloudStatus {
  connected: boolean;
  provider?: string;
  branch?: string;
  lastSyncedAt?: string;
  error?: string;
}

export class NeonSyncService {
  private static instance: NeonSyncService | null = null;
  private status: NeonCloudStatus = { connected: false };

  static getInstance(): NeonSyncService {
    if (!this.instance) {
      this.instance = new NeonSyncService();
    }
    return this.instance;
  }

  async checkHealth(): Promise<NeonCloudStatus> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`Health check returned status ${res.status}`);
      }
      const data = await res.json();
      this.status = {
        connected: data.status === 'ok',
        provider: data.provider,
        branch: data.branch,
        lastSyncedAt: data.timestamp
      };
      return this.status;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.status = {
        connected: false,
        error: message
      };
      return this.status;
    }
  }

  getStatus(): NeonCloudStatus {
    return this.status;
  }

  async syncStudent(student: StudentProfile): Promise<boolean> {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
      });
      return res.ok;
    } catch {
      // Offline fallback: fail silently to preserve local experience
      return false;
    }
  }

  async deleteStudent(studentId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(studentId)}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async syncProgress(progress: ActivityProgress): Promise<boolean> {
    if (!progress.studentId) return false;
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(progress.studentId)}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progress)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async syncAttempt(attempt: AttemptRecord): Promise<boolean> {
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(attempt.studentId)}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async syncFullLocalState(params: {
    students: StudentProfile[];
    progressByStudent: Record<string, ActivityProgress[]>;
    attemptsByStudent: Record<string, AttemptRecord[]>;
  }): Promise<boolean> {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const neonSync = NeonSyncService.getInstance();

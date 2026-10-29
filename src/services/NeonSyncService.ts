import { ActivityProgress } from '../progress/types';
import { AttemptRecord } from '../attempts/types';
import { offlineOutbox } from './OfflineOutboxQueue';

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
    // Outbox-first: persist to offline storage BEFORE dispatching network call
    await offlineOutbox.enqueue(attempt);

    try {
      const res = await fetch(`/api/students/${encodeURIComponent(attempt.studentId)}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(attempt)
      });
      if (res.ok) {
        // Successfully recorded: dequeue from active outbox
        await offlineOutbox.remove(attempt.id);
        return true;
      }
      if (res.status === 404) {
        // Student not found / archived / deleted: route to dead-letter queue
        await offlineOutbox.moveToDeadLetter(attempt);
        return false;
      }
      // Non-2xx/non-404: keep in outbox for subsequent retry
      return false;
    } catch {
      // Network failure / offline: keep in outbox
      return false;
    }
  }
}

export const neonSync = NeonSyncService.getInstance();

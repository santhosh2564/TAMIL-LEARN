export interface ActiveSessionDto {
  id: string;
  schoolId: string;
  studentId: string;
  subject: 'tamil' | 'english';
  categoryOrModule: string;
  activityIds: string[];
  currentIndex: number;
  status: 'active' | 'completed' | 'abandoned';
  createdAt: string;
  updatedAt: string;
}

const LOCAL_SESSION_KEY_PREFIX = 'sa.activeSession.';

export class SessionSyncService {
  private static instance: SessionSyncService | null = null;

  static getInstance(): SessionSyncService {
    if (!this.instance) {
      this.instance = new SessionSyncService();
    }
    return this.instance;
  }

  private getLocalKey(studentId: string): string {
    return `${LOCAL_SESSION_KEY_PREFIX}${studentId}`;
  }

  private getLocalSession(studentId: string): ActiveSessionDto | null {
    try {
      const raw = localStorage.getItem(this.getLocalKey(studentId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.status === 'active') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private setLocalSession(studentId: string, session: ActiveSessionDto | null): void {
    try {
      const key = this.getLocalKey(studentId);
      if (!session || session.status === 'completed' || session.status === 'abandoned') {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(session));
      }
    } catch {
      // Storage quota or restricted environment
    }
  }

  async getActiveSession(
    studentId: string,
    subject?: 'tamil' | 'english',
    category?: string
  ): Promise<ActiveSessionDto | null> {
    try {
      const query = new URLSearchParams();
      if (subject) query.set('subject', subject);
      if (category) query.set('category', category);

      const qStr = query.toString() ? `?${query.toString()}` : '';
      const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/sessions/active${qStr}`, {
        credentials: 'same-origin',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          this.setLocalSession(studentId, data.session);
          return data.session;
        } else {
          this.setLocalSession(studentId, null);
          return null;
        }
      }
    } catch {
      // Offline fallback: load from local storage
    }

    return this.getLocalSession(studentId);
  }

  async createOrSaveSession(params: {
    id?: string;
    studentId: string;
    subject: 'tamil' | 'english';
    categoryOrModule: string;
    activityIds: string[];
    currentIndex?: number;
  }): Promise<ActiveSessionDto> {
    const fallbackSession: ActiveSessionDto = {
      id: params.id || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      schoolId: 'local',
      studentId: params.studentId,
      subject: params.subject,
      categoryOrModule: params.categoryOrModule,
      activityIds: params.activityIds,
      currentIndex: params.currentIndex ?? 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`/api/students/${encodeURIComponent(params.studentId)}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          id: fallbackSession.id,
          subject: params.subject,
          categoryOrModule: params.categoryOrModule,
          activityIds: params.activityIds,
          currentIndex: params.currentIndex ?? 0,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          this.setLocalSession(params.studentId, data.session);
          return data.session;
        }
      }
    } catch {
      // Offline: cache fallback
    }

    this.setLocalSession(params.studentId, fallbackSession);
    return fallbackSession;
  }

  async updateSessionProgress(
    sessionId: string,
    studentId: string,
    currentIndex?: number,
    status?: 'active' | 'completed' | 'abandoned'
  ): Promise<void> {
    // Update local cache immediately
    const local = this.getLocalSession(studentId);
    if (local && local.id === sessionId) {
      if (currentIndex !== undefined) local.currentIndex = currentIndex;
      if (status !== undefined) local.status = status;
      local.updatedAt = new Date().toISOString();
      this.setLocalSession(studentId, local);
    }

    try {
      await fetch(`/api/students/${encodeURIComponent(studentId)}/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          currentIndex,
          status,
        }),
      });
    } catch {
      // Local state is already updated; will sync when back online
    }
  }
}

export const sessionSync = SessionSyncService.getInstance();


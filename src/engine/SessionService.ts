import { ActivitySession, ActivityResult } from './types';

export class SessionService {
  createSession(id: string, activityIds: string[]): ActivitySession {
    if (!activityIds || activityIds.length === 0) {
      throw new Error('Cannot create session without activities');
    }

    return {
      id,
      activityIds,
      currentIndex: 0,
      completedActivityIds: [],
      results: {},
      status: 'not-started',
    };
  }

  startSession(session: ActivitySession): ActivitySession {
    if (session.status !== 'not-started') {
      return session; // Or throw, depending on strictness
    }

    return {
      ...session,
      status: 'active',
      startedAt: Date.now(),
    };
  }

  getCurrentActivityId(session: ActivitySession): string | null {
    if (session.status === 'completed' || session.currentIndex >= session.activityIds.length) {
      return null;
    }
    return session.activityIds[session.currentIndex];
  }

  completeActivity(session: ActivitySession, result: ActivityResult): ActivitySession {
    const currentActivityId = this.getCurrentActivityId(session);
    
    if (currentActivityId !== result.activityId) {
      throw new Error('Result activity ID does not match current session activity');
    }

    const updatedResults = {
      ...session.results,
      [result.activityId]: result,
    };

    const completedActivityIds = [...session.completedActivityIds, result.activityId];

    return {
      ...session,
      results: updatedResults,
      completedActivityIds,
    };
  }

  nextActivity(session: ActivitySession): ActivitySession {
    if (session.status === 'completed') {
      return session;
    }

    const nextIndex = session.currentIndex + 1;
    
    if (nextIndex >= session.activityIds.length) {
      // Session is complete
      return {
        ...session,
        currentIndex: nextIndex,
        status: 'completed',
        completedAt: Date.now(),
      };
    }

    return {
      ...session,
      currentIndex: nextIndex,
    };
  }
}

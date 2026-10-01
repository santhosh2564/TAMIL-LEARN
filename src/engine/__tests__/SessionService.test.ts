import { describe, it, expect } from 'vitest';
import { SessionService } from '../SessionService';

describe('SessionService', () => {
  it('creates and starts a session', () => {
    const service = new SessionService();
    const session = service.createSession('sess-1', ['act1', 'act2']);
    
    expect(session.status).toBe('not-started');
    expect(session.activityIds).toEqual(['act1', 'act2']);
    
    const started = service.startSession(session);
    expect(started.status).toBe('active');
    expect(started.startedAt).toBeDefined();
  });

  it('progresses through activities and completes session', () => {
    const service = new SessionService();
    let session = service.createSession('sess-1', ['act1', 'act2']);
    session = service.startSession(session);

    expect(service.getCurrentActivityId(session)).toBe('act1');

    // Complete act1
    session = service.completeActivity(session, {
      activityId: 'act1',
      completed: true,
      attempts: 1,
      startedAt: Date.now(),
      correct: true,
    });
    
    expect(session.completedActivityIds).toContain('act1');
    expect(session.results['act1'].correct).toBe(true);

    // Next
    session = service.nextActivity(session);
    expect(service.getCurrentActivityId(session)).toBe('act2');
    expect(session.status).toBe('active');

    // Complete act2
    session = service.completeActivity(session, {
      activityId: 'act2',
      completed: true,
      attempts: 2,
      startedAt: Date.now(),
      correct: false,
    });

    // Next -> Should complete session
    session = service.nextActivity(session);
    expect(session.status).toBe('completed');
    expect(service.getCurrentActivityId(session)).toBeNull();
  });
});

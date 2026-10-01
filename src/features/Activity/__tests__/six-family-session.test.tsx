import { describe, it, expect } from 'vitest';
import { SessionService } from '../../../engine/SessionService';
import { LocalContentRepository } from '../../../repositories/implementations/LocalContentRepository';
import { registerCoreActivities } from '../registerActivities';
import { activityRegistry } from '../../../engine';
import { ActivityResult } from '../../../engine/types';

describe('Full 6-Family Session Flow', () => {
  it('progresses through all 6 activity families successfully', async () => {
    registerCoreActivities();
    const repo = new LocalContentRepository();
    
    // Grab exactly one activity of each family
    const a1 = (await repo.getActivityById('Q014'))!; // picture-recognition
    const a2 = (await repo.getActivityById('Q006'))!; // spelling-choice
    const a3 = (await repo.getActivityById('Q031'))!; // meaning-match
    const a4 = (await repo.getActivityById('Q011'))!; // context-choice
    const a5 = (await repo.getActivityById('Q015'))!; // arrange-word
    const a6 = (await repo.getActivityById('Q002'))!; // word-completion

    expect(a1.category).toBe('picture-recognition');
    expect(a2.category).toBe('spelling-choice');
    expect(a3.category).toBe('meaning-match');
    expect(a4.category).toBe('context-choice');
    expect(a5.category).toBe('arrange-word');
    expect(a6.category).toBe('word-completion');

    const svc = new SessionService();
    let session = svc.createSession('test-session', [a1.id, a2.id, a3.id, a4.id, a5.id, a6.id]);
    session = svc.startSession(session);

    const sequence = [
      { id: 'Q014', answer: 'D' }, // "வண்ணங்கள்" is D based on Q014 data
      { id: 'Q006', answer: 'A' }, // Example answer
      { id: 'Q031', answer: 'A' }, // Example answer
      { id: 'Q011', answer: 'A' }, // Example answer
      { id: 'Q015', answer: ['A', 'B', 'C', 'D'] }, // கிழங்கு tokens
      { id: 'Q002', answer: 'A' }, // தி
    ];

    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      
      expect(session.status).toBe('active');
      expect(svc.getCurrentActivityId(session)).toBe(step.id);
      
      const activity = [a1, a2, a3, a4, a5, a6].find(a => a.id === step.id)!;
      const definition = activityRegistry.getDefinition(activity.category, activity.variant);
      expect(definition).toBeDefined();

      const mockState = {
        activityId: step.id,
        status: 'active' as const,
        attempts: 1
      };
      
      const evaluation = definition!.evaluator.evaluate(activity, step.answer, mockState);
      
      const result: ActivityResult = {
        activityId: step.id,
        completed: evaluation.completed,
        correct: evaluation.correct,
        attempts: 1,
        startedAt: Date.now(),
        completedAt: Date.now()
      };
      
      session = svc.completeActivity(session, result);
      session = svc.nextActivity(session);
      
      if (i < sequence.length - 1) {
        expect(session.status).toBe('active'); // next activity
      } else {
        expect(session.status).toBe('completed');
      }
    }

    const results = Object.values(session.results);
    expect(results.length).toBe(6);
    expect(results[0].activityId).toBe('Q014');
    expect(results[1].activityId).toBe('Q006');
    expect(results[5].activityId).toBe('Q002');
  });
});

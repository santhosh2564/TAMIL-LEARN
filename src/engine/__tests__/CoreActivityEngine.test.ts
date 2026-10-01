import { describe, it, expect, vi } from 'vitest';
import { CoreActivityEngine } from '../CoreActivityEngine';
import { Activity } from '../../types';
import { ActivityEvaluator, ActivityRuntimeState } from '../types';

describe('CoreActivityEngine', () => {
  const mockActivity = {
    id: 'test-act',
    category: 'unknown',
    variant: 'unknown',
    learningObjective: 'Test',
    content: {},
  } as unknown as Activity;

  it('starts an activity in active state', () => {
    const engine = new CoreActivityEngine();
    const state = engine.start(mockActivity);

    expect(state.activityId).toBe('test-act');
    expect(state.status).toBe('active');
    expect(state.attempts).toBe(0);
    expect(state.startedAt).toBeDefined();
    expect(state.completedAt).toBeUndefined();
  });

  it('submits input and updates state using evaluator', () => {
    const engine = new CoreActivityEngine();
    const state = engine.start(mockActivity);

    const mockEvaluator: ActivityEvaluator = {
      evaluate: vi.fn().mockReturnValue({
        correct: true,
        completed: true,
        attempts: 1,
      }),
    };

    const { nextState, evaluation } = engine.submit(mockActivity, state, 'input', mockEvaluator);

    expect(evaluation.correct).toBe(true);
    expect(evaluation.completed).toBe(true);
    expect(nextState.attempts).toBe(1);
    expect(nextState.status).toBe('completed');
    expect(nextState.completedAt).toBeDefined();
  });

  it('prevents submission when already completed', () => {
    const engine = new CoreActivityEngine();
    const state: ActivityRuntimeState = {
      activityId: 'test-act',
      status: 'completed',
      attempts: 1,
      startedAt: Date.now(),
      completedAt: Date.now(),
    };

    const mockEvaluator: ActivityEvaluator = {
      evaluate: vi.fn(),
    };

    expect(() => engine.submit(mockActivity, state, 'input', mockEvaluator)).toThrow('Cannot submit to a completed activity');
  });

  it('resets activity state correctly', () => {
    const engine = new CoreActivityEngine();
    const state: ActivityRuntimeState = {
      activityId: 'test-act',
      status: 'completed',
      attempts: 5,
      startedAt: Date.now() - 10000,
      completedAt: Date.now(),
    };

    const resetState = engine.reset(state);

    expect(resetState.activityId).toBe('test-act');
    expect(resetState.status).toBe('active');
    expect(resetState.attempts).toBe(0);
    expect(resetState.completedAt).toBeUndefined();
  });
});

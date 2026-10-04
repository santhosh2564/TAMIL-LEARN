import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { activityRegistry } from '../../../engine';
import { registerCoreActivities } from '../registerActivities';
import { Activity } from '../../../types';

const ENG_DIR = path.resolve('src/content/class-3/english');

describe('English Runtime Compatibility Check', () => {
  registerCoreActivities();

  const allActivities: Activity[] = [];
  for (let m = 1; m <= 8; m++) {
    const actFile = path.join(ENG_DIR, `module-${m}`, 'activities.json');
    const acts: Activity[] = JSON.parse(fs.readFileSync(actFile, 'utf-8'));
    allActivities.push(...acts);
  }

  it('contains all 1,238 normalized English activities', () => {
    expect(allActivities.length).toBe(1238);
  });

  it('ensures all 1,238 activities resolve in ActivityRegistry', () => {
    const unresolved: string[] = [];

    allActivities.forEach(activity => {
      const definition = activityRegistry.getDefinition(activity.category, activity.variant);
      if (!definition) {
        unresolved.push(`${activity.id} (${activity.category}::${activity.variant})`);
      }
    });

    expect(unresolved).toEqual([]);
  });

  it('renders components for every activity family and variant without crashing', () => {
    // Group activities by category::variant to test distinct interaction types
    const variantSamples = new Map<string, Activity>();
    allActivities.forEach(act => {
      const key = `${act.category}::${act.variant}`;
      if (!variantSamples.has(key)) {
        variantSamples.set(key, act);
      }
    });

    expect(variantSamples.size).toBeGreaterThanOrEqual(4);

    variantSamples.forEach((sample, key) => {
      const definition = activityRegistry.getDefinition(sample.category, sample.variant);
      expect(definition, `Missing definition for ${key}`).toBeDefined();

      if (definition) {
        const Component = definition.component;
        const mockState = {
          activityId: sample.id,
          status: 'idle' as const,
          attempts: 0
        };

        const { unmount } = render(
          <Component
            activity={sample}
            state={mockState}
            onSubmit={vi.fn()}
            onNext={vi.fn()}
          />
        );

        unmount();
      }
    });
  });

  it('ensures all activities evaluate safely without throwing unhandled exceptions', () => {
    allActivities.forEach(activity => {
      const definition = activityRegistry.getDefinition(activity.category, activity.variant);
      expect(definition).toBeDefined();

      if (definition) {
        const evaluator = definition.evaluator;
        const mockState = {
          activityId: activity.id,
          status: 'active' as const,
          attempts: 1
        };

        // Determine a test input based on variant
        let testInput: string | string[] = '';
        if (activity.variant === 'select') {
          testInput = activity.options?.[0]?.id || 'A';
        } else if (activity.variant === 'arrange') {
          testInput = activity.options?.map(o => o.id) || ['A', 'B'];
        } else {
          testInput = activity.targetWord || 'test';
        }

        expect(() => {
          evaluator.evaluate(activity, testInput, mockState);
        }).not.toThrow();
      }
    });
  });

  it('safely evaluates all 9 documented anomaly activities without crashing', () => {
    const anomalyIds = ['EW114', 'EW249', 'EW262', 'EW265', 'EW574', 'EW576', 'EW894', 'EW913', 'EW943'];
    const anomalyActs = allActivities.filter(a => anomalyIds.includes(a.source.ewId || '') && a.role === 'new');

    expect(anomalyActs.length).toBe(9);

    anomalyActs.forEach(act => {
      const definition = activityRegistry.getDefinition(act.category, act.variant);
      expect(definition).toBeDefined();

      const evaluator = definition!.evaluator;
      const mockState = {
        activityId: act.id,
        status: 'active' as const,
        attempts: 1
      };

      // Test with token IDs if arrange variant, or answer string otherwise
      const sampleInput = act.variant === 'arrange'
        ? (act.options?.map(o => o.id) || ['A'])
        : act.correctAnswer;

      expect(() => {
        evaluator.evaluate(act, sampleInput, mockState);
      }).not.toThrow();

      // Test with mismatched/invalid input — must fail safely without throwing
      expect(() => {
        evaluator.evaluate(act, 'unexpected_input', mockState);
      }).not.toThrow();
    });
  });
});

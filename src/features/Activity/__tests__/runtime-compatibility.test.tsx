import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LocalContentRepository } from '../../../repositories/implementations/LocalContentRepository';
import { activityRegistry } from '../../../engine';
import { registerCoreActivities } from '../registerActivities';

describe('Runtime Compatibility Check', () => {
  const repository = new LocalContentRepository();

  it('contains exactly 144 activities', async () => {
    const allActivities = await repository.getActivities();
    expect(allActivities.length).toBe(144);
  });

  it('ensures all activities resolve in the registry and render without crashing', async () => {
    const allActivities = await repository.getActivities();
    registerCoreActivities();
    
    let resolvedCount = 0;
    const categoryStats: Record<string, number> = {};
    const variantStats: Record<string, number> = {};
    const levelStats: Record<string, number> = {};

    for (const activity of allActivities) {
      // Collect stats
      categoryStats[activity.category] = (categoryStats[activity.category] || 0) + 1;
      variantStats[activity.variant] = (variantStats[activity.variant] || 0) + 1;
      const lvlKey = `Level ${activity.level}`;
      levelStats[lvlKey] = (levelStats[lvlKey] || 0) + 1;

      // Ensure valid ID
      expect(activity.id).toBeDefined();
      expect(activity.id.length).toBeGreaterThan(0);

      // Resolve from registry
      const definition = activityRegistry.getDefinition(activity.category, activity.variant);
      
      // Every single activity should be successfully resolved
      expect(definition, `Failed to resolve activity ${activity.id} (${activity.category}/${activity.variant})`).toBeDefined();

      if (definition) {
        resolvedCount++;

        // Render the component
        const Component = definition.component;
        const mockState = {
          activityId: activity.id,
          status: 'idle' as const,
          attempts: 0
        };

        const { unmount } = render(
          <Component 
            activity={activity} 
            state={mockState} 
            onSubmit={vi.fn()} 
            onNext={vi.fn()} 
          />
        );
        
        // Ensure no crash
        unmount();

        // Verify Evaluator accepts valid structure without crashing
        // We will just invoke evaluate with an empty input to ensure safe fallback
        const result = definition.evaluator.evaluate(activity, [] as never, mockState);
        expect(result).toBeDefined();
        expect(typeof result.correct).toBe('boolean');
      }
    }

    expect(resolvedCount).toBe(144);

    // Log stats for manual verification against content-analysis
    console.log('Category Stats:', categoryStats);
    console.log('Variant Stats:', variantStats);
    console.log('Level Stats:', levelStats);

    // Verify accurate counts based on actual runtime results
    expect(categoryStats['picture-recognition']).toBe(21);
    expect(categoryStats['spelling-choice']).toBe(26);
    expect(categoryStats['meaning-match']).toBe(23);
    expect(categoryStats['context-choice']).toBe(27);
    expect(categoryStats['arrange-word']).toBe(38);
    expect(categoryStats['word-completion']).toBe(9);
  });

  it('ensures unique IDs', async () => {
    const allActivities = await repository.getActivities();
    const ids = new Set<string>();
    for (const activity of allActivities) {
      expect(ids.has(activity.id)).toBe(false);
      ids.add(activity.id);
    }
  });
});

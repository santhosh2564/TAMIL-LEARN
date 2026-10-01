import { describe, it, expect } from 'vitest';
import { ActivityRegistry } from '../ActivityRegistry';
import { ActivityDefinition } from '../types';

describe('ActivityRegistry', () => {
  it('registers and retrieves definitions by category and variant', () => {
    const registry = new ActivityRegistry();
    
    const mockDef: ActivityDefinition = {
      category: 'picture-recognition',
      variant: 'select',
      component: () => null,
      evaluator: { evaluate: () => ({ correct: true, completed: true, attempts: 1 }) },
    };

    registry.register(mockDef);

    const retrieved = registry.getDefinition('picture-recognition', 'select');
    expect(retrieved).toBeDefined();
    expect(retrieved?.category).toBe('picture-recognition');
  });

  it('returns undefined for unregistered combinations', () => {
    const registry = new ActivityRegistry();
    
    const retrieved = registry.getDefinition('word-completion', 'missing-unit');
    expect(retrieved).toBeUndefined();
  });
});

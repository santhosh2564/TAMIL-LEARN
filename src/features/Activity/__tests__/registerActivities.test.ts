import { describe, it, expect } from 'vitest';
import { registerCoreActivities } from '../registerActivities';
import { activityRegistry } from '../../../engine';

describe('Activity Registry Integration', () => {
  it('registers picture-recognition and spelling-choice correctly', () => {
    registerCoreActivities();
    
    const picDef = activityRegistry.getDefinition('picture-recognition', 'select');
    expect(picDef).toBeDefined();
    expect(picDef?.component.name).toBe('PictureSelectActivity');

    const spellDef = activityRegistry.getDefinition('spelling-choice', 'select');
    expect(spellDef).toBeDefined();
    expect(spellDef?.component.name).toBe('SpellingSelectActivity');
  });

  it('registers meaning-match and context-choice correctly', () => {
    registerCoreActivities();
    
    const meaningDef = activityRegistry.getDefinition('meaning-match', 'translate-select');
    expect(meaningDef).toBeDefined();
    expect(meaningDef?.component.name).toBe('MeaningMatchActivity');

    const contextDef = activityRegistry.getDefinition('context-choice', 'fill-blank');
    expect(contextDef).toBeDefined();
    expect(contextDef?.component.name).toBe('ContextChoiceActivity');
  });

  it('registers arrange-word and word-completion correctly', () => {
    registerCoreActivities();
    
    const arrangeDef = activityRegistry.getDefinition('arrange-word', 'arrange');
    expect(arrangeDef).toBeDefined();
    expect(arrangeDef?.component.name).toBe('ArrangeWordActivity');

    const completeDef = activityRegistry.getDefinition('word-completion', 'missing-unit');
    expect(completeDef).toBeDefined();
    expect(completeDef?.component.name).toBe('WordCompletionActivity');
  });
});

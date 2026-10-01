import { ActivityCategory, ActivityVariant } from '../types';
import { ActivityDefinition } from './types';

export class ActivityRegistry {
  private definitions: Map<string, ActivityDefinition> = new Map();

  private getKey(category: string, variant: string): string {
    return `${category}::${variant}`;
  }

  register(definition: ActivityDefinition): void {
    const key = this.getKey(definition.category, definition.variant);
    if (this.definitions.has(key)) {
      console.warn(`ActivityRegistry: Overwriting existing definition for ${key}`);
    }
    this.definitions.set(key, definition);
  }

  getDefinition(category: ActivityCategory | 'unknown', variant: ActivityVariant | 'unknown'): ActivityDefinition | undefined {
    return this.definitions.get(this.getKey(category, variant));
  }
}

// Global registry instance
export const activityRegistry = new ActivityRegistry();

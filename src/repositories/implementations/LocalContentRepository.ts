import { ContentRepository } from '../ContentRepository';
import { Activity, ActivityQuery, ContentManifest, EnglishCurriculumManifest, EnglishModuleManifest } from '../../types';

import class3TamilTerm1 from '../../content/class-3/tamil/term-1/activities.json';
import manifestTerm1 from '../../content/class-3/tamil/term-1/manifest.json';

import englishCurriculumManifest from '../../content/class-3/english/manifest.json';
import m1Manifest from '../../content/class-3/english/module-1/manifest.json';
import m1Activities from '../../content/class-3/english/module-1/activities.json';
import m2Manifest from '../../content/class-3/english/module-2/manifest.json';
import m2Activities from '../../content/class-3/english/module-2/activities.json';
import m3Manifest from '../../content/class-3/english/module-3/manifest.json';
import m3Activities from '../../content/class-3/english/module-3/activities.json';
import m4Manifest from '../../content/class-3/english/module-4/manifest.json';
import m4Activities from '../../content/class-3/english/module-4/activities.json';
import m5Manifest from '../../content/class-3/english/module-5/manifest.json';
import m5Activities from '../../content/class-3/english/module-5/activities.json';
import m6Manifest from '../../content/class-3/english/module-6/manifest.json';
import m6Activities from '../../content/class-3/english/module-6/activities.json';
import m7Manifest from '../../content/class-3/english/module-7/manifest.json';
import m7Activities from '../../content/class-3/english/module-7/activities.json';
import m8Manifest from '../../content/class-3/english/module-8/manifest.json';
import m8Activities from '../../content/class-3/english/module-8/activities.json';

export class LocalContentRepository implements ContentRepository {
  private tamilActivities: Activity[];
  private englishActivities: Activity[];
  private activityIndex: Map<string, Activity>;
  private manifest: ContentManifest;
  private englishManifest: EnglishCurriculumManifest;
  private englishModuleManifests: Map<number, EnglishModuleManifest>;

  constructor() {
    this.manifest = manifestTerm1 as ContentManifest;
    this.tamilActivities = class3TamilTerm1 as Activity[];
    this.englishManifest = englishCurriculumManifest as EnglishCurriculumManifest;

    this.englishModuleManifests = new Map([
      [1, m1Manifest as EnglishModuleManifest],
      [2, m2Manifest as EnglishModuleManifest],
      [3, m3Manifest as EnglishModuleManifest],
      [4, m4Manifest as EnglishModuleManifest],
      [5, m5Manifest as EnglishModuleManifest],
      [6, m6Manifest as EnglishModuleManifest],
      [7, m7Manifest as EnglishModuleManifest],
      [8, m8Manifest as EnglishModuleManifest],
    ]);

    this.englishActivities = [
      ...(m1Activities as Activity[]),
      ...(m2Activities as Activity[]),
      ...(m3Activities as Activity[]),
      ...(m4Activities as Activity[]),
      ...(m5Activities as Activity[]),
      ...(m6Activities as Activity[]),
      ...(m7Activities as Activity[]),
      ...(m8Activities as Activity[]),
    ];

    // Unified index for O(1) lookups across all subjects
    this.activityIndex = new Map();
    for (const activity of this.tamilActivities) {
      this.activityIndex.set(activity.id, activity);
    }
    for (const activity of this.englishActivities) {
      this.activityIndex.set(activity.id, activity);
    }
  }

  /**
   * Helper to deep clone objects to guarantee immutability.
   */
  private clone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
  }

  private filterActivities(query?: ActivityQuery): Activity[] {
    let pool: Activity[];

    if (!query) {
      // Default to Tamil activities for backward-compatibility with existing tests
      pool = this.tamilActivities;
    } else if (query.subject?.toLowerCase() === 'english' || query.module !== undefined) {
      pool = this.englishActivities;
    } else if (query.subject?.toLowerCase() === 'all') {
      pool = [...this.tamilActivities, ...this.englishActivities];
    } else if (query.subject?.toLowerCase() === 'tamil') {
      pool = this.tamilActivities;
    } else {
      pool = this.tamilActivities;
    }

    return pool.filter(a => {
      if (query?.classLevel !== undefined && a.classLevel !== query.classLevel) return false;
      if (query?.subject !== undefined && query.subject.toLowerCase() !== 'all' && a.subject?.toLowerCase() !== query.subject.toLowerCase()) return false;
      if (query?.term !== undefined && a.term !== query.term) return false;
      if (query?.module !== undefined && a.module !== query.module) return false;
      if (query?.day !== undefined && a.day !== query.day) return false;
      if (query?.role !== undefined && a.role !== query.role) return false;
      if (query?.category !== undefined && a.category?.trim().replace(/\s+/g, '-') !== query.category.trim().replace(/\s+/g, '-')) return false;
      if (query?.variant !== undefined && a.variant !== query.variant) return false;
      if (query?.level !== undefined && a.level !== query.level) return false;
      return true;
    });
  }

  async getManifest(): Promise<ContentManifest> {
    return Promise.resolve(this.clone(this.manifest));
  }

  async getEnglishCurriculumManifest(): Promise<EnglishCurriculumManifest> {
    return Promise.resolve(this.clone(this.englishManifest));
  }

  async getEnglishModuleManifest(moduleNumber: number): Promise<EnglishModuleManifest | null> {
    const mod = this.englishModuleManifests.get(moduleNumber);
    if (!mod) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.clone(mod));
  }

  async getActivities(query?: ActivityQuery): Promise<Activity[]> {
    const result = this.filterActivities(query);
    return Promise.resolve(this.clone(result));
  }

  async getActivityById(id: string): Promise<Activity | null> {
    const activity = this.activityIndex.get(id);
    if (!activity) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.clone(activity));
  }

  async getActivityCount(query?: ActivityQuery): Promise<number> {
    const result = this.filterActivities(query);
    return Promise.resolve(result.length);
  }
}

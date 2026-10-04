import { Activity, ContentManifest, ActivityQuery, EnglishCurriculumManifest, EnglishModuleManifest } from '../types';

export interface ContentRepository {
  /**
   * Retrieves the manifest for the content package, detailing versions and supported categories.
   */
  getManifest(): Promise<ContentManifest>;

  /**
   * Retrieves the curriculum manifest for English Class 3.
   */
  getEnglishCurriculumManifest(): Promise<EnglishCurriculumManifest>;

  /**
   * Retrieves the module manifest for a specific English module.
   * Returns null if moduleNumber is invalid.
   */
  getEnglishModuleManifest(moduleNumber: number): Promise<EnglishModuleManifest | null>;

  /**
   * Retrieves activities optionally matching a query.
   */
  getActivities(query?: ActivityQuery): Promise<Activity[]>;

  /**
   * Retrieves a single activity by its ID.
   * Returns null if not found.
   */
  getActivityById(id: string): Promise<Activity | null>;

  /**
   * Gets the total count of activities, optionally filtered by a query.
   */
  getActivityCount(query?: ActivityQuery): Promise<number>;
}

/**
 * Server-side activity catalog built from the per-module content manifests
 * (src/content/class-<n>/<subject>/module-<m>/activities.json).
 *
 * Attempt metadata (subject, module_id, grade) is looked up here by exact
 * activity_id. IDs are never parsed: English IDs look like ENG-M1-EW021 but
 * Tamil IDs like FTS0147 or Q129 carry no module information at all.
 */
import englishM1 from '../src/content/class-3/english/module-1/activities.json';
import englishM2 from '../src/content/class-3/english/module-2/activities.json';
import englishM3 from '../src/content/class-3/english/module-3/activities.json';
import englishM4 from '../src/content/class-3/english/module-4/activities.json';
import englishM5 from '../src/content/class-3/english/module-5/activities.json';
import englishM6 from '../src/content/class-3/english/module-6/activities.json';
import englishM7 from '../src/content/class-3/english/module-7/activities.json';
import englishM8 from '../src/content/class-3/english/module-8/activities.json';
import tamilM1 from '../src/content/class-3/tamil/module-1/activities.json';
import tamilM2 from '../src/content/class-3/tamil/module-2/activities.json';
import tamilM3 from '../src/content/class-3/tamil/module-3/activities.json';
import tamilM4 from '../src/content/class-3/tamil/module-4/activities.json';
import tamilM5 from '../src/content/class-3/tamil/module-5/activities.json';
import tamilM6 from '../src/content/class-3/tamil/module-6/activities.json';
import tamilM7 from '../src/content/class-3/tamil/module-7/activities.json';
import tamilM8 from '../src/content/class-3/tamil/module-8/activities.json';

export interface ActivityMetadata {
  subject: 'english' | 'tamil';
  moduleId: number;
  grade: number;
}

interface ManifestActivity {
  id: string;
  subject: string;
  module: number;
  classLevel: number;
}

const MANIFESTS: ManifestActivity[][] = [
  englishM1, englishM2, englishM3, englishM4, englishM5, englishM6, englishM7, englishM8,
  tamilM1, tamilM2, tamilM3, tamilM4, tamilM5, tamilM6, tamilM7, tamilM8,
] as ManifestActivity[][];

let catalog: Map<string, ActivityMetadata> | null = null;

function buildCatalog(): Map<string, ActivityMetadata> {
  const map = new Map<string, ActivityMetadata>();
  for (const manifest of MANIFESTS) {
    for (const a of manifest) {
      const subject = a.subject.toLowerCase();
      if (subject !== 'english' && subject !== 'tamil') {
        throw new Error(`Activity ${a.id}: unknown subject "${a.subject}" in content manifest`);
      }
      const meta: ActivityMetadata = { subject, moduleId: a.module, grade: a.classLevel };
      const existing = map.get(a.id);
      if (
        existing &&
        (existing.subject !== meta.subject || existing.moduleId !== meta.moduleId || existing.grade !== meta.grade)
      ) {
        throw new Error(`Activity ${a.id} appears in two content manifests with different metadata`);
      }
      map.set(a.id, meta);
    }
  }
  return map;
}

/** Returns manifest metadata for an activity id, or null if no manifest contains it. */
export function lookupActivityMetadata(activityId: string): ActivityMetadata | null {
  if (!catalog) catalog = buildCatalog();
  return catalog.get(activityId) ?? null;
}

/** All catalogued activities, for generating the SQL backfill. */
export function allActivityMetadata(): Array<[string, ActivityMetadata]> {
  if (!catalog) catalog = buildCatalog();
  return Array.from(catalog.entries()).sort(([a], [b]) => a.localeCompare(b));
}

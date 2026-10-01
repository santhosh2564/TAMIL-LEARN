/**
 * Phase 12A — Asset Requirement Extraction
 * 
 * Reads all 144 activities, finds picture-recognition activities,
 * and produces a structured asset requirement manifest.
 * 
 * Run: tsx scripts/extract-asset-requirements.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { Activity } from '../src/types';

const ACTIVITIES_FILE = path.resolve('src/content/class-3/tamil/term-1/activities.json');
const OUTPUT_FILE = path.resolve('docs/asset-requirements.json');

interface AssetRequirement {
  activityId: string;
  assetId: string;
  targetWord: string;
  prompt: string;
  conceptSummary: string;
  distractors: string[];
  suggestedAlt: string;
  suggestedFilename: string;
  status: 'missing' | 'pending' | 'approved' | 'resolved';
  source?: string;
  notes?: string;
}

/** 
 * Derive a human-readable concept from the prompt and targetWord.
 * This is a best-effort derivation from existing data — no content modification.
 */
function deriveConceptSummary(activity: Activity): string {
  const word = activity.targetWord ?? '';
  const prompt = activity.prompt ?? '';
  
  // Use interactionDetail/learningObjective if more specific
  if (prompt.includes('விலங்கு') || prompt.includes('விலங்கின்')) {
    return `Animal: ${word}`;
  }
  if (prompt.includes('தாவரத்தின்') || prompt.includes('செடி')) {
    return `Plant/Flora: ${word}`;
  }
  if (prompt.includes('உறவினர')) {
    return `Family member: ${word}`;
  }
  if (prompt.includes('இடத்தின்') || prompt.includes('இடம்')) {
    return `Place/Location: ${word}`;
  }
  if (prompt.includes('பொருளின்')) {
    return `Object/Thing: ${word}`;
  }
  if (prompt.includes('விளையாட்டு')) {
    return `Toy/Game: ${word}`;
  }
  if (prompt.includes('அரசர')) {
    return `Person/Role: ${word}`;
  }
  if (prompt.includes('விவசாய')) {
    return `Agricultural concept: ${word}`;
  }
  if (prompt.includes('உயிரினத்தை')) {
    return `Living creature (general): ${word}`;
  }
  
  return `Concept: ${word}`;
}

function run() {
  const raw = fs.readFileSync(ACTIVITIES_FILE, 'utf8');
  const activities: Activity[] = JSON.parse(raw);
  
  const pictureActivities = activities.filter(a => a.category === 'picture-recognition');
  
  console.log(`\nPhase 12A — Asset Requirement Extraction`);
  console.log(`=========================================`);
  console.log(`Total activities: ${activities.length}`);
  console.log(`Picture Recognition activities: ${pictureActivities.length}`);
  console.log('');

  const requirements: AssetRequirement[] = pictureActivities.map(activity => {
    const word = activity.targetWord ?? '';
    const assetId = `class3-tamil-picture-${activity.id.toLowerCase()}`;
    const suggestedFilename = `${assetId}.webp`;
    
    const distractors = (activity.options ?? [])
      .map(o => o.label)
      .filter(l => l !== activity.correctAnswer);

    const manifestFile = path.resolve('src/content/class-3/tamil/term-1/assets.json');
    let status: 'missing' | 'pending' | 'approved' | 'resolved' = 'missing';
    let resolvedSource: string | undefined = undefined;
    if (fs.existsSync(manifestFile)) {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      if (manifest[assetId]) {
        status = 'resolved';
        resolvedSource = manifest[assetId].path;
      }
    }

    return {
      activityId: activity.id,
      assetId,
      targetWord: word,
      prompt: activity.prompt,
      conceptSummary: deriveConceptSummary(activity),
      distractors,
      suggestedAlt: word, // Tamil word as alt text — can be enhanced by content author
      suggestedFilename: `public/assets/class-3/tamil/term-1/images/${suggestedFilename}`,
      status,
      source: resolvedSource,
      notes: activity.learningObjective ?? undefined,
    };
  });

  // Write requirement manifest
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(requirements, null, 2), 'utf8');
  
  console.log(`Asset Requirement Manifest`);
  console.log(`--------------------------`);
  requirements.forEach(r => {
    console.log(`  ${r.activityId} | ${r.targetWord.padEnd(12)} | ${r.conceptSummary}`);
  });

  console.log('');
  console.log(`Output written to: ${OUTPUT_FILE}`);
  console.log('');
  console.log(`Next steps:`);
  console.log(`  1. Review docs/asset-requirements.json`);
  console.log(`  2. Source or create appropriate educational images`);
  console.log(`  3. Place images in public/assets/class-3/tamil/term-1/images/`);
  console.log(`  4. Update src/content/class-3/tamil/term-1/assets.json with resolved entries`);
  console.log(`  5. Run: npm run content:assets-check`);
}

run();

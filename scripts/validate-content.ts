import * as fs from 'fs';
import * as path from 'path';
import { Activity, ContentValidationResult } from '../src/types';

const DATA_FILE = path.resolve('src/content/class-3/tamil/term-1/activities.json');

function validate() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('Data file not found. Run import first.');
    process.exit(1);
  }

  const activities: Activity[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  
  const result: ContentValidationResult = {
    valid: true,
    totalActivities: activities.length,
    errors: [],
    warnings: []
  };

  const idSet = new Set<string>();

  activities.forEach((act, index) => {
    const pushError = (msg: string) => {
      result.errors.push({ activityId: act.id || `Row ${index}`, type: 'error', message: msg });
      result.valid = false;
    };
    const pushWarning = (msg: string) => {
      result.warnings.push({ activityId: act.id || `Row ${index}`, type: 'warning', message: msg });
    };

    if (!act.id) {
      pushError('Missing ID');
    } else {
      if (idSet.has(act.id)) {
        pushError('Duplicate ID found');
      }
      idSet.add(act.id);
    }

    if (!act.prompt) pushError('Missing prompt');
    
    if (act.category === 'picture-recognition' || act.category === 'context-choice') {
      if (!act.options || act.options.length < 2) {
        pushError('Missing or insufficient options for choice activity');
      }
    }
    
    if (act.variant === 'arrange' || act.variant === 'missing-unit') {
      if (!act.units || act.units.length === 0) {
        pushError('Missing units for arrange/completion activity');
      }
    }

    if (!act.correctAnswer) {
      pushError('Missing correct answer');
    }

    if (!act.source || !act.source.questionId) {
      pushError('Missing source tracking');
    }
    
    if (!act.learningObjective) {
      pushWarning('Missing learning objective');
    }
  });

  console.log(`Validation completed. Valid: ${result.valid}`);
  console.log(`Total checked: ${result.totalActivities}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  
  if (result.errors.length > 0) {
    console.error('\nERRORS:');
    result.errors.forEach(e => console.error(`[${e.activityId}] ${e.message}`));
  }
  
  if (result.warnings.length > 0) {
    console.warn('\nWARNINGS:');
    result.warnings.forEach(w => console.warn(`[${w.activityId}] ${w.message}`));
  }

  if (!result.valid) {
    process.exit(1);
  }
}

validate();

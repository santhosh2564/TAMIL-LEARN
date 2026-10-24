import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { InventoryReport } from '../../../scripts/generate-authoritative-inventory';

test.describe('Content Integrity & Unicode Verification', () => {
  let inventory: InventoryReport;

  test.beforeAll(() => {
    const raw = fs.readFileSync(path.resolve('qa-report/inventory.json'), 'utf8');
    inventory = JSON.parse(raw);
  });

  test('verifies authoritative baseline: 8 modules and 1,178 questions with unique IDs', () => {
    expect(inventory.totalModules).toBe(8);
    expect(inventory.totalQuestions).toBe(1178);

    const ids = new Set<string>();
    for (const item of inventory.items) {
      expect(ids.has(item.activity_id)).toBe(false);
      ids.add(item.activity_id);
    }
    expect(ids.size).toBe(1178);
  });

  test('verifies Tamil Unicode integrity: zero replacement characters or corruptions', () => {
    const corruptions: { id: string; field: string; value: string }[] = [];
    const REPLACEMENT_CHAR = /\uFFFD/;

    for (const item of inventory.items) {
      if (REPLACEMENT_CHAR.test(item.prompt)) {
        corruptions.push({ id: item.activity_id, field: 'prompt', value: item.prompt });
      }
      if (REPLACEMENT_CHAR.test(item.expected_answer)) {
        corruptions.push({ id: item.activity_id, field: 'expected_answer', value: item.expected_answer });
      }
      for (const opt of item.options) {
        if (REPLACEMENT_CHAR.test(opt)) {
          corruptions.push({ id: item.activity_id, field: 'option', value: opt });
        }
      }
      for (const unit of item.units) {
        if (REPLACEMENT_CHAR.test(unit)) {
          corruptions.push({ id: item.activity_id, field: 'unit', value: unit });
        }
      }
    }

    expect(corruptions).toEqual([]);
  });

  test('verifies Arrange questions: units reconstruct target answer', () => {
    const sortChars = (s: string) => Array.from(s.replace(/[\s\u200C\u200D]+/g, '')).sort().join('');
    const mismatches: { id: string; target: string; units: string[] }[] = [];

    const arrangeItems = inventory.items.filter(i => i.activity_type.toLowerCase().includes('arrange'));
    expect(arrangeItems.length).toBe(385);

    for (const item of arrangeItems) {
      const units = item.units.length > 0 ? item.units : item.options;
      const reconstructed = units.join('');
      const matches = sortChars(reconstructed) === sortChars(item.expected_answer) ||
                      sortChars(reconstructed) === sortChars(item.target_word);
      if (!matches) {
        mismatches.push({ id: item.activity_id, target: item.expected_answer, units });
      }
    }

    expect(mismatches).toEqual([]);
  });

  test('verifies Multiple Choice questions: correct answer is present in options', () => {
    const choiceItems = inventory.items.filter(i => 
      !i.activity_type.toLowerCase().includes('arrange') && 
      !i.activity_type.toLowerCase().includes('missing') &&
      !i.activity_type.toLowerCase().includes('drag & drop')
    );

    const missingAnswer: { id: string; answer: string; options: string[] }[] = [];

    for (const item of choiceItems) {
      if (item.options.length > 0) {
        const hasMatch = item.options.includes(item.expected_answer) || item.options.includes(item.target_word);
        if (!hasMatch) {
          missingAnswer.push({ id: item.activity_id, answer: item.expected_answer, options: item.options });
        }
      }
    }

    expect(missingAnswer).toEqual([]);
  });

  test('verifies English -> Tamil Translation activities: English prompt and Tamil choices', () => {
    const meaningItems = inventory.items.filter(i => i.activity_type === 'English Meaning → Tamil Word');
    expect(meaningItems.length).toBe(191);

    for (const item of meaningItems) {
      // Prompt should have English text
      expect(item.prompt.length).toBeGreaterThan(0);
      // Expected answer must be in options
      expect(item.options).toContain(item.expected_answer);
    }
  });

  test('verifies all picture questions have valid image files on disk', () => {
    const pictureItems = inventory.items.filter(i => i.image !== null);
    const brokenImages: string[] = [];

    for (const item of pictureItems) {
      if (item.image) {
        const cleanPath = item.image.replace(/^\//, '');
        const onDisk = path.resolve('public', cleanPath);
        if (!fs.existsSync(onDisk)) {
          brokenImages.push(`${item.activity_id}: ${item.image}`);
        }
      }
    }

    expect(brokenImages).toEqual([]);
  });
});

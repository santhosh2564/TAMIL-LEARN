import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';

import { activityRegistry } from '../../../engine';
import { registerCoreActivities } from '../registerActivities';
import { Activity } from '../../../types';
import { ActivityRuntimeState } from '../../../engine/types';
import { AssetResolver } from '../../../engine/assets';

const ENG_DIR = path.resolve('src/content/class-3/english');

const mockRuntimeState: ActivityRuntimeState = {
  activityId: 'test-act',
  status: 'idle',
  attempts: 0
};

const getAnswerString = (ans: string | string[] | undefined): string => {
  if (Array.isArray(ans)) return ans[0] || '';
  return ans || '';
};

describe('Phase D: English Visual Assets & Activity Content QA', () => {
  beforeEach(() => {
    registerCoreActivities();
  });

  const allActivities: Activity[] = [];
  for (let m = 1; m <= 8; m++) {
    const actFile = path.join(ENG_DIR, `module-${m}`, 'activities.json');
    if (fs.existsSync(actFile)) {
      allActivities.push(...JSON.parse(fs.readFileSync(actFile, 'utf-8')));
    }
  }

  // --- SECTION 1: ALL 9 ACTIVITY CODES COVERAGE ---
  const activityCodes = ['E01', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E11', 'E12'];

  it('verifies all 9 activity codes exist and resolve in ActivityRegistry', () => {
    for (const code of activityCodes) {
      const match = allActivities.find(a => a.source?.activityCode === code);
      expect(match, `Activity with code ${code} should exist`).toBeDefined();
      if (match) {
        const def = activityRegistry.getDefinition(match.category, match.variant);
        expect(def, `Registry definition for ${match.category}::${match.variant} must exist`).toBeDefined();
        expect(def?.component).toBeDefined();
        expect(def?.evaluator).toBeDefined();
      }
    }
  });

  it('verifies evaluation semantics across all 9 activity codes: correct answer vs wrong answer', () => {
    for (const code of activityCodes) {
      const act = allActivities.find(a => a.source?.activityCode === code && a.role === 'new')!;
      expect(act).toBeDefined();
      const def = activityRegistry.getDefinition(act.category, act.variant)!;
      const evaluator = def.evaluator;
      const answerStr = getAnswerString(act.correctAnswer);

      if (act.variant === 'select') {
        // Option selection
        const correctOpt = act.options?.find(o => o.label.toLowerCase() === answerStr.toLowerCase());
        expect(correctOpt, `Activity ${act.id} (${code}) should have a valid correct option`).toBeDefined();
        if (correctOpt) {
          const correctResult = evaluator.evaluate(act, correctOpt.id, mockRuntimeState);
          expect(correctResult.correct).toBe(true);
          expect(correctResult.completed).toBe(true);

          const wrongOpt = act.options?.find(o => o.id !== correctOpt.id);
          if (wrongOpt) {
            const wrongResult = evaluator.evaluate(act, wrongOpt.id, mockRuntimeState);
            expect(wrongResult.correct).toBe(false);
            expect(wrongResult.completed).toBe(false);
          }
        }
      } else if (act.variant === 'word-entry') {
        // Word entry (E01, E09, E12)
        const correctResult = evaluator.evaluate(act, answerStr, mockRuntimeState);
        expect(correctResult.correct).toBe(true);
        expect(correctResult.completed).toBe(true);

        const wrongResult = evaluator.evaluate(act, 'wrongwordxyz', mockRuntimeState);
        expect(wrongResult.correct).toBe(false);
        expect(wrongResult.completed).toBe(false);

        const emptyResult = evaluator.evaluate(act, '   ', mockRuntimeState);
        expect(emptyResult.correct).toBe(false);
        expect(emptyResult.completed).toBe(false);
      } else if (act.variant === 'missing-unit') {
        // E05 / E11 missing letter
        const cleanedTemplate = (act.template || '').replace(/[|\s]/g, '');
        const cleanedTarget = (act.targetWord || answerStr).replace(/\s+/g, '');
        let missingLetter = '';
        for (let i = 0; i < cleanedTemplate.length && i < cleanedTarget.length; i++) {
          if (cleanedTemplate[i] === '_') {
            missingLetter += cleanedTarget[i];
          }
        }
        if (!missingLetter) missingLetter = answerStr;

        const correctResult = evaluator.evaluate(act, missingLetter, mockRuntimeState);
        expect(correctResult.correct).toBe(true);
        expect(correctResult.completed).toBe(true);

        const wrongResult = evaluator.evaluate(act, 'z', mockRuntimeState);
        expect(wrongResult.correct).toBe(false);
        expect(wrongResult.completed).toBe(false);
      } else if (act.variant === 'arrange') {
        // E04, E06, E07 arrangement
        const options = act.options || [];
        const correctOrderIds: string[] = [];
        let accumulated = '';
        const target = answerStr.toLowerCase();

        // Greedy matching of units to build the correct sequence
        const remaining = [...options];
        while (remaining.length > 0 && accumulated.length < target.length) {
          const nextIdx = remaining.findIndex(opt => target.startsWith(accumulated + opt.label.toLowerCase()));
          if (nextIdx !== -1) {
            accumulated += remaining[nextIdx].label.toLowerCase();
            correctOrderIds.push(remaining[nextIdx].id);
            remaining.splice(nextIdx, 1);
          } else {
            break;
          }
        }

        if (correctOrderIds.length === options.length && accumulated === target) {
          const correctResult = evaluator.evaluate(act, correctOrderIds, mockRuntimeState);
          expect(correctResult.correct).toBe(true);
          expect(correctResult.completed).toBe(true);

          if (options.length > 1) {
            const reversedIds = [...correctOrderIds].reverse();
            const wrongResult = evaluator.evaluate(act, reversedIds, mockRuntimeState);
            expect(wrongResult.correct).toBe(false);
            expect(wrongResult.completed).toBe(false);
          }
        }
      }
    }
  });

  // --- SECTION 2: STRICT E05 / E11 MISSING-LETTER CONTRACT ---
  it('verifies strict missing-letter contract for E05 / E11 activities', () => {
    const e05Sample = allActivities.find(a => a.source?.activityCode === 'E05' && a.template?.includes('_'))!;
    expect(e05Sample).toBeDefined();

    const def = activityRegistry.getDefinition(e05Sample.category, e05Sample.variant)!;
    const evaluator = def.evaluator;

    const cleanedTemplate = (e05Sample.template || '').replace(/[|\s]/g, '');
    const cleanedTarget = (e05Sample.targetWord || '').replace(/\s+/g, '');
    let missingLetter = '';
    for (let i = 0; i < cleanedTemplate.length && i < cleanedTarget.length; i++) {
      if (cleanedTemplate[i] === '_') missingLetter += cleanedTarget[i];
    }
    expect(missingLetter.length).toBeGreaterThan(0);

    // 1. Correct lower-case
    expect(evaluator.evaluate(e05Sample, missingLetter.toLowerCase(), mockRuntimeState).completed).toBe(true);
    // 2. Correct upper-case
    expect(evaluator.evaluate(e05Sample, missingLetter.toUpperCase(), mockRuntimeState).completed).toBe(true);
    // 3. Entire target word must be REJECTED
    expect(evaluator.evaluate(e05Sample, e05Sample.targetWord, mockRuntimeState).completed).toBe(false);
    // 4. Trimmed entire word must be REJECTED
    expect(evaluator.evaluate(e05Sample, ` ${e05Sample.targetWord} `, mockRuntimeState).completed).toBe(false);
    // 5. Empty input rejected
    expect(evaluator.evaluate(e05Sample, '', mockRuntimeState).completed).toBe(false);
    expect(evaluator.evaluate(e05Sample, '   ', mockRuntimeState).completed).toBe(false);
  });

  // --- SECTION 3: STRICT E01 / E12 WORD-ENTRY CONTRACT ---
  it('verifies strict word-entry contract: exact match, case-insensitivity, whitespace trim, no fuzzy matching', () => {
    const e01Sample = allActivities.find(a => a.source?.activityCode === 'E01')!;
    expect(e01Sample).toBeDefined();

    const def = activityRegistry.getDefinition(e01Sample.category, e01Sample.variant)!;
    const evaluator = def.evaluator;
    const target = getAnswerString(e01Sample.correctAnswer);

    // 1. Exact match
    expect(evaluator.evaluate(e01Sample, target, mockRuntimeState).completed).toBe(true);
    // 2. Case-insensitivity
    expect(evaluator.evaluate(e01Sample, target.toUpperCase(), mockRuntimeState).completed).toBe(true);
    // 3. Leading and trailing whitespace handling
    expect(evaluator.evaluate(e01Sample, `  ${target}  `, mockRuntimeState).completed).toBe(true);
    // 4. Empty input rejected
    expect(evaluator.evaluate(e01Sample, '', mockRuntimeState).completed).toBe(false);
    expect(evaluator.evaluate(e01Sample, '   ', mockRuntimeState).completed).toBe(false);
    // 5. Partial answer rejected (no fuzzy matching)
    expect(evaluator.evaluate(e01Sample, target.slice(0, -1), mockRuntimeState).completed).toBe(false);
    // 6. Incorrect answer rejected
    expect(evaluator.evaluate(e01Sample, target + 's', mockRuntimeState).completed).toBe(false);
  });

  // --- SECTION 4: ARRANGE ACTIVITY CONTRACT (E04, E06, E07) ---
  it('verifies arrange units are joined exactly and multi-character units remain intact', () => {
    // E07 compound parts: e.g. grasshopper or eyelash
    const e07Sample = allActivities.find(a => a.source?.activityCode === 'E07')!;
    expect(e07Sample).toBeDefined();
    expect(e07Sample.options).toBeDefined();
    expect(e07Sample.options!.length).toBeGreaterThanOrEqual(2);

    // Multi-character check: at least one token must have length > 1
    const hasMultiChar = e07Sample.options!.some(o => o.label.length > 1);
    expect(hasMultiChar).toBe(true);

    const def = activityRegistry.getDefinition(e07Sample.category, e07Sample.variant)!;
    const evaluator = def.evaluator;
    const answerStr = getAnswerString(e07Sample.correctAnswer);

    // Correct combination
    const orderIds = e07Sample.options!.map(o => o.id);
    const formed = orderIds.map(id => e07Sample.options!.find(o => o.id === id)!.label).join('');
    if (formed.toLowerCase() === answerStr.toLowerCase()) {
      expect(evaluator.evaluate(e07Sample, orderIds, mockRuntimeState).completed).toBe(true);
    }
  });

  // --- SECTION 5: VISUAL ASSET RENDERING & FALLBACK QA ---
  it('verifies AssetResolver resolves reused Tamil assets and reports missing for unacquired assets', () => {
    const resolver = new AssetResolver();

    // 1. Reused Tamil assets must resolve
    const reusedKeys = [
      'eng-fruit',
      'eng-bag',
      'eng-box',
      'eng-dog',
      'eng-rabbit',
      'eng-rat',
      'eng-shop',
      'eng-colour'
    ];

    for (const key of reusedKeys) {
      const res = resolver.resolve({ id: key, type: 'image' });
      expect(res.status, `Asset ${key} should resolve`).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.asset.path).toMatch(/^\/assets\/class-3\/tamil\/term-1\/images\//);
        const diskPath = path.resolve('public', res.asset.path.replace(/^\//, ''));
        expect(fs.existsSync(diskPath), `Physical file ${diskPath} must exist`).toBe(true);
      }
    }

    // 2. Unacquired English asset must return status: 'missing'
    const missingRes = resolver.resolve({ id: 'eng-nonexistent-asset', type: 'image' });
    expect(missingRes.status).toBe('missing');
  });

  it('renders ActivityAsset with real image for reused asset and fallback UI for missing asset', () => {
    // 1. Reused asset (dog)
    const dogAct = allActivities.find(a => a.targetWord?.toLowerCase() === 'dog' && a.category === 'picture-recognition')!;
    expect(dogAct).toBeDefined();

    const def = activityRegistry.getDefinition(dogAct.category, dogAct.variant)!;
    const Component = def.component;

    const { container: dogContainer } = render(
      <Component 
        activity={dogAct} 
        state={{ activityId: dogAct.id, status: 'idle', attempts: 0 }} 
        onSubmit={() => {}} 
        onNext={() => {}} 
      />
    );

    const img = dogContainer.querySelector('img[data-testid="activity-asset-image"]');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/assets/class-3/tamil/term-1/images/Q005_Naai.jpg');

    // 2. Missing asset (bird) -> must render graceful fallback
    const birdAct = { ...allActivities.find(a => a.targetWord?.toLowerCase() === 'bird' && a.category === 'picture-recognition')!, targetWord: 'nonexistentbird' };
    expect(birdAct).toBeDefined();

    const birdDef = activityRegistry.getDefinition(birdAct.category, birdAct.variant)!;
    const BirdComponent = birdDef.component;

    const { container: birdContainer } = render(
      <BirdComponent 
        activity={birdAct} 
        state={{ activityId: birdAct.id, status: 'idle', attempts: 0 }} 
        onSubmit={() => {}} 
        onNext={() => {}} 
      />
    );

    const fallback = birdContainer.querySelector('[data-testid="asset-fallback-missing"]');
    expect(fallback).not.toBeNull();
    expect(birdContainer.textContent).toContain('Image Not Available');
  });

  it('does NOT render an image for text-only activities', () => {
    // 1. E09 Meaning Match
    const e09Act = allActivities.find(a => a.source?.activityCode === 'E09')!;
    expect(e09Act).toBeDefined();
    const e09Def = activityRegistry.getDefinition(e09Act.category, e09Act.variant)!;
    const { container: e09Container } = render(
      <e09Def.component 
        activity={e09Act} 
        state={{ activityId: e09Act.id, status: 'idle', attempts: 0 }} 
        onSubmit={() => {}} 
        onNext={() => {}} 
      />
    );
    expect(e09Container.querySelector('[data-testid="activity-asset-image"]')).toBeNull();
    expect(e09Container.querySelector('[data-testid="asset-fallback-missing"]')).toBeNull();

    // 2. E08 text-only spelling (ENG-M3-EW237)
    const drewAct = allActivities.find(a => a.id === 'ENG-M3-EW237')!;
    expect(drewAct).toBeDefined();
    const drewDef = activityRegistry.getDefinition(drewAct.category, drewAct.variant)!;
    const { container: drewContainer } = render(
      <drewDef.component 
        activity={drewAct} 
        state={{ activityId: drewAct.id, status: 'idle', attempts: 0 }} 
        onSubmit={() => {}} 
        onNext={() => {}} 
      />
    );
    expect(drewContainer.querySelector('[data-testid="activity-asset-image"]')).toBeNull();
    expect(drewContainer.querySelector('[data-testid="asset-fallback-missing"]')).toBeNull();
  });

  // --- SECTION 6: PRESERVED SOURCE ANOMALIES SAFE EXECUTION ---
  it('ensures all 9 documented source anomalies execute and render safely without throwing', () => {
    const anomalyIds = ['EW114', 'EW249', 'EW262', 'EW265', 'EW574', 'EW576', 'EW894', 'EW913', 'EW943'];
    for (const anomId of anomalyIds) {
      const act = allActivities.find(a => a.source?.ewId === anomId && a.role === 'new')!;
      expect(act, `Anomaly activity for ${anomId} must exist`).toBeDefined();
      expect(act.source?.hasSourceAnomaly).toBe(true);

      const def = activityRegistry.getDefinition(act.category, act.variant)!;
      expect(def).toBeDefined();

      // Rendering must succeed without error
      const { container } = render(
        <def.component 
          activity={act} 
          state={{ activityId: act.id, status: 'idle', attempts: 0 }} 
          onSubmit={() => {}} 
          onNext={() => {}} 
        />
      );
      expect(container.firstChild).not.toBeNull();
    }
  });

  // --- SECTION 7: INTERACTIVE RETRY AND NO-ANSWER-REVEAL FLOW ---
  it('verifies interactive wrong submission, retry enablement, and absence of answer reveal in WordEntryActivity', () => {
    const e01Act = allActivities.find(a => a.source?.activityCode === 'E01')!;
    const def = activityRegistry.getDefinition(e01Act.category, e01Act.variant)!;

    let submittedVal: unknown = null;
    const { container, rerender } = render(
      <def.component 
        activity={e01Act} 
        state={{ activityId: e01Act.id, status: 'idle', attempts: 0 }} 
        onSubmit={(val: unknown) => { submittedVal = val; }} 
        onNext={() => {}} 
      />
    );

    const input = container.querySelector('input')!;
    expect(input).toBeDefined();

    // Type wrong answer
    fireEvent.change(input, { target: { value: 'incorrectword' } });
    const checkBtn = screen.getByRole('button', { name: /Check Answer|சரிபார்க்கவும்/i });
    fireEvent.click(checkBtn);
    expect(submittedVal).toBe('incorrectword');

    // Simulate evaluator returning incorrect -> status becomes active with attempts: 1
    rerender(
      <def.component 
        activity={e01Act} 
        state={{ activityId: e01Act.id, status: 'active', attempts: 1 }} 
        onSubmit={(val: unknown) => { submittedVal = val; }} 
        onNext={() => {}} 
      />
    );

    // Verify retry button is shown
    const retryBtn = screen.getByRole('button', { name: /Try Again|மீண்டும் முயற்சி செய்/i });
    expect(retryBtn).toBeDefined();

    // Verify correct answer is NOT revealed in the DOM
    expect(container.textContent).not.toContain(`Correct: ${e01Act.correctAnswer}`);
    expect(container.textContent).not.toContain(`Answer: ${e01Act.correctAnswer}`);
  });
});

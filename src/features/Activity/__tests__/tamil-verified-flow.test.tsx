import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalContentRepository } from '../../../repositories/implementations/LocalContentRepository';
import { activityRegistry } from '../../../engine';
import { registerCoreActivities } from '../registerActivities';

describe('Tamil Verified Activities Interaction Test', () => {
  registerCoreActivities();
  const repo = new LocalContentRepository();

  it('interacts and evaluates Correct Spelling (FTS0064)', async () => {
    const act = (await repo.getActivityById('FTS0064'))!;
    expect(act).toBeDefined();
    expect(act.targetWord).toBe('அழைப்பு');

    const def = activityRegistry.getDefinition(act.category, act.variant)!;
    const Component = def.component;

    let submitted = false;
    let evalResult: unknown = null;

    const { unmount } = render(
      <Component
        activity={act}
        state={{ activityId: act.id, status: 'idle', attempts: 0 }}
        onSubmit={(ans) => {
          submitted = true;
          evalResult = def.evaluator.evaluate(act, ans, { activityId: act.id, status: 'active', attempts: 1 });
        }}
        onNext={() => {}}
      />
    );

    // Find and click correct answer option "அழைப்பு"
    const optionBtn = screen.getByText('அழைப்பு');
    fireEvent.click(optionBtn);

    // Find and click submit button
    const submitBtn = screen.getByRole('button', { name: /விடையைச் சரிபார்|சரிபார்க்க|Submit|Check/i });
    fireEvent.click(submitBtn);

    expect(submitted).toBe(true);
    expect((evalResult as { correct: boolean }).correct).toBe(true);
    unmount();
  });

  it('interacts and evaluates Context Select (FTS0052)', async () => {
    const act = (await repo.getActivityById('FTS0052'))!;
    expect(act).toBeDefined();
    expect(act.targetWord).toBe('அலை');

    const def = activityRegistry.getDefinition(act.category, act.variant)!;
    const Component = def.component;

    let submitted = false;
    let evalResult: unknown = null;

    const { unmount } = render(
      <Component
        activity={act}
        state={{ activityId: act.id, status: 'idle', attempts: 0 }}
        onSubmit={(ans) => {
          submitted = true;
          evalResult = def.evaluator.evaluate(act, ans, { activityId: act.id, status: 'active', attempts: 1 });
        }}
        onNext={() => {}}
      />
    );

    const optionBtn = screen.getByText('அலை');
    fireEvent.click(optionBtn);

    const submitBtn = screen.getByRole('button', { name: /விடையைச் சரிபார்|சரிபார்க்க|Submit|Check/i });
    fireEvent.click(submitBtn);

    expect(submitted).toBe(true);
    expect((evalResult as { correct: boolean }).correct).toBe(true);
    unmount();
  });

  it('interacts and evaluates Meaning Match (FTS0101)', async () => {
    const act = (await repo.getActivityById('FTS0101'))!;
    expect(act).toBeDefined();
    expect(act.targetWord).toBe('இன்பம்');

    const def = activityRegistry.getDefinition(act.category, act.variant)!;
    const Component = def.component;

    let submitted = false;
    let evalResult: unknown = null;

    const { unmount } = render(
      <Component
        activity={act}
        state={{ activityId: act.id, status: 'idle', attempts: 0 }}
        onSubmit={(ans) => {
          submitted = true;
          evalResult = def.evaluator.evaluate(act, ans, { activityId: act.id, status: 'active', attempts: 1 });
        }}
        onNext={() => {}}
      />
    );

    const optionBtn = screen.getByText('இன்பம்');
    fireEvent.click(optionBtn);

    const submitBtn = screen.getByRole('button', { name: /விடையைச் சரிபார்|சரிபார்க்க|Submit|Check/i });
    fireEvent.click(submitBtn);

    expect(submitted).toBe(true);
    expect((evalResult as { correct: boolean }).correct).toBe(true);
    unmount();
  });

  it('interacts and evaluates Picture Select (FTS0121)', async () => {
    const act = (await repo.getActivityById('FTS0121'))!;
    expect(act).toBeDefined();
    expect(act.targetWord).toBe('ஈக்கள்');

    const def = activityRegistry.getDefinition(act.category, act.variant)!;
    const Component = def.component;

    let submitted = false;
    let evalResult: unknown = null;

    const { unmount } = render(
      <Component
        activity={act}
        state={{ activityId: act.id, status: 'idle', attempts: 0 }}
        onSubmit={(ans) => {
          submitted = true;
          evalResult = def.evaluator.evaluate(act, ans, { activityId: act.id, status: 'active', attempts: 1 });
        }}
        onNext={() => {}}
      />
    );

    const optionBtn = screen.getByText('ஈக்கள்');
    fireEvent.click(optionBtn);

    const submitBtn = screen.getByRole('button', { name: /விடையைச் சரிபார்|சரிபார்க்க|Submit|Check/i });
    fireEvent.click(submitBtn);

    expect(submitted).toBe(true);
    expect((evalResult as { correct: boolean }).correct).toBe(true);
    unmount();
  });

  it('interacts and evaluates Arrange Units (FTS0169)', async () => {
    const act = (await repo.getActivityById('FTS0169'))!;
    expect(act).toBeDefined();
    expect(act.targetWord).toBe('ஊர்த்தலைவர்');

    const def = activityRegistry.getDefinition(act.category, act.variant)!;
    const Component = def.component;

    let submitted = false;
    let evalResult: unknown = null;

    const { unmount } = render(
      <Component
        activity={act}
        state={{ activityId: act.id, status: 'idle', attempts: 0 }}
        onSubmit={(ans) => {
          submitted = true;
          evalResult = def.evaluator.evaluate(act, ans, { activityId: act.id, status: 'active', attempts: 1 });
        }}
        onNext={() => {}}
      />
    );

    // In ArrangeWordActivity, clicking the available unit tokens selects them in order
    // Order: 'ஊர்த்' -> 'தலை' -> 'வர்'
    fireEvent.click(screen.getByText('ஊர்த்'));
    fireEvent.click(screen.getByText('தலை'));
    fireEvent.click(screen.getByText('வர்'));

    const submitBtn = screen.getByRole('button', { name: /விடையைச் சரிபார்|சரிபார்க்க|Submit|Check/i });
    fireEvent.click(submitBtn);

    expect(submitted).toBe(true);
    expect((evalResult as { correct: boolean }).correct).toBe(true);
    unmount();
  });
});

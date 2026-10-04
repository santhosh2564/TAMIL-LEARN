import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordEntryActivity } from '../WordEntryActivity';
import { ActivityRuntimeState } from '../../../../engine';
import { Activity } from '../../../../types';

describe('WordEntryActivity', () => {
  const mockActivity: Activity = {
    id: 'ENG-M1-EW017',
    classLevel: 3,
    subject: 'English',
    language: 'en-IN',
    module: 1,
    day: 1,
    level: 1,
    targetWord: 'apple',
    category: 'picture-recognition',
    variant: 'word-entry',
    prompt: 'Look at the picture. Write the word.',
    correctAnswer: 'apple',
    source: {
      workbook: 'English_Module_1_120_Word_Implementation_Plan.xlsx',
      ewId: 'EW017',
      activityCode: 'E01',
      originalActivity: 'E01 – Picture → Write'
    }
  };

  const mockActiveState: ActivityRuntimeState = {
    activityId: 'ENG-M1-EW017',
    status: 'active',
    attempts: 0
  };

  it('renders prompt, input field, and disabled check button when empty', () => {
    render(
      <WordEntryActivity
        activity={mockActivity}
        state={mockActiveState}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Look at the picture. Write the word.')).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: /Word answer input/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');

    const checkBtn = screen.getByRole('button', { name: /Check Answer/i });
    expect(checkBtn).toBeDisabled();
  });

  it('renders professional image fallback without crashing when image is missing', () => {
    const missingImageActivity = { ...mockActivity, targetWord: 'nonexistentword' };
    render(
      <WordEntryActivity
        activity={missingImageActivity}
        state={mockActiveState}
        onSubmit={vi.fn()}
      />
    );

    // ActivityAsset shows fallback placeholder when asset is not resolved
    expect(screen.getByText(/Image Not Available|படம் கிடைக்கவில்லை/i)).toBeInTheDocument();
  });

  it('enables check button on typing and submits trimmed input', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <WordEntryActivity
        activity={mockActivity}
        state={mockActiveState}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByRole('textbox', { name: /Word answer input/i });
    await user.type(input, '  apple  ');

    const checkBtn = screen.getByRole('button', { name: /Check Answer/i });
    expect(checkBtn).toBeEnabled();

    await user.click(checkBtn);
    expect(handleSubmit).toHaveBeenCalledWith('apple');
  });

  it('submits on Enter key press', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <WordEntryActivity
        activity={mockActivity}
        state={mockActiveState}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByRole('textbox', { name: /Word answer input/i });
    await user.type(input, 'apple{enter}');

    expect(handleSubmit).toHaveBeenCalledWith('apple');
  });

  it('handles retry flow on wrong answer without revealing the answer', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <WordEntryActivity
        activity={mockActivity}
        state={mockActiveState}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByRole('textbox', { name: /Word answer input/i });
    await user.type(input, 'orange');

    const checkBtn = screen.getByRole('button', { name: /Check Answer/i });
    await user.click(checkBtn);

    expect(handleSubmit).toHaveBeenCalledWith('orange');

    // Shows error feedback
    expect(screen.getByText('Not quite. Try again.')).toBeInTheDocument();

    // Does NOT reveal "apple"
    expect(screen.queryByText(/apple/i)).not.toBeInTheDocument();

    // Shows retry button
    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    expect(retryBtn).toBeInTheDocument();

    // Click retry
    await user.click(retryBtn);

    // Retry unlocks input, error disappears, allows modifying answer
    await user.clear(input);
    await user.type(input, 'apple');
    await user.click(screen.getByRole('button', { name: /Check Answer/i }));

    expect(handleSubmit).toHaveBeenCalledWith('apple');
  });

  it('renders completed state with Continue button', () => {
    const completedState: ActivityRuntimeState = {
      ...mockActiveState,
      status: 'completed'
    };
    const handleNext = vi.fn();

    render(
      <WordEntryActivity
        activity={mockActivity}
        state={completedState}
        onSubmit={vi.fn()}
        onNext={handleNext}
      />
    );

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).toBeInTheDocument();
    continueBtn.click();
    expect(handleNext).toHaveBeenCalled();
  });

  it('Phase I: does not render visible "Picture of ..." text while preserving alt attribute on image', () => {
    const fruitActivity: Activity = {
      ...mockActivity,
      targetWord: 'fruit',
      prompt: 'Look at the picture. Write the word.',
      template: 'Picture of fruit',
      image: { source: 'eng-fruit', type: 'image' }
    };

    render(
      <WordEntryActivity
        activity={fruitActivity}
        state={mockActiveState}
        onSubmit={vi.fn()}
      />
    );

    // 1. Instruction prompt is visible
    expect(screen.getByText('Look at the picture. Write the word.')).toBeInTheDocument();

    // 2. Visible "Picture of fruit" text is NOT rendered
    expect(screen.queryByText('Picture of fruit')).not.toBeInTheDocument();

    // 3. Image element is rendered with accessible alt text
    const img = screen.getByTestId('activity-asset-image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Picture of fruit');
  });

  it('Phase I: works generically across different target words (dog, bag)', () => {
    const dogActivity: Activity = {
      ...mockActivity,
      targetWord: 'dog',
      prompt: 'Look at the picture. Write the word.',
      template: 'Picture of a dog.',
      image: { source: 'eng-dog', type: 'image' }
    };

    render(
      <WordEntryActivity
        activity={dogActivity}
        state={mockActiveState}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByText('Picture of a dog.')).not.toBeInTheDocument();
    const img = screen.getByTestId('activity-asset-image');
    expect(img).toHaveAttribute('alt', 'Picture of a dog.');
  });

  it('Phase I: non-picture letter templates still render visible template hint', () => {
    const nonPictureActivity: Activity = {
      ...mockActivity,
      category: 'word-completion',
      prompt: 'Complete the word:',
      template: 'o _ l',
      targetWord: 'oil',
      image: undefined
    };

    render(
      <WordEntryActivity
        activity={nonPictureActivity}
        state={mockActiveState}
        onSubmit={vi.fn()}
      />
    );

    // Non-picture letter template "o _ l" IS rendered as visible text
    expect(screen.getByText('o _ l')).toBeInTheDocument();
  });
});

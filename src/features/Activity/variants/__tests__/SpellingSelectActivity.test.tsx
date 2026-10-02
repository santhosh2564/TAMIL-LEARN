import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpellingSelectActivity } from '../SpellingSelectActivity';
import { ActivityRuntimeState } from '../../../../engine';
import { Activity } from '../../../../types';

describe('SpellingSelectActivity', () => {
  const mockActivity = {
    id: 'Q006',
    category: 'spelling-choice',
    variant: 'select',
    prompt: 'Choose correct spelling',
    correctAnswer: 'மான்',
    options: [
      { id: 'A', label: 'மான்' },
      { id: 'B', label: 'மாண்' }
    ]
  } as Activity;

  const mockState: ActivityRuntimeState = {
    activityId: 'Q006',
    status: 'active',
    attempts: 0,
    startedAt: 1000
  };

  it('renders prompt and spelling options', () => {
    render(<SpellingSelectActivity activity={mockActivity} state={mockState} onSubmit={vi.fn()} />);
    
    expect(screen.getByText('Choose correct spelling')).toBeInTheDocument();
    expect(screen.getByText('மான்')).toBeInTheDocument();
    expect(screen.getByText('மாண்')).toBeInTheDocument();
  });

  it('selects option and calls onSubmit', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    
    render(<SpellingSelectActivity activity={mockActivity} state={mockState} onSubmit={handleSubmit} />);
    
    await user.click(screen.getByText('மாண்'));
    await user.click(screen.getByText('விடையைச் சரிபார்'));
    
    expect(handleSubmit).toHaveBeenCalledWith('B');
  });

  it('wrong answer shows retry (not continue); retry restores the same activity; correct submits again', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    const handleNext = vi.fn();

    render(<SpellingSelectActivity activity={mockActivity} state={mockState} onSubmit={handleSubmit} onNext={handleNext} />);

    // --- Wrong submission ---
    await user.click(screen.getByRole('button', { name: 'மாண்' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith('B');
    expect(screen.getByText('தவறான விடை')).toBeInTheDocument();

    // ── Separate-button contract ─────────────────────────────────────────
    // விடையைச் சரிபார் must remain visible in the DOM as its own control;
    // it must NOT have been relabeled as மீண்டும் முயற்சி செய்.
    const checkBtn = screen.getByRole('button', { name: 'விடையைச் சரிபார்' });
    expect(checkBtn).toBeInTheDocument();
    expect(checkBtn).toBeDisabled();
    // The retry button is a separate, additional element.
    expect(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).toBeInTheDocument();
    // ────────────────────────────────────────────────────────────────────

    expect(screen.queryByText('தொடர்க')).not.toBeInTheDocument();
    expect(handleNext).not.toHaveBeenCalled();

    // --- Retry: same activity, interactive again ---
    await user.click(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }));
    expect(screen.getByText('Choose correct spelling')).toBeInTheDocument();
    expect(screen.queryByText('தவறான விடை')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'மான்' })).toBeEnabled();

    // --- Correct submission after retry ---
    await user.click(screen.getByRole('button', { name: 'மான்' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(handleSubmit).toHaveBeenCalledTimes(2);
    expect(handleSubmit).toHaveBeenCalledWith('A');
    expect(screen.getByText('சரியான விடை!')).toBeInTheDocument();
    expect(handleNext).not.toHaveBeenCalled();
  });
});

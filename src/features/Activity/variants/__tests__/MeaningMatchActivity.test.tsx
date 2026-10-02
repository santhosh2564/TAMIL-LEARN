import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeaningMatchActivity } from '../MeaningMatchActivity';
import { ActivityRuntimeState } from '../../../../engine';
import { Activity } from '../../../../types';

describe('MeaningMatchActivity', () => {
  const mockActivity = {
    id: 'Q031',
    category: 'meaning-match',
    variant: 'translate-select',
    prompt: '“Unity” என்பதைக் குறிக்கும் சரியான தமிழ்ச் சொல்லைத் தேர்ந்தெடுக்கவும்.',
    correctAnswer: 'ஒற்றுமை',
    options: [
      { id: 'A', label: 'ஒற்றுமை' },
      { id: 'B', label: 'ஒற்றுமி' }
    ]
  } as Activity;

  const mockState: ActivityRuntimeState = {
    activityId: 'Q031',
    status: 'active',
    attempts: 0,
    startedAt: 1000
  };

  it('renders prompt and options', () => {
    render(<MeaningMatchActivity activity={mockActivity} state={mockState} onSubmit={vi.fn()} />);
    
    expect(screen.getByText('“Unity” என்பதைக் குறிக்கும் சரியான தமிழ்ச் சொல்லைத் தேர்ந்தெடுக்கவும்.')).toBeInTheDocument();
    expect(screen.getByText('ஒற்றுமை')).toBeInTheDocument();
  });

  it('selects option and calls onSubmit', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    
    render(<MeaningMatchActivity activity={mockActivity} state={mockState} onSubmit={handleSubmit} />);
    
    await user.click(screen.getByText('ஒற்றுமை'));
    await user.click(screen.getByText('விடையைச் சரிபார்'));
    
    expect(handleSubmit).toHaveBeenCalledWith('A');
  });

  it('wrong answer shows retry (not continue); retry restores the same activity; correct submits again', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    const handleNext = vi.fn();

    render(<MeaningMatchActivity activity={mockActivity} state={mockState} onSubmit={handleSubmit} onNext={handleNext} />);

    // --- Wrong submission ---
    await user.click(screen.getByRole('button', { name: 'ஒற்றுமி' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith('B');
    expect(screen.getByText('தவறான விடை')).toBeInTheDocument();

    // ── Separate-button contract ─────────────────────────────────────────
    const checkBtn = screen.getByRole('button', { name: 'விடையைச் சரிபார்' });
    expect(checkBtn).toBeInTheDocument();
    expect(checkBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).toBeInTheDocument();
    // ────────────────────────────────────────────────────────────────────

    expect(screen.queryByText('தொடர்க')).not.toBeInTheDocument();
    expect(handleNext).not.toHaveBeenCalled();

    // --- Retry: same activity, interactive again ---
    await user.click(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }));
    expect(screen.queryByText('தவறான விடை')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ஒற்றுமை' })).toBeEnabled();

    // --- Correct submission after retry ---
    await user.click(screen.getByRole('button', { name: 'ஒற்றுமை' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(handleSubmit).toHaveBeenCalledTimes(2);
    expect(handleSubmit).toHaveBeenCalledWith('A');
    expect(screen.getByText('சரியான விடை!')).toBeInTheDocument();
    expect(handleNext).not.toHaveBeenCalled();
  });
});

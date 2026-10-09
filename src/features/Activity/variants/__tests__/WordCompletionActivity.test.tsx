import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordCompletionActivity } from '../WordCompletionActivity';
import { ActivityRuntimeState } from '../../../../engine';
import { Activity } from '../../../../types';

describe('WordCompletionActivity', () => {
  const mockActivity = {
    id: 'Q002',
    category: 'word-completion',
    variant: 'missing-unit',
    prompt: 'கு + [blank]',
    correctAnswer: 'தி',
    options: [
      { id: 'A', label: 'தி' },
      { id: 'B', label: 'தீ' }
    ]
  } as Activity;

  const mockState: ActivityRuntimeState = {
    activityId: 'Q002',
    status: 'active',
    attempts: 0,
    startedAt: 1000
  };

  it('renders prompt and options', () => {
    render(<WordCompletionActivity activity={mockActivity} state={mockState} onSubmit={vi.fn()} />);
    
    expect(screen.getByText('கு +')).toBeInTheDocument(); // Because [blank] splits the text
    expect(screen.getByLabelText('blank')).toBeInTheDocument();
    expect(screen.getByText('தி')).toBeInTheDocument();
    expect(screen.getByText('தீ')).toBeInTheDocument();
  });

  it('selects option and calls onSubmit', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    
    render(<WordCompletionActivity activity={mockActivity} state={mockState} onSubmit={handleSubmit} />);
    
    await user.click(screen.getByText('தி'));
    await user.click(screen.getByText('விடையைச் சரிபார்'));
    
    expect(handleSubmit).toHaveBeenCalledWith('A');
  });

  it('wrong answer shows retry (not continue); retry restores the same activity; correct submits again', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    const handleNext = vi.fn();

    render(<WordCompletionActivity activity={mockActivity} state={mockState} onSubmit={handleSubmit} onNext={handleNext} />);

    // --- Wrong submission ---
    await user.click(screen.getByRole('button', { name: 'தீ' }));
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
    expect(screen.getByRole('button', { name: 'தி' })).toBeEnabled();

    // --- Correct submission after retry ---
    await user.click(screen.getByRole('button', { name: 'தி' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(handleSubmit).toHaveBeenCalledTimes(2);
    expect(handleSubmit).toHaveBeenCalledWith('A');
    expect(screen.getByText('சரியான விடை!')).toBeInTheDocument();
    expect(handleNext).not.toHaveBeenCalled();
  });

  it('correctly normalizes Q086 prompt with context sentence and renders expected text without artifacts', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    const q086Activity = {
      id: 'Q086',
      category: 'word-completion',
      variant: 'missing-unit',
      prompt: 'புத்தகத்தைப் ______. ப + [blank]',
      correctAnswer: 'டி',
      options: [
        { id: 'A', label: 'டி' },
        { id: 'B', label: 'தி' },
      ],
    } as Activity;

    render(<WordCompletionActivity activity={q086Activity} state={mockState} onSubmit={handleSubmit} />);

    // Before selection: shows context prefix and equation with blank, no stray underscores
    expect(screen.getByText('புத்தகத்தைப் ப +')).toBeInTheDocument();
    expect(screen.getByLabelText('blank')).toBeInTheDocument();
    expect(screen.queryByText(/_{2,}/)).not.toBeInTheDocument();

    // Select option A ('டி')
    await user.click(screen.getByRole('button', { name: 'டி' }));

    // After selection: shows 'புத்தகத்தைப் ப + டி'
    expect(screen.getByText('புத்தகத்தைப் ப + டி')).toBeInTheDocument();
    expect(screen.queryByText(/புத்தகத்தைப் டி/)).not.toBeInTheDocument();
    expect(screen.queryByText(/____/)).not.toBeInTheDocument();
  });

  it('renders image asset for picture-based word completion activity like Q110 (மண்)', () => {
    const q110Activity = {
      id: 'Q110',
      category: 'word-completion',
      variant: 'missing-unit',
      prompt: 'படத்தில் காணப்படுவது: ம + [____]',
      targetWord: 'மண்',
      correctAnswer: 'ண்',
      options: [
        { id: 'A', label: 'ண்' },
        { id: 'B', label: 'ன்' },
        { id: 'C', label: 'ண' },
        { id: 'D', label: 'ந்' },
      ],
    } as Activity;

    render(<WordCompletionActivity activity={q110Activity} state={mockState} onSubmit={vi.fn()} />);

    expect(screen.getByTestId('activity-asset-image')).toBeInTheDocument();
    const image = screen.getByTestId('activity-asset-image') as HTMLImageElement;
    expect(screen.getByText('படத்தில் காணப்படுவது:')).toBeInTheDocument();
    expect(screen.getByText('ம +')).toBeInTheDocument();
  });
});

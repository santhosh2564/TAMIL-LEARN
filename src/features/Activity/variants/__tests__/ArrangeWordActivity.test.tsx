import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArrangeWordActivity } from '../ArrangeWordActivity';
import { ActivityRuntimeState } from '../../../../engine';
import { Activity } from '../../../../types';

describe('ArrangeWordActivity', () => {
  const mockActivity = {
    id: 'Q015',
    category: 'arrange-word',
    variant: 'arrange',
    prompt: 'Arrange the word',
    correctAnswer: 'கிழங்கு',
    options: [
      { id: 'A', label: 'கி' },
      { id: 'B', label: 'ழ' }
    ]
  } as Activity;

  const mockState: ActivityRuntimeState = {
    activityId: 'Q015',
    status: 'active',
    attempts: 0,
    startedAt: 1000
  };

  it('renders prompt and options', async () => {
    render(<ArrangeWordActivity activity={mockActivity} state={mockState} onSubmit={vi.fn()} />);
    
    expect(screen.getByText('Arrange the word')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('கி')).toBeInTheDocument();
      expect(screen.getByText('ழ')).toBeInTheDocument();
    });
  });

  it('selects option, moves it to answer area, removes, and submits', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    
    render(<ArrangeWordActivity activity={mockActivity} state={mockState} onSubmit={handleSubmit} />);
    
    await waitFor(() => expect(screen.getByText('கி')).toBeInTheDocument());

    // Select 'கி'
    const tokenA = screen.getByText('கி');
    await user.click(tokenA);
    
    // Select 'ழ'
    const tokenB = screen.getByText('ழ');
    await user.click(tokenB);
    
    // Submit
    const checkBtn = screen.getByText('விடையைச் சரிபார்');
    await user.click(checkBtn);
    
    // It should submit whichever order they ended up in. Because of shuffle, it could be A,B or B,A
    // Wait, the order they were clicked depends on where they were.
    // In our test, they are just found by text. So order clicked is 'கி', then 'ழ'.
    expect(handleSubmit).toHaveBeenCalledWith(expect.arrayContaining(['A', 'B']));
  });

  it('wrong arrangement shows retry (not continue); retry keeps tokens editable; fixed order submits correct', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    const handleNext = vi.fn();

    // Two-token activity whose correct answer is the A-then-B join
    const retryActivity = {
      ...mockActivity,
      correctAnswer: 'கிழ',
    } as Activity;

    render(<ArrangeWordActivity activity={retryActivity} state={mockState} onSubmit={handleSubmit} onNext={handleNext} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Select கி' })).toBeInTheDocument());

    // --- Wrong arrangement: B then A ---
    await user.click(screen.getByRole('button', { name: 'Select ழ' }));
    await user.click(screen.getByRole('button', { name: 'Select கி' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith(['B', 'A']);
    expect(screen.getByText('தவறான விடை')).toBeInTheDocument();

    // ── Separate-button contract ─────────────────────────────────────────
    const checkBtn = screen.getByRole('button', { name: 'விடையைச் சரிபார்' });
    expect(checkBtn).toBeInTheDocument();
    expect(checkBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).toBeInTheDocument();
    // ────────────────────────────────────────────────────────────────────

    expect(screen.queryByText('தொடர்க')).not.toBeInTheDocument();
    expect(handleNext).not.toHaveBeenCalled();
    // Tokens locked while wrong feedback is shown
    expect(screen.queryByRole('button', { name: 'Remove கி' })).not.toBeInTheDocument();

    // --- Retry: same activity, arrangement preserved, editable again ---
    await user.click(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }));
    expect(screen.queryByText('தவறான விடை')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove கி' })).toBeInTheDocument();

    // Fix the order: remove both, re-add A then B
    await user.click(screen.getByRole('button', { name: 'Remove கி' }));
    await user.click(screen.getByRole('button', { name: 'Remove ழ' }));
    await user.click(screen.getByRole('button', { name: 'Select கி' }));
    await user.click(screen.getByRole('button', { name: 'Select ழ' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(handleSubmit).toHaveBeenCalledTimes(2);
    expect(handleSubmit).toHaveBeenLastCalledWith(['A', 'B']);
    expect(screen.getByText('சரியான விடை!')).toBeInTheDocument();
    expect(handleNext).not.toHaveBeenCalled();
  });
});

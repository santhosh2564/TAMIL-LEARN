import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PictureSelectActivity } from '../PictureSelectActivity';
import { ActivityRuntimeState } from '../../../../engine';
import { Activity } from '../../../../types';

describe('PictureSelectActivity', () => {
  const mockActivity = {
    id: 'Q001',
    category: 'picture-recognition',
    variant: 'select',
    prompt: 'Find the animal',
    correctAnswer: 'முயல்',
    options: [
      { id: 'A', label: 'முயல்' },
      { id: 'B', label: 'மயில்' }
    ]
  } as Activity;

  const mockState: ActivityRuntimeState = {
    activityId: 'Q001',
    status: 'active',
    attempts: 0,
    startedAt: 1000
  };

  it('renders prompt and options', () => {
    render(<PictureSelectActivity activity={mockActivity} state={mockState} onSubmit={vi.fn()} />);
    
    expect(screen.getByText('Find the animal')).toBeInTheDocument();
    expect(screen.getByText('முயல்')).toBeInTheDocument();
    expect(screen.getByText('மயில்')).toBeInTheDocument();
  });

  it('selects option and calls onSubmit', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    
    render(<PictureSelectActivity activity={mockActivity} state={mockState} onSubmit={handleSubmit} />);
    
    // Select option A
    await user.click(screen.getByText('முயல்'));
    
    // Submit
    await user.click(screen.getByText('விடையைச் சரிபார்'));
    
    expect(handleSubmit).toHaveBeenCalledWith('A');
  });

  it('renders correctly in completed state', () => {
    const completedState: ActivityRuntimeState = {
      ...mockState,
      status: 'completed',
    };
    
    const handleNext = vi.fn();
    
    render(<PictureSelectActivity activity={mockActivity} state={completedState} onSubmit={vi.fn()} onNext={handleNext} />);
    
    // Since we don't pass evaluation directly to the component, it computes correctness itself based on what is selected.
    // Wait, if no option is selected (as the local state starts empty), how does it know what was selected previously?
    // Actually, in the real app, when it transitions to 'completed', the local state `selectedId` still holds the last selected id because the component didn't unmount!
    // But in this test, it mounts with 'completed' state but `selectedId` is null.
    // That's fine, it should render a Continue button.
    const continueBtn = screen.getByText('தொடர்க');
    expect(continueBtn).toBeInTheDocument();
  });

  it('wrong answer shows retry (not continue); retry restores the same activity; correct submits again', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    const handleNext = vi.fn();

    const { container } = render(
      <PictureSelectActivity activity={mockActivity} state={mockState} onSubmit={handleSubmit} onNext={handleNext} />
    );
    const orderBefore = [...container.querySelectorAll('button[aria-pressed]')].map(b => b.textContent);

    // --- Wrong submission ---
    await user.click(screen.getByRole('button', { name: 'மயில்' }));
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

    // Must NOT advance: no continue, no next call
    expect(screen.queryByText('தொடர்க')).not.toBeInTheDocument();
    expect(handleNext).not.toHaveBeenCalled();
    // Correct answer is NOT revealed: correct option locked like the rest, not marked selected
    expect(screen.getByRole('button', { name: 'முயல்' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'முயல்' })).toHaveAttribute('aria-pressed', 'false');

    // --- Retry: same activity, interactive again, order unchanged ---
    await user.click(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }));
    expect(screen.getByText('Find the animal')).toBeInTheDocument();
    expect(screen.queryByText('தவறான விடை')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'முயல்' })).toBeEnabled();
    const orderAfter = [...container.querySelectorAll('button[aria-pressed]')].map(b => b.textContent);
    expect(orderAfter).toEqual(orderBefore);

    // --- Correct submission after retry ---
    await user.click(screen.getByRole('button', { name: 'முயல்' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(handleSubmit).toHaveBeenCalledTimes(2);
    expect(handleSubmit).toHaveBeenCalledWith('A');
    expect(screen.getByText('சரியான விடை!')).toBeInTheDocument();
    // Still no premature advance at component level (engine marks completed in SessionPage)
    expect(handleNext).not.toHaveBeenCalled();
  });

  it('supports multiple retries: wrong → retry → wrong → retry → correct', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<PictureSelectActivity activity={mockActivity} state={mockState} onSubmit={handleSubmit} />);

    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: 'மயில்' }));
      await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));
      expect(screen.getByText('தவறான விடை')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }));
      expect(screen.queryByText('தவறான விடை')).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'முயல்' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));
    expect(handleSubmit).toHaveBeenCalledTimes(3);
    expect(screen.getByText('சரியான விடை!')).toBeInTheDocument();
  });
});

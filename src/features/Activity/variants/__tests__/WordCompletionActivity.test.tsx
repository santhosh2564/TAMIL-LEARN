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
});

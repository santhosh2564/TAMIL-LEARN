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
});

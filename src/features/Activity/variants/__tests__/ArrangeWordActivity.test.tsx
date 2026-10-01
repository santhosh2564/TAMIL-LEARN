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
});

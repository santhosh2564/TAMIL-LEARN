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
});

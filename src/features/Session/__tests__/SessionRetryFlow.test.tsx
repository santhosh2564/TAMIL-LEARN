import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { SessionPage } from '../SessionPage';
import { registerCoreActivities } from '../../Activity/registerActivities';
import { Activity } from '../../../types';
import { ProgressService } from '../../../progress';

const mockActivities: Activity[] = [
  {
    id: 'Q001',
    category: 'picture-recognition',
    variant: 'select',
    prompt: 'Find the rabbit',
    correctAnswer: 'முயல்',
    options: [
      { id: 'A', label: 'முயல்' },
      { id: 'B', label: 'மயில்' },
    ],
  } as Activity,
  {
    id: 'Q006',
    category: 'spelling-choice',
    variant: 'select',
    prompt: 'Choose correct spelling',
    correctAnswer: 'மான்',
    options: [
      { id: 'A', label: 'மான்' },
      { id: 'B', label: 'மாண்' },
    ],
  } as Activity,
  {
    id: 'Q015',
    category: 'arrange-word',
    variant: 'arrange',
    prompt: 'Arrange the word',
    correctAnswer: 'கிழ',
    options: [
      { id: 'A', label: 'கி' },
      { id: 'B', label: 'ழ' },
    ],
  } as Activity,
  {
    id: 'Q002',
    category: 'word-completion',
    variant: 'missing-unit',
    prompt: 'கு + [blank]',
    correctAnswer: 'தி',
    options: [
      { id: 'A', label: 'தி' },
      { id: 'B', label: 'தீ' },
    ],
  } as Activity,
];

let activeMockActivities = mockActivities.slice(0, 2);

vi.mock('../../../engine/SessionActivitySelector', () => {
  return {
    SessionActivitySelector: vi.fn().mockImplementation(() => ({
      selectActivities: vi.fn().mockImplementation(() => Promise.resolve(activeMockActivities)),
    })),
  };
});

describe('SessionPage Retry Flow Integration', () => {
  beforeEach(() => {
    registerCoreActivities();
    activeMockActivities = mockActivities.slice(0, 2);
  });

  it('handles selectable activity: wrong attempt -> retry -> wrong attempt -> retry -> correct attempt -> continue to next activity', async () => {
    const user = userEvent.setup();

    const router = createMemoryRouter(
      [
        {
          path: '/session/:classId/:subjectId/play',
          element: <SessionPage />,
        },
        {
          path: '/session/results',
          element: <div>Results Page Reached</div>,
        },
      ],
      {
        initialEntries: ['/session/3/tamil/play?size=2'],
      }
    );

    render(<RouterProvider router={router} />);

    // Wait for first activity (Q001 - picture recognition) to load
    await waitFor(() => {
      expect(screen.getByText('செயல் 1 / 2')).toBeInTheDocument();
      expect(screen.getByText('Find the rabbit')).toBeInTheDocument();
    });

    // 1. First attempt: choose wrong option 'மயில்'
    await user.click(screen.getByRole('button', { name: 'மயில்' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    // Verify feedback and retry button
    expect(screen.getByText('தவறான விடை')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).toBeInTheDocument();
    // Verify continue button does NOT appear and session remains on Activity 1
    expect(screen.queryByRole('button', { name: 'தொடர்க' })).not.toBeInTheDocument();
    expect(screen.getByText('செயல் 1 / 2')).toBeInTheDocument();

    // Verify correct answer is NOT revealed
    expect(screen.getByRole('button', { name: 'முயல்' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'முயல்' })).toHaveAttribute('aria-pressed', 'false');

    // 2. Click retry: activity resets interactive state on same question
    await user.click(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }));
    expect(screen.queryByText('தவறான விடை')).not.toBeInTheDocument();
    expect(screen.getByText('செயல் 1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'முயல்' })).toBeEnabled();

    // 3. Second attempt: choose wrong option again
    await user.click(screen.getByRole('button', { name: 'மயில்' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));
    expect(screen.getByText('தவறான விடை')).toBeInTheDocument();

    // 4. Click retry again
    await user.click(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }));

    // 5. Third attempt: choose correct option 'முயல்'
    await user.click(screen.getByRole('button', { name: 'முயல்' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    // Verify correct feedback and continue button
    expect(screen.getByText('சரியான விடை!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'தொடர்க' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).not.toBeInTheDocument();

    // 6. Click continue -> moves to Activity 2
    await user.click(screen.getByRole('button', { name: 'தொடர்க' }));

    await waitFor(() => {
      expect(screen.getByText('செயல் 2 / 2')).toBeInTheDocument();
      expect(screen.getByText('Choose correct spelling')).toBeInTheDocument();
    });
  });

  it('handles Arrange Word: wrong order -> retry -> rearrange -> correct order -> continue', async () => {
    activeMockActivities = [mockActivities[2], mockActivities[1]]; // Q015 (arrange-word), Q006
    const user = userEvent.setup();

    const router = createMemoryRouter(
      [
        {
          path: '/session/:classId/:subjectId/play',
          element: <SessionPage />,
        },
        {
          path: '/session/results',
          element: <div>Results Page Reached</div>,
        },
      ],
      {
        initialEntries: ['/session/3/tamil/play?size=2'],
      }
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText('செயல் 1 / 2')).toBeInTheDocument();
      expect(screen.getByText('Arrange the word')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Select கி' })).toBeInTheDocument();
    });

    // 1. Arrange wrong order: ழ then கி
    await user.click(screen.getByRole('button', { name: 'Select ழ' }));
    await user.click(screen.getByRole('button', { name: 'Select கி' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    // Verify wrong feedback and retry button; does not advance
    expect(screen.getByText('தவறான விடை')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'தொடர்க' })).not.toBeInTheDocument();
    expect(screen.getByText('செயல் 1 / 2')).toBeInTheDocument();

    // 2. Click retry
    await user.click(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }));
    expect(screen.queryByText('தவறான விடை')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove கி' })).toBeInTheDocument();

    // 3. Remove both and re-arrange in correct order: கி then ழ
    await user.click(screen.getByRole('button', { name: 'Remove கி' }));
    await user.click(screen.getByRole('button', { name: 'Remove ழ' }));
    await user.click(screen.getByRole('button', { name: 'Select கி' }));
    await user.click(screen.getByRole('button', { name: 'Select ழ' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    // Verify correct feedback and continue button
    expect(screen.getByText('சரியான விடை!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'தொடர்க' })).toBeInTheDocument();

    // 4. Click continue -> moves to Activity 2
    await user.click(screen.getByRole('button', { name: 'தொடர்க' }));

    await waitFor(() => {
      expect(screen.getByText('செயல் 2 / 2')).toBeInTheDocument();
      expect(screen.getByText('Choose correct spelling')).toBeInTheDocument();
    });
  });

  it('handles Word Completion: wrong choice -> retry -> change selection -> correct choice -> advances to next activity', async () => {
    activeMockActivities = [mockActivities[3], mockActivities[1]]; // Q002 (word-completion), Q006 (spelling-choice)
    const user = userEvent.setup();

    const router = createMemoryRouter(
      [
        {
          path: '/session/:classId/:subjectId/play',
          element: <SessionPage />,
        },
        {
          path: '/session/results',
          element: <div>Results Page Reached</div>,
        },
      ],
      {
        initialEntries: ['/session/3/tamil/play?size=2'],
      }
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText('செயல் 1 / 2')).toBeInTheDocument();
      expect(screen.getByText('கு +')).toBeInTheDocument();
    });

    // 1. Choose wrong option 'தீ'
    await user.click(screen.getByRole('button', { name: 'தீ' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    // Verify wrong feedback and retry button
    expect(screen.getByText('தவறான விடை')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'தொடர்க' })).not.toBeInTheDocument();

    // 2. Click retry
    await user.click(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }));
    expect(screen.queryByText('தவறான விடை')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'தி' })).toBeEnabled();

    // 3. Choose correct option 'தி'
    await user.click(screen.getByRole('button', { name: 'தி' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(screen.getByText('சரியான விடை!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'தொடர்க' })).toBeInTheDocument();

    // 4. Continue -> advances to Activity 2
    await user.click(screen.getByRole('button', { name: 'தொடர்க' }));

    await waitFor(() => {
      expect(screen.getByText('செயல் 2 / 2')).toBeInTheDocument();
      expect(screen.getByText('Choose correct spelling')).toBeInTheDocument();
    });
  });

  it('verifies progress persistence is only called when completed/correct, never on wrong attempt', async () => {
    activeMockActivities = [mockActivities[0]]; // Q001
    const recordSpy = vi.spyOn(ProgressService.prototype, 'recordCompletion');
    recordSpy.mockClear();

    const user = userEvent.setup();

    const router = createMemoryRouter(
      [
        {
          path: '/session/:classId/:subjectId/play',
          element: <SessionPage />,
        },
      ],
      {
        initialEntries: ['/session/3/tamil/play?size=1'],
      }
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText('Find the rabbit')).toBeInTheDocument();
    });

    // 1. Wrong attempt
    await user.click(screen.getByRole('button', { name: 'மயில்' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(screen.getByText('தவறான விடை')).toBeInTheDocument();
    // Must NOT have persisted completion progress on wrong attempt
    expect(recordSpy).not.toHaveBeenCalled();

    // 2. Retry and correct attempt
    await user.click(screen.getByRole('button', { name: 'மீண்டும் முயற்சி செய்' }));
    await user.click(screen.getByRole('button', { name: 'முயல்' }));
    await user.click(screen.getByRole('button', { name: 'விடையைச் சரிபார்' }));

    expect(screen.getByText('சரியான விடை!')).toBeInTheDocument();
    // Must persist completion with attempts = 2
    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: 'Q001',
        completed: true,
        correct: true,
        attempts: 2,
      }),
      'picture-recognition'
    );

    recordSpy.mockRestore();
  });
});

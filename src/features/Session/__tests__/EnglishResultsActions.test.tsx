import { describe, it, expect, vi, beforeEach, MockedClass } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResultsPage } from '../ResultsPage';
import { ActivitySession, SessionSize } from '../../../engine/types';
import { EnglishProgressService, EnglishDayProgress } from '../../../progress';

// Mock EnglishProgressService methods
vi.mock('../../../progress', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../../progress');
  return {
    ...actual,
    EnglishProgressService: vi.fn(),
  };
});

describe('English ResultsPage Action Matrix', () => {
  let mockGetDayProgress: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDayProgress = vi.fn();
    (EnglishProgressService as unknown as MockedClass<typeof EnglishProgressService>).mockImplementation(() => ({
      getDayProgress: mockGetDayProgress,
    } as unknown as EnglishProgressService));
  });

  const baseSession: ActivitySession = {
    id: 'eng_session_1',
    status: 'completed',
    currentIndex: 1,
    activityIds: ['act1', 'act2'],
    completedActivityIds: ['act1', 'act2'],
    results: {
      act1: { activityId: 'act1', correct: true, completed: true, attempts: 1, startedAt: 1 },
      act2: { activityId: 'act2', correct: true, completed: true, attempts: 1, startedAt: 2 },
    },
  };

  const baseActivities = {
    act1: { id: 'act1', category: 'word-entry', prompt: 'Type word' },
    act2: { id: 'act2', category: 'word-entry', prompt: 'Fill letter' },
  };

  const allSize: SessionSize = { mode: 'all' };

  it('Scenario 1: Day incomplete -> Practice Again and Back to Module', async () => {
    mockGetDayProgress.mockResolvedValue({
      module: 1,
      day: 1,
      totalActivities: 24,
      completedActivities: 18,
      percent: 75,
      isCompleted: false,
      firstTryAccuracy: 50,
      overallAccuracy: 60,
    } satisfies EnglishDayProgress);

    const config = {
      classId: '3',
      subjectId: 'english',
      category: null,
      size: allSize,
      level: undefined,
      module: 1,
      day: 1,
    };

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/session/results',
            state: { session: baseSession, activities: baseActivities, config },
          },
        ]}
      >
        <Routes>
          <Route path="/session/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Practice Again')).toBeInTheDocument();
      expect(screen.getByText('Back to Module')).toBeInTheDocument();
      expect(screen.queryByText(/Next Day/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Next Module/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Back to Modules')).not.toBeInTheDocument();
    });
  });

  it('Scenario 2: Day completed + next day exists -> Next Day, Practice Again, Back to Module', async () => {
    mockGetDayProgress.mockResolvedValue({
      module: 1,
      day: 2,
      totalActivities: 24,
      completedActivities: 24,
      percent: 100,
      isCompleted: true,
      firstTryAccuracy: 100,
      overallAccuracy: 100,
    } satisfies EnglishDayProgress);

    const config = {
      classId: '3',
      subjectId: 'english',
      category: null,
      size: allSize,
      level: undefined,
      module: 1,
      day: 2,
    };

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/session/results',
            state: { session: baseSession, activities: baseActivities, config },
          },
        ]}
      >
        <Routes>
          <Route path="/session/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Next Day/i)).toBeInTheDocument();
      expect(screen.getByText('Practice Again')).toBeInTheDocument();
      expect(screen.getByText('Back to Module')).toBeInTheDocument();
      expect(screen.queryByText(/Next Module/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Back to Modules')).not.toBeInTheDocument();
    });
  });

  it('Scenario 3: Day completed + module complete (day 5) + next module exists -> Next Module, Practice Again, Back to Module', async () => {
    mockGetDayProgress.mockResolvedValue({
      module: 3,
      day: 5,
      totalActivities: 32,
      completedActivities: 32,
      percent: 100,
      isCompleted: true,
      firstTryAccuracy: 95,
      overallAccuracy: 95,
    } satisfies EnglishDayProgress);

    const config = {
      classId: '3',
      subjectId: 'english',
      category: null,
      size: allSize,
      level: undefined,
      module: 3,
      day: 5,
    };

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/session/results',
            state: { session: baseSession, activities: baseActivities, config },
          },
        ]}
      >
        <Routes>
          <Route path="/session/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Next Module/i)).toBeInTheDocument();
      expect(screen.getByText('Practice Again')).toBeInTheDocument();
      expect(screen.getByText('Back to Module')).toBeInTheDocument();
      expect(screen.queryByText(/Next Day/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Back to Modules')).not.toBeInTheDocument();
    });
  });

  it('Scenario 4: Final day of Module 8 (day 5) complete -> Practice Again and Back to Modules', async () => {
    mockGetDayProgress.mockResolvedValue({
      module: 8,
      day: 5,
      totalActivities: 31,
      completedActivities: 31,
      percent: 100,
      isCompleted: true,
      firstTryAccuracy: 100,
      overallAccuracy: 100,
    } satisfies EnglishDayProgress);

    const config = {
      classId: '3',
      subjectId: 'english',
      category: null,
      size: allSize,
      level: undefined,
      module: 8,
      day: 5,
    };

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/session/results',
            state: { session: baseSession, activities: baseActivities, config },
          },
        ]}
      >
        <Routes>
          <Route path="/session/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Practice Again')).toBeInTheDocument();
      expect(screen.getByText('Back to Modules')).toBeInTheDocument();
      expect(screen.queryByText(/Next Day/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Next Module/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Back to Module')).not.toBeInTheDocument();
    });
  });
});

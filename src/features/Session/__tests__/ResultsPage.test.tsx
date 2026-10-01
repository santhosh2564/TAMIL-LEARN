import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResultsPage } from '../ResultsPage';
import { ActivitySession } from '../../../engine/types';

describe('ResultsPage', () => {
  it('renders correctly with mocked state', () => {
    const mockSession: ActivitySession = {
      id: 'test',
      status: 'completed',
      currentIndex: 1,
      activityIds: ['Q1', 'Q2'],
      completedActivityIds: ['Q1', 'Q2'],
      results: {
        'Q1': { activityId: 'Q1', correct: true, completed: true, attempts: 1, startedAt: 1 },
        'Q2': { activityId: 'Q2', correct: false, completed: true, attempts: 1, startedAt: 1 },
      }
    };

    const mockActivities = {
      'Q1': { id: 'Q1', category: 'picture-recognition', prompt: 'Prompt 1' },
      'Q2': { id: 'Q2', category: 'spelling-choice', prompt: 'Prompt 2' }
    };

    const mockConfig = {
      classId: '3',
      subjectId: 'tamil',
      category: null,
      size: 10,
      level: undefined
    };

    render(
      <MemoryRouter initialEntries={[{ pathname: '/session/results', state: { session: mockSession, activities: mockActivities, config: mockConfig } }]}>
        <Routes>
          <Route path="/session/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Mixed practice title
    expect(screen.getByText('உங்கள் கலப்பு பயிற்சி நிறைவுற்றது.')).toBeInTheDocument();
    
    // Stats
    expect(screen.getByText('2')).toBeInTheDocument(); // total activities
    expect(screen.getByText('50%')).toBeInTheDocument(); // accuracy
    expect(screen.getByText('1')).toBeInTheDocument(); // correct
    
    // Breakdown
    expect(screen.getByText('picture recognition')).toBeInTheDocument();
    expect(screen.getByText('spelling choice')).toBeInTheDocument();
    expect(screen.getByText('Prompt 1')).toBeInTheDocument();
  });
});

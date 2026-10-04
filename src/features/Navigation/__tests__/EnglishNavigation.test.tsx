import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EnglishLearningAreaPage } from '../EnglishLearningAreaPage';
import { EnglishModuleDetailPage } from '../EnglishModuleDetailPage';
import { SubjectSelectionPage } from '../SubjectSelectionPage';
import { SessionActivitySelector } from '../../../engine/SessionActivitySelector';
import { SessionConfig } from '../../../engine/types';
import { LocalContentRepository } from '../../../repositories/implementations/LocalContentRepository';

describe('English Navigation and Curriculum Structure', () => {
  describe('A. Subject Selection -> English availability', () => {
    it('marks English as available for Class 3', () => {
      render(
        <MemoryRouter initialEntries={['/classes/3/subjects']}>
          <Routes>
            <Route path="/classes/:classId/subjects" element={<SubjectSelectionPage />} />
          </Routes>
        </MemoryRouter>
      );

      const englishCards = screen.getAllByText('English');
      expect(englishCards.length).toBeGreaterThan(0);
      // Should not have "Coming Soon" badge for Class 3 English
      const comingSoonBadges = screen.queryAllByText('Coming Soon');
      // Since Mathematics, EVS, Science are now hidden, we expect 0 coming soon badges.
      expect(comingSoonBadges.length).toBe(0);
    });
  });

  describe('B. English Learning Area Page', () => {
    it('loads and renders all 8 curriculum modules with manifest-derived counts', async () => {
      render(
        <MemoryRouter initialEntries={['/classes/3/subjects/english']}>
          <Routes>
            <Route path="/classes/:classId/subjects/english" element={<EnglishLearningAreaPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Loading English modules...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('English Modules')).toBeInTheDocument();
        expect(screen.getByText('958 Words · 1238 Total Practice Activities')).toBeInTheDocument();
      });

      // Verify all 8 modules are displayed
      for (let i = 1; i <= 8; i++) {
        expect(screen.getByLabelText(new RegExp(`Module ${i}:`, 'i'))).toBeInTheDocument();
      }

      // Verify specific manifest counts on module cards
      expect(screen.getByText('Module 1 - Foundation & Recognition')).toBeInTheDocument();
      expect(screen.getByText('120 activities')).toBeInTheDocument(); // M1 total

      expect(screen.getByText('Module 8 - Curriculum Mastery')).toBeInTheDocument();
      expect(screen.getByText('158 activities')).toBeInTheDocument(); // M8 total
    });
  });

  describe('C. English Module Detail Page', () => {
    it('renders valid Module 1 details and all 5 days with 24 activities each', async () => {
      render(
        <MemoryRouter initialEntries={['/classes/3/subjects/english/modules/1']}>
          <Routes>
            <Route path="/classes/:classId/subjects/english/modules/:moduleId" element={<EnglishModuleDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Module 1 - Foundation & Recognition')).toBeInTheDocument();
        expect(screen.getByText('120 New Words')).toBeInTheDocument();
        expect(screen.getByText('5 Days (120 Total Activities)')).toBeInTheDocument();
      });

      // Verify all 5 days
      for (let day = 1; day <= 5; day++) {
        expect(screen.getByText(`Day ${day} Practice`)).toBeInTheDocument();
      }

      const activityBadges = screen.getAllByText('24 activities');
      expect(activityBadges.length).toBe(5);
    });

    it('renders valid Module 2 details with review counts (24 new + 8 review = 32/day)', async () => {
      render(
        <MemoryRouter initialEntries={['/classes/3/subjects/english/modules/2']}>
          <Routes>
            <Route path="/classes/:classId/subjects/english/modules/:moduleId" element={<EnglishModuleDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Module 2 - Phonemic Building & Core Vocabulary')).toBeInTheDocument();
        expect(screen.getByText('120 New Words')).toBeInTheDocument();
        expect(screen.getByText('40 Review Activities')).toBeInTheDocument();
        expect(screen.getByText('5 Days (160 Total Activities)')).toBeInTheDocument();
      });

      const dayBadges = screen.getAllByText('32 activities');
      expect(dayBadges.length).toBe(5);

      const reviewTexts = screen.getAllByText(/8 review activities/i);
      expect(reviewTexts.length).toBe(5);
    });

    it('renders valid Module 8 with asymmetric day counts (D1-D3: 32, D4-D5: 31)', async () => {
      render(
        <MemoryRouter initialEntries={['/classes/3/subjects/english/modules/8']}>
          <Routes>
            <Route path="/classes/:classId/subjects/english/modules/:moduleId" element={<EnglishModuleDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Module 8 - Curriculum Mastery')).toBeInTheDocument();
        expect(screen.getByText('118 New Words')).toBeInTheDocument();
        expect(screen.getByText('40 Review Activities')).toBeInTheDocument();
        expect(screen.getByText('5 Days (158 Total Activities)')).toBeInTheDocument();
      });

      const badges32 = screen.getAllByText('32 activities');
      expect(badges32.length).toBe(3); // Days 1, 2, 3

      const badges31 = screen.getAllByText('31 activities');
      expect(badges31.length).toBe(2); // Days 4, 5
    });

    it('safely handles non-existent or invalid module parameter (e.g. 0 or 9)', async () => {
      render(
        <MemoryRouter initialEntries={['/classes/3/subjects/english/modules/9']}>
          <Routes>
            <Route path="/classes/:classId/subjects/english/modules/:moduleId" element={<EnglishModuleDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Module not found')).toBeInTheDocument();
        expect(screen.getByText('Back to Modules')).toBeInTheDocument();
      });
    });

    it('navigates to session when Start button is clicked on a day', async () => {
      const TestApp = () => {
        return (
          <Routes>
            <Route path="/classes/:classId/subjects/english/modules/:moduleId" element={<EnglishModuleDetailPage />} />
            <Route path="/session/:classId/:subjectId/play" element={<div>Session Play Screen</div>} />
          </Routes>
        );
      };

      render(
        <MemoryRouter initialEntries={['/classes/3/subjects/english/modules/1']}>
          <TestApp />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Day 1 Practice')).toBeInTheDocument();
      });

      const startButtons = screen.getAllByText('Start');
      fireEvent.click(startButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Session Play Screen')).toBeInTheDocument();
      });
    });
  });

  describe('D. Session Content Selection & No Cross-Module/Day Leakage', () => {
    const selector = new SessionActivitySelector(new LocalContentRepository());

    it('selects exactly 24 activities for Module 1 Day 1 without leakage', async () => {
      const config: SessionConfig = {
        classId: '3',
        subjectId: 'english',
        category: null,
        module: 1,
        day: 1,
        size: { mode: 'all' },
      };

      const activities = await selector.selectActivities(config);
      expect(activities.length).toBe(24);

      activities.forEach((act) => {
        expect(act.subject).toBe('English');
        expect(act.module).toBe(1);
        expect(act.day).toBe(1);
        expect(act.role).toBe('new');
      });
    });

    it('selects exactly 32 activities for Module 2 Day 1 (24 new, 8 review)', async () => {
      const config: SessionConfig = {
        classId: '3',
        subjectId: 'english',
        category: null,
        module: 2,
        day: 1,
        size: { mode: 'all' },
      };

      const activities = await selector.selectActivities(config);
      expect(activities.length).toBe(32);

      const newActs = activities.filter((a) => a.role === 'new');
      const reviewActs = activities.filter((a) => a.role === 'review');

      expect(newActs.length).toBe(24);
      expect(reviewActs.length).toBe(8);

      activities.forEach((act) => {
        expect(act.subject).toBe('English');
        expect(act.module).toBe(2);
        expect(act.day).toBe(1);
      });
    });

    it('selects exactly 31 activities for Module 8 Day 5 (23 new, 8 review)', async () => {
      const config: SessionConfig = {
        classId: '3',
        subjectId: 'english',
        category: null,
        module: 8,
        day: 5,
        size: { mode: 'all' },
      };

      const activities = await selector.selectActivities(config);
      expect(activities.length).toBe(31);

      const newActs = activities.filter((a) => a.role === 'new');
      const reviewActs = activities.filter((a) => a.role === 'review');

      expect(newActs.length).toBe(23);
      expect(reviewActs.length).toBe(8);

      activities.forEach((act) => {
        expect(act.subject).toBe('English');
        expect(act.module).toBe(8);
        expect(act.day).toBe(5);
      });
    });

    it('returns empty array when querying an invalid module or day', async () => {
      const invalidConfig: SessionConfig = {
        classId: '3',
        subjectId: 'english',
        category: null,
        module: 9,
        day: 1,
        size: { mode: 'all' },
      };

      const activities = await selector.selectActivities(invalidConfig);
      expect(activities.length).toBe(0);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TamilLearningAreaPage } from '../TamilLearningAreaPage';
import { TamilModuleDetailPage } from '../TamilModuleDetailPage';
import { SessionActivitySelector } from '../../../engine/SessionActivitySelector';
import { LocalContentRepository } from '../../../repositories/implementations/LocalContentRepository';

describe('Tamil Navigation & Curriculum Hierarchy', () => {
  it('loads and renders all 8 Tamil curriculum modules in TamilLearningAreaPage', async () => {
    render(
      <MemoryRouter initialEntries={['/classes/3/subjects/tamil']}>
        <Routes>
          <Route path="/classes/:classId/subjects/tamil" element={<TamilLearningAreaPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('தமிழ் தொகுதிகள் ஏற்றப்படுகின்றன...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('தமிழ் தொகுதிகள் (Tamil Modules)')).toBeInTheDocument();
      expect(screen.getByText(/1178 பயிற்சிகள் · 8 தொகுதிகள் · 40 கற்றல் நாள்கள்/)).toBeInTheDocument();
    });

    // Check all 8 modules are rendered
    for (let m = 1; m <= 8; m++) {
      expect(screen.getByText(new RegExp(`தொகுதி ${m} \\(Module ${m}\\)`))).toBeInTheDocument();
    }
  });

  it('loads and renders 5 days in TamilModuleDetailPage for Module 1', async () => {
    render(
      <MemoryRouter initialEntries={['/classes/3/subjects/tamil/modules/1']}>
        <Routes>
          <Route path="/classes/:classId/subjects/tamil/modules/:moduleId" element={<TamilModuleDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('தொகுதி 1 (Module 1)')).toBeInTheDocument();
      expect(screen.getByText('நாள்தோறும் பயிற்சிகள் (Daily Practice)')).toBeInTheDocument();
    });

    // Check all 5 days are displayed
    for (let d = 1; d <= 5; d++) {
      expect(screen.getByText(new RegExp(`நாள் ${d} பயிற்சி`))).toBeInTheDocument();
    }
  });

  it('SessionActivitySelector selects exactly the allocated questions for a specific day', async () => {
    const selector = new SessionActivitySelector(new LocalContentRepository());
    
    // Select Tamil Module 2 Day 3
    const activities = await selector.selectActivities({
      classId: '3',
      subjectId: 'tamil',
      category: null,
      module: 2,
      day: 3,
      size: { mode: 'all' },
    });

    expect(activities.length).toBe(30);
    activities.forEach(a => {
      expect(a.module).toBe(2);
      expect(a.day).toBe(3);
      expect(a.subject).toBe('Tamil');
    });

    // Verify activity diversity within this day (at least 5 distinct categories)
    const catSet = new Set(activities.map(a => a.category));
    expect(catSet.size).toBeGreaterThanOrEqual(5);
  });
});

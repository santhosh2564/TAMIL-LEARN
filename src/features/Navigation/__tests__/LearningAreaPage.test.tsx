import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LearningAreaPage } from '../LearningAreaPage';
import { LocalContentRepository } from '../../../repositories/implementations/LocalContentRepository';

// Mock repository
vi.mock('../../../repositories/implementations/LocalContentRepository');

describe('LearningAreaPage', () => {
  it('loads categories and displays their counts', async () => {
    const mockGetActivityCount = vi.fn().mockImplementation(({ category }) => {
      if (category === 'picture-recognition') return 21;
      if (category === 'word-completion') return 9;
      return 0;
    });

    vi.mocked(LocalContentRepository).mockImplementation(() => {
      return {
        getManifest: vi.fn(),
        getActivities: vi.fn(),
        getActivityById: vi.fn(),
        getActivityCount: mockGetActivityCount,
      } as unknown as typeof LocalContentRepository.prototype;
    });

    render(
      <MemoryRouter initialEntries={['/classes/3/subjects/tamil']}>
        <Routes>
          <Route path="/classes/:classId/subjects/:subjectId" element={<LearningAreaPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('கற்றல் பகுதி ஏற்றப்படுகிறது...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('படம் பார்த்து சொல்')).toBeInTheDocument();
      expect(screen.getByText('21 செயல்கள்')).toBeInTheDocument();
      expect(screen.getByText('சொல் நிரப்புக')).toBeInTheDocument();
      expect(screen.getByText('9 செயல்கள்')).toBeInTheDocument();
    });

    // Categories with 0 count should not be rendered
    expect(screen.queryByText('சொல் உருவாக்குக')).not.toBeInTheDocument();
  });
});

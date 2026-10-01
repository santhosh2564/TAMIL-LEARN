import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionSetupPage } from '../SessionSetupPage';

// Simple mock for the LocalContentRepository to control data fetching
vi.mock('../../../repositories/implementations/LocalContentRepository', () => {
  return {
    LocalContentRepository: vi.fn().mockImplementation(() => {
      return {
        getActivityCount: vi.fn().mockResolvedValue(15),
      };
    }),
  };
});

describe('SessionSetupPage', () => {
  it('renders mixed practice setup by default and allows level/size selection', async () => {
    const user = userEvent.setup();
    
    render(
      <MemoryRouter initialEntries={['/session/3/tamil/setup']}>
        <Routes>
          <Route path="/session/:classId/:subjectId/setup" element={<SessionSetupPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial load
    expect(screen.getByText('உள்ளடக்கம் சரிபார்க்கப்படுகிறது...')).toBeInTheDocument();

    // Await mock resolution
    await waitFor(() => {
      expect(screen.getByText('கலப்பு பயிற்சி')).toBeInTheDocument();
    });

    // Check count is rendered
    expect(screen.getByText('15')).toBeInTheDocument();

    // Select Level 1
    const level1Btn = screen.getByText('நிலை 1');
    await user.click(level1Btn);
    expect(level1Btn).toHaveClass('bg-primary-500');

    // Select 5 activities
    const size5Btn = screen.getByText('5');
    await user.click(size5Btn);
    expect(size5Btn).toHaveClass('bg-primary-500');

    // Start button should be active
    const startBtn = screen.getByText('பயிற்சியைத் தொடங்கு');
    expect(startBtn).not.toBeDisabled();
  });

  it('renders category practice setup when category param is present', async () => {
    render(
      <MemoryRouter initialEntries={['/session/3/tamil/setup?category=spelling-choice']}>
        <Routes>
          <Route path="/session/:classId/:subjectId/setup" element={<SessionSetupPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('வகைப் பயிற்சி')).toBeInTheDocument();
    });
  });
});

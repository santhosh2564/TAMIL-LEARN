import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudentSelectionView } from '../StudentSelectionView';
import { StudentProvider } from '../../../student';

describe('StudentSelectionView Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows prompt to set up computer when no classId is stored in localStorage', async () => {
    render(
      <MemoryRouter>
        <StudentProvider>
          <StudentSelectionView />
        </StudentProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Set up this computer/i })).toBeInTheDocument();
      expect(screen.getByText(/This computer has not been set up with a class yet/i)).toBeInTheDocument();
    });
  });

  it('loads and displays student roster when classId is configured', async () => {
    localStorage.setItem('sara_class_id', 'class-123');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/classes/class-123/roster')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            class: { id: 'class-123', name: 'Class 3A', grade: 'Class 3' },
            students: [
              { id: 's-1', name: 'Kavin', avatar: 'avatar_1' },
              { id: 's-2', name: 'Malar', avatar: 'avatar_2' },
            ],
          }),
        } as Response);
      }
      if (url.includes('/api/student/session')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(
      <MemoryRouter>
        <StudentProvider>
          <StudentSelectionView />
        </StudentProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Who is learning today?')).toBeInTheDocument();
      expect(screen.getByText('Class 3A')).toBeInTheDocument();
      expect(screen.getByText('Kavin')).toBeInTheDocument();
      expect(screen.getByText('Malar')).toBeInTheDocument();
    });
  });

  it('selects student on click and displays Continue card if an active session exists', async () => {
    localStorage.setItem('sara_class_id', 'class-123');
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/classes/class-123/roster')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            class: { id: 'class-123', name: 'Class 3A', grade: 'Class 3' },
            students: [{ id: 's-1', name: 'Kavin', avatar: 'avatar_1' }],
          }),
        } as Response);
      }
      if (url.includes('/api/student/select') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            student: { id: 's-1', name: 'Kavin', avatar: 'avatar_1', classId: 'class-123', schoolId: 'sch-1' },
          }),
        } as Response);
      }
      if (url.includes('/api/students/s-1/sessions/active')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            session: {
              id: 'sess-active-1',
              studentId: 's-1',
              subject: 'tamil',
              categoryOrModule: 'spelling-choice',
              activityIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
              currentIndex: 3,
              status: 'active',
            },
          }),
        } as Response);
      }
      if (url.includes('/api/student/session')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });

    render(
      <MemoryRouter>
        <StudentProvider>
          <StudentSelectionView />
        </StudentProvider>
      </MemoryRouter>
    );

    const studentBtn = await screen.findByRole('button', { name: /Select student Kavin/i });
    await user.click(studentBtn);

    await waitFor(() => {
      expect(screen.getByTestId('session-resume-card')).toBeInTheDocument();
      expect(screen.getByText(/Question 4 of 5/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /தொடர்க \/ Continue/i })).toBeInTheDocument();
    });
  });
});

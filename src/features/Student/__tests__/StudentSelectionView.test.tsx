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

  it('shows prompt to set up computer when no schoolId is stored in localStorage', async () => {
    render(
      <MemoryRouter>
        <StudentProvider>
          <StudentSelectionView />
        </StudentProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Select Your School/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Set up this computer/i })).toBeInTheDocument();
    });
  });

  it('loads and displays student roster when schoolId is configured', async () => {
    localStorage.setItem('sara_school_id', 'sch-123');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/schools/sch-123/roster') || url.includes('/api/classes/sch-123/roster')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            school: { id: 'sch-123', name: 'Primary School Alpha' },
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
      expect(screen.getByText("Welcome! Let's Learn")).toBeInTheDocument();
      expect(screen.getByText('Primary School Alpha')).toBeInTheDocument();
      expect(screen.getByText('Kavin')).toBeInTheDocument();
      expect(screen.getByText('Malar')).toBeInTheDocument();
    });
  });

  it('selects student on click and displays Continue card if an active session exists', async () => {
    localStorage.setItem('sara_school_id', 'sch-123');
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/schools/sch-123/roster') || url.includes('/api/classes/sch-123/roster')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            school: { id: 'sch-123', name: 'Primary School Alpha' },
            students: [{ id: 's-1', name: 'Kavin', avatar: 'avatar_1' }],
          }),
        } as Response);
      }
      if (url.includes('/api/student/select') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            student: { id: 's-1', name: 'Kavin', avatar: 'avatar_1', schoolId: 'sch-123' },
          }),
        } as Response);
      }
      if (url.includes('/api/students/s-1/assessment-sessions/active') || url.includes('/api/students/s-1/sessions/active')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            session: {
              id: 'sess-active-1',
              student_id: 's-1',
              school_id: 'sch-123',
              subject_id: 'tamil',
              module_id: 1,
              activity_ids: ['q1', 'q2', 'q3', 'q4', 'q5'],
              current_question_index: 3,
              session_status: 'in_progress',
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

  it('validates student name input and displays an error when student is not found', async () => {
    localStorage.setItem('sara_school_id', 'sch-123');
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/schools/sch-123/roster')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            schoolName: 'Primary School Alpha',
            students: [{ id: 'stu-1', name: 'Kavin', pinRequired: false }],
          }),
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

    const input = await screen.findByPlaceholderText(/Type your name/i);
    await user.type(input, 'UnknownStudent');

    const continueBtn = screen.getByRole('button', { name: /Continue \/ தொடர்க/i });
    await user.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText(/Student "UnknownStudent" was not found/i)).toBeInTheDocument();
    });
  });
});

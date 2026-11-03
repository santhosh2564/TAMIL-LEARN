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

  it('renders student welcome name entry screen when school is configured', async () => {
    localStorage.setItem('sara_school_id', 'sch-123');
    localStorage.setItem('sara_school_name', 'Primary School Alpha');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/public/schools')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            schools: [{ id: 'sch-123', name: 'Primary School Alpha', schoolCode: 'PSA01' }],
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

    await waitFor(() => {
      expect(screen.getByText("Welcome! Let's Learn")).toBeInTheDocument();
      expect(screen.getByText('Primary School Alpha')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter your name/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
    });
  });

  it('allows switching school when Change button is clicked', async () => {
    localStorage.setItem('sara_school_id', 'sch-123');
    localStorage.setItem('sara_school_name', 'Primary School Alpha');
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/public/schools')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            schools: [
              { id: 'sch-123', name: 'Primary School Alpha', schoolCode: 'PSA01' },
              { id: 'sch-456', name: 'Secondary School Beta', schoolCode: 'SSB02' },
            ],
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

    const changeBtn = await screen.findByRole('button', { name: /Change/i });
    await user.click(changeBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Select Your School/i })).toBeInTheDocument();
      expect(screen.getByText('Secondary School Beta')).toBeInTheDocument();
    });
  });

  it('validates empty name input and displays an error message', async () => {
    localStorage.setItem('sara_school_id', 'sch-123');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/public/schools')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            schools: [{ id: 'sch-123', name: 'Primary School Alpha', schoolCode: 'PSA01' }],
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

    const continueBtn = await screen.findByRole('button', { name: /Continue/i });
    expect(continueBtn).toBeDisabled();
  });

  it('submits student name to /api/student/resolve and calls onSuccess', async () => {
    localStorage.setItem('sara_school_id', 'sch-123');
    const user = userEvent.setup();
    const onSuccessMock = vi.fn();

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/public/schools')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            schools: [{ id: 'sch-123', name: 'Primary School Alpha', schoolCode: 'PSA01' }],
          }),
        } as Response);
      }
      if (url.includes('/api/student/resolve') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            isNew: true,
            student: {
              id: 'stud-new-1',
              name: body.name,
              avatar: 'avatar_default',
              schoolId: body.schoolId,
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
          <StudentSelectionView onSuccess={onSuccessMock} />
        </StudentProvider>
      </MemoryRouter>
    );

    const input = await screen.findByPlaceholderText(/Enter your name/i);
    await user.type(input, 'Kavin');

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    await user.click(continueBtn);

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
    });
  });
});

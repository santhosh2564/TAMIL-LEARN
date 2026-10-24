import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentSelectionView } from '../StudentSelectionView';
import { StudentProvider } from '../../../student';

describe('StudentSelectionView Component', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
  });

  it('shows new student input when no students exist', async () => {
    render(
      <StudentProvider>
        <StudentSelectionView />
      </StudentProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("What's your name?")).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Learning/i })).toBeInTheDocument();
    });
  });

  it('allows creating a new student and sets them as active', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    render(
      <StudentProvider>
        <StudentSelectionView onSuccess={handleSuccess} />
      </StudentProvider>
    );

    const input = await screen.findByPlaceholderText('Enter your name');
    await user.type(input, 'Arjun');
    await user.click(screen.getByRole('button', { name: /Start Learning/i }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('displays existing students and allows switching', async () => {
    // Seed existing students
    store['sa.students.v1'] = JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      students: [
        { id: 'id-arjun', name: 'Arjun', createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() },
        { id: 'id-priya', name: 'Priya', createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() },
      ],
    });

    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    render(
      <StudentProvider>
        <StudentSelectionView onSuccess={handleSuccess} />
      </StudentProvider>
    );

    // Should show "Who is learning today?"
    await waitFor(() => {
      expect(screen.getByText('Who is learning today?')).toBeInTheDocument();
      expect(screen.getByText('Arjun')).toBeInTheDocument();
      expect(screen.getByText('Priya')).toBeInTheDocument();
    });

    // Select Priya
    await user.click(screen.getByRole('button', { name: /Select student Priya/i }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('allows switching from student list to new student form', async () => {
    store['sa.students.v1'] = JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      students: [
        { id: 'id-arjun', name: 'Arjun', createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() },
      ],
    });

    const user = userEvent.setup();

    render(
      <StudentProvider>
        <StudentSelectionView />
      </StudentProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Arjun')).toBeInTheDocument();
    });

    // Click "+ New Student"
    await user.click(screen.getByRole('button', { name: /\+ New Student/i }));

    expect(screen.getByText("What's your name?")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();

    // Click Back
    await user.click(screen.getByRole('button', { name: /Back/i }));
    expect(screen.getByText('Who is learning today?')).toBeInTheDocument();
  });
});

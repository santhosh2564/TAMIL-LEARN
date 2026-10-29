/**
 * T13. Students exist only on the server; learning needs a server student session.
 * (a) No student-facing route or button can create a student.
 * (b) /classes/* and /session/* without a student session redirect to the class-code page,
 *     even when an old local-only profile is still in localStorage.
 * (c) The class-code box navigates to /c/:code.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import { routes } from '../routes';
import { StudentProvider, StudentService, useStudent } from '../../student';

const JOIN_PATH = '/join';
const SERVER_STUDENT = { id: 'stud_server_1', name: 'Kavin', avatar: 'avatar_1', classId: 'cls_1', schoolId: 'sch_1' };

function mockFetch(hasSession: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/student/session') {
        return hasSession
          ? new Response(JSON.stringify({ student: SERVER_STUDENT }), { status: 200 })
          : new Response(JSON.stringify({ error: 'No active student session' }), { status: 401 });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    })
  );
}

function renderAt(entry: string) {
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(
    <StudentProvider>
      <RouterProvider router={router} />
    </StudentProvider>
  );
  return router;
}

/** An old local-only profile, as created by the removed "+ New Student" flow. */
function seedLegacyLocalProfile() {
  localStorage.setItem(
    'sa.students.v1',
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      students: [{ id: 'local_old', name: 'Old Local', createdAt: '2026-10-01T00:00:00Z', lastActiveAt: '2026-10-01T00:00:00Z' }],
    })
  );
  localStorage.setItem('sa.activeStudentId.v1', 'local_old');
}

beforeEach(() => {
  localStorage.clear();
  // jsdom's AbortSignal is rejected by Node's Request, which React Router uses for every
  // client-side navigation; without this shim <Navigate>/navigate() silently do nothing here.
  const NativeRequest = globalThis.Request;
  vi.stubGlobal(
    'Request',
    class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        const { signal: _signal, ...rest } = init ?? {};
        void _signal;
        super(input, rest);
      }
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('T13 (a): no student-facing route or button can create a student', () => {
  const STUDENT_FACING = ['/', JOIN_PATH, '/students', '/settings', '/classes/3/subjects'];

  for (const hasSession of [false, true]) {
    for (const entry of STUDENT_FACING) {
      it(`${entry} (${hasSession ? 'with' : 'without'} session) has no name box or create-student button`, async () => {
        mockFetch(hasSession);
        const router = renderAt(entry);
        await waitFor(() => expect(screen.queryByText(/Loading/i)).toBeNull());
        await waitFor(() => expect(router.state.navigation.state).toBe('idle'));
        expect(document.querySelector('#student-name-input')).toBeNull();
        expect(screen.queryByRole('button', { name: /new student|புதிய மாணவர்|create student/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /who is learning/i })).toBeNull();
      });
    }
  }

  it('the student context and StudentService expose no way to create or switch to a local student', () => {
    let keys: string[] = [];
    function Probe() {
      keys = Object.keys(useStudent());
      return null;
    }
    mockFetch(false);
    render(
      <StudentProvider>
        <Probe />
      </StudentProvider>
    );
    expect(keys).not.toContain('createAndSelectStudent');
    expect(keys).not.toContain('selectStudent');
    expect(keys).not.toContain('deleteStudent');
    expect(keys).not.toContain('clearAllStudentsData');
    const proto = StudentService.prototype as unknown as Record<string, unknown>;
    expect(proto.createStudent).toBeUndefined();
    expect(proto.setActiveStudent).toBeUndefined();
    expect(proto.deleteStudent).toBeUndefined();
  });

  it('only admin code calls the student-creating endpoint, and nothing writes local student profiles', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
        const src = fs.readFileSync(full, 'utf8');
        if (src.includes("'/api/admin/students'") && !rel.startsWith('src/features/Admin/')) offenders.push(`${rel}: POST /api/admin/students`);
        if (/\.saveStudent\(/.test(src) && !/Repository\.ts$/.test(rel)) offenders.push(`${rel}: saveStudent()`);
      }
    };
    walk(path.resolve(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});

describe('T13 (b): learning pages need a server student session', () => {
  const LEARNING = [
    '/classes/3/subjects',
    '/classes/3/subjects/tamil',
    '/classes/3/subjects/english',
    '/classes/3/subjects/english/modules/1',
    '/session/3/tamil/setup',
    '/session/3/tamil/play?category=spelling-choice',
    '/session/results',
    '/subjects',
    '/classes',
  ];

  for (const entry of LEARNING) {
    it(`${entry} without a session redirects to the class-code page`, async () => {
      mockFetch(false);
      const router = renderAt(entry);
      await waitFor(() => expect(router.state.location.pathname).toBe(JOIN_PATH));
      // The location updates before React commits the new page, so wait for the page too.
      expect(await screen.findByText(/Ask your teacher for your class link/i)).toBeInTheDocument();
    });
  }

  it('an old local-only profile does not count as a session', async () => {
    seedLegacyLocalProfile();
    mockFetch(false);
    const router = renderAt('/classes/3/subjects');
    await waitFor(() => expect(router.state.location.pathname).toBe(JOIN_PATH));
    // Left in place, just unreachable.
    expect(localStorage.getItem('sa.students.v1')).toContain('local_old');
  });

  it('with a server session the learning page renders', async () => {
    mockFetch(true);
    const router = renderAt('/classes/3/subjects');
    await waitFor(() => expect(screen.getByText(/Choose Subject/i)).toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/classes/3/subjects');
  });
});

describe('T13 (c): every way in leads to the class-code page, and the code box opens /c/:code', () => {
  it('the old /students route redirects to the class-code page', async () => {
    mockFetch(false);
    const router = renderAt('/students');
    await waitFor(() => expect(router.state.location.pathname).toBe(JOIN_PATH));
  });

  it('"Start Learning" on the home page goes to the class-code page', async () => {
    mockFetch(false);
    const router = renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: /Start Learning/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe(JOIN_PATH));
  });

  it('the header student button goes to the class-code page', async () => {
    mockFetch(false);
    const router = renderAt('/settings');
    await userEvent.click(await screen.findByRole('button', { name: /select student/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe(JOIN_PATH));
  });

  it('page shows the bilingual prompt; the button stays disabled until 6 characters', async () => {
    mockFetch(false);
    renderAt(JOIN_PATH);
    expect(await screen.findByText(/உங்கள் ஆசிரியரிடம் வகுப்பு இணைப்பைக் கேளுங்கள்/)).toBeInTheDocument();
    const box = screen.getByRole('textbox', { name: /class code/i });
    const open = screen.getByRole('button', { name: /open class/i });
    await userEvent.type(box, 'ab3');
    expect(open).toBeDisabled();
  });

  it('typing a code (any case, spaces trimmed) and submitting opens /c/:CODE', async () => {
    mockFetch(false);
    const router = renderAt(JOIN_PATH);
    const box = await screen.findByRole('textbox', { name: /class code/i });
    await userEvent.type(box, ' ab3k7m ');
    await userEvent.click(screen.getByRole('button', { name: /open class/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/c/AB3K7M'));
  });
});

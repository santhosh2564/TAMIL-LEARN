import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute } from '../AdminRoute';
import { AuthProvider } from '../AuthContext';
import { AuthService } from '../AuthService';
import { AuthRepository } from '../AuthRepository';
import { AuthSession } from '../types';

class MockAuthRepository implements AuthRepository {
  private session: AuthSession | null = null;

  constructor(initialSession: AuthSession | null = null) {
    this.session = initialSession;
  }

  async getSession() {
    return this.session;
  }

  async saveSession(session: AuthSession) {
    this.session = session;
  }

  async clearSession() {
    this.session = null;
  }
}

describe('AdminRoute Protection & Authorization Guard', () => {
  it('redirects unauthorized users to /admin/login without rendering protected content', async () => {
    const unauthenticatedRepo = new MockAuthRepository(null);
    const authService = new AuthService(unauthenticatedRepo);

    render(
      <AuthProvider authServiceOverride={authService}>
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <Routes>
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <div data-testid="protected-admin-data">Confidential Admin Roster</div>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/login"
              element={<div data-testid="admin-login-screen">Admin Login Screen</div>}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Verify redirected to login screen
    await waitFor(() => {
      expect(screen.getByTestId('admin-login-screen')).toBeInTheDocument();
    });

    // Verify sensitive admin data was NOT rendered
    expect(screen.queryByTestId('protected-admin-data')).not.toBeInTheDocument();
  });

  it('renders protected children when authenticated as admin', async () => {
    const adminSession: AuthSession = {
      token: 'valid_tok_123',
      user: {
        id: 'usr_admin',
        username: 'admin',
        displayName: 'Administrator',
        role: 'admin',
      },
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };

    const authenticatedRepo = new MockAuthRepository(adminSession);
    const authService = new AuthService(authenticatedRepo);

    render(
      <AuthProvider authServiceOverride={authService}>
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <Routes>
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <div data-testid="protected-admin-data">Confidential Admin Roster</div>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/login"
              element={<div data-testid="admin-login-screen">Admin Login Screen</div>}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected-admin-data')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('admin-login-screen')).not.toBeInTheDocument();
  });
});

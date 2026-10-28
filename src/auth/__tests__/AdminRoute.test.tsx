import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute } from '../AdminRoute';
import { AuthProvider } from '../AuthContext';
import { AuthService } from '../AuthService';

/**
 * Provides a mock AuthService that returns a predetermined session state.
 * Since AuthService now talks to the server, we mock getSession().
 */
function makeMockAuthService(isAuthenticated: boolean): AuthService {
  const service = new AuthService();
  if (isAuthenticated) {
    vi.spyOn(service, 'getSession').mockResolvedValue({
      token: 'httponly-cookie',
      user: {
        id: 'usr_admin',
        username: 'admin',
        displayName: 'admin',
        role: 'admin',
      },
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  } else {
    vi.spyOn(service, 'getSession').mockResolvedValue(null);
  }
  return service;
}

describe('AdminRoute Protection & Authorization Guard', () => {
  it('redirects unauthorized users to /admin/login without rendering protected content', async () => {
    const authService = makeMockAuthService(false);

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
      expect(screen.getByTestId('admin-login-screen')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('protected-admin-data')).not.toBeInTheDocument();
  });

  it('renders protected children when authenticated as admin', async () => {
    const authService = makeMockAuthService(true);

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

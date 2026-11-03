import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppProvider } from '../providers/AppProvider';
import { App } from '../App';

describe('App Router Integration', () => {
  it('renders App inside AppProvider without nested router errors', async () => {
    expect(() => {
      render(
        <AppProvider>
          <App />
        </AppProvider>
      );
    }).not.toThrow();

    // Verify main landmark or brand header renders
    expect((await screen.findAllByRole('button', { name: 'TAMIL-LEARN Home' })).length).toBeGreaterThan(0);
  });
});

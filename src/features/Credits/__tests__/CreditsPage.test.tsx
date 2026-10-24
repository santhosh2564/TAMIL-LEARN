import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CreditsPage } from '../CreditsPage';

describe('CreditsPage', () => {
  it('renders the Image credits page with correct title and image count', () => {
    render(
      <MemoryRouter>
        <CreditsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Image credits / படங்களுக்கான நன்றி' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Image credits \/ படங்களுக்கான நன்றி/i })).toBeInTheDocument();
    expect(screen.getByText(/Credited Images/i)).toBeInTheDocument();
  });

  it('renders FTS0458 with thumbnail, word, creator, license name linked to license URL, and source link', () => {
    render(
      <MemoryRouter>
        <CreditsPage />
      </MemoryRouter>
    );

    // Check target word
    expect(screen.getAllByText('சேவல்').length).toBeGreaterThan(0);

    // Check creator
    expect(screen.getAllByText('Jorge Royan').length).toBeGreaterThan(0);

    // Check license link
    const licenseLinks = screen.getAllByRole('link', { name: /CC BY-SA 3.0/i });
    expect(licenseLinks.length).toBeGreaterThan(0);
    const ftsLicenseLink = licenseLinks.find(link => link.getAttribute('href') === 'https://creativecommons.org/licenses/by-sa/3.0/');
    expect(ftsLicenseLink).toBeDefined();

    // Check source link
    const sourceLinks = screen.getAllByRole('link', { name: /Source/i });
    expect(sourceLinks.length).toBeGreaterThan(0);
  });

  it('filters credits when searching by word or creator', () => {
    render(
      <MemoryRouter>
        <CreditsPage />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search by word, creator, or license/i);
    fireEvent.change(searchInput, { target: { value: 'Jorge Royan' } });

    expect(screen.getByText('சேவல்')).toBeInTheDocument();
    expect(screen.getByText(/Found 1 matching image/i)).toBeInTheDocument();
  });
});

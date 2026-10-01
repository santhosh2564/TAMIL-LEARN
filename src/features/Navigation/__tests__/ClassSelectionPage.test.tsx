import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClassSelectionPage } from '../ClassSelectionPage';

describe('ClassSelectionPage', () => {
  it('renders class 3 as available and others as coming soon', () => {
    render(
      <MemoryRouter initialEntries={['/classes']}>
        <Routes>
          <Route path="/classes" element={<ClassSelectionPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Class 3 should be available
    expect(screen.getByText('வகுப்பு 3')).toBeInTheDocument();
    
    // Classes 1,2,4,5 should have "Coming Soon"
    const comingSoonElements = screen.getAllByText('விரைவில்');
    expect(comingSoonElements.length).toBe(4);
  });
});

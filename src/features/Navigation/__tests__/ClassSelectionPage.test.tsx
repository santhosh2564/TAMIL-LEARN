import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClassSelectionPage } from '../ClassSelectionPage';

describe('ClassSelectionPage', () => {
  it('redirects directly to subjects page', () => {
    render(
      <MemoryRouter initialEntries={['/classes']}>
        <Routes>
          <Route path="/classes" element={<ClassSelectionPage />} />
          <Route path="/classes/3/subjects" element={<div>Subjects Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Subjects Page')).toBeInTheDocument();
  });
});

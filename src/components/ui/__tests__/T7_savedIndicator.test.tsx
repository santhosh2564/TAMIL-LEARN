import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncStatusIndicator } from '../SyncStatusIndicator';

describe('T7: Saved indicator shows "Saved" ONLY when this students outbox is empty', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders "Saved" when outbox has 0 pending items for active student', () => {
    render(<SyncStatusIndicator studentId="student-A" pendingCount={0} isOnline={true} />);

    // Should indicate Saved
    expect(screen.getByText(/Saved|சேமிக்கப்பட்டது/i)).toBeInTheDocument();
  });

  it('does NOT render "Saved" when outbox has pending items for this student (shows Saving or Saved to computer)', () => {
    // Online with 2 pending outbox items
    const { rerender } = render(
      <SyncStatusIndicator studentId="student-A" pendingCount={2} isOnline={true} />
    );

    expect(screen.queryByText(/^(Saved|சேமிக்கப்பட்டது)$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Saving|சேமிக்கப்படுகிறது/i)).toBeInTheDocument();

    // Offline with pending outbox items
    rerender(<SyncStatusIndicator studentId="student-A" pendingCount={2} isOnline={false} />);
    expect(screen.queryByText(/^(Saved|சேமிக்கப்பட்டது)$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Saved to this computer|கணினியில் சேமிக்கப்பட்டது/i)).toBeInTheDocument();
  });
});

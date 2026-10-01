import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ActivityAsset } from '../ActivityAsset';

// Mock the resolver to return deterministic states
const mockResolve = vi.fn();

vi.mock('../../../../engine/assets', () => ({
  AssetResolver: vi.fn().mockImplementation(() => ({
    resolve: mockResolve
  }))
}));

describe('ActivityAsset', () => {
  it('renders a missing state when asset is missing', () => {
    mockResolve.mockReturnValue({ status: 'missing', id: 'missing-id' });
    render(<ActivityAsset assetRef={{ id: 'missing-id', type: 'image' }} />);
    expect(screen.getByText('படம் கிடைக்கவில்லை')).toBeInTheDocument();
  });

  it('renders an invalid state when asset is invalid', () => {
    mockResolve.mockReturnValue({ status: 'invalid', id: 'invalid-id', reason: 'Unsafe path' });
    render(<ActivityAsset assetRef={{ id: 'invalid-id', type: 'image' }} />);
    expect(screen.getByText('படத்தை ஏற்ற முடியவில்லை')).toBeInTheDocument();
  });

  it('renders an image when successfully resolved', () => {
    mockResolve.mockReturnValue({ 
      status: 'resolved', 
      asset: { id: 'valid-img', type: 'image', source: 'local', path: '/foo.webp', alt: 'Foo image' } 
    });
    render(<ActivityAsset assetRef={{ id: 'valid-img', type: 'image' }} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/foo.webp');
    expect(img).toHaveAttribute('alt', 'Foo image');
  });

  it('renders an audio placeholder when audio is resolved', () => {
    mockResolve.mockReturnValue({ 
      status: 'resolved', 
      asset: { id: 'valid-audio', type: 'audio', source: 'local', path: '/foo.mp3' } 
    });
    render(<ActivityAsset assetRef={{ id: 'valid-audio', type: 'audio' }} />);
    expect(screen.getByText('Audio Asset Resolved (UI Pending)')).toBeInTheDocument();
  });
});

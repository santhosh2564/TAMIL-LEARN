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

  it('renders a photo credit line for CC-BY-SA images', () => {
    mockResolve.mockReturnValue({
      status: 'resolved',
      asset: {
        id: 'class3-tamil-picture-fts0458',
        type: 'image',
        source: 'local',
        path: '/images/tamil-vocabulary/Module_4/picture_to_select/FTS0458.jpg',
        alt: 'சேவல்',
        creator: 'Jorge Royan',
        license: 'cc-by-sa-3.0'
      }
    });
    render(
      <ActivityAsset
        assetRef={{ id: 'class3-tamil-picture-fts0458', type: 'image' }}
        creator="Jorge Royan"
        license="cc-by-sa-3.0"
      />
    );
    expect(screen.getByTestId('activity-asset-credit')).toBeInTheDocument();
    expect(screen.getByText('Photo: Jorge Royan, CC BY-SA 3.0')).toBeInTheDocument();
  });

  it('renders photo credit from resolved asset metadata when props are not passed', () => {
    mockResolve.mockReturnValue({
      status: 'resolved',
      asset: {
        id: 'cc-img',
        type: 'image',
        source: 'local',
        path: '/test.jpg',
        creator: 'Harrison Keely',
        license: 'cc-by-4.0'
      }
    });
    render(<ActivityAsset assetRef={{ id: 'cc-img', type: 'image' }} />);
    expect(screen.getByText('Photo: Harrison Keely, CC BY 4.0')).toBeInTheDocument();
  });

  it('does not render credit line for public domain or cc0 images', () => {
    mockResolve.mockReturnValue({
      status: 'resolved',
      asset: {
        id: 'pd-img',
        type: 'image',
        source: 'local',
        path: '/test.jpg',
        creator: 'Anonymous',
        license: 'cc0'
      }
    });
    render(<ActivityAsset assetRef={{ id: 'pd-img', type: 'image' }} />);
    expect(screen.queryByTestId('activity-asset-credit')).not.toBeInTheDocument();
  });
});

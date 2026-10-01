import { useState, useEffect, useMemo } from 'react';
import { Image as ImageIcon, AlertTriangle, HelpCircle } from 'lucide-react';
import { AssetReference, AssetResolver, AssetResolutionState } from '../../../engine/assets';

interface ActivityAssetProps {
  assetRef: AssetReference;
}

export function ActivityAsset({ assetRef }: ActivityAssetProps) {
  const [resolution, setResolution] = useState<AssetResolutionState | null>(null);
  const resolver = useMemo(() => new AssetResolver(), []);

  useEffect(() => {
    // For local resolution this is synchronous, but we keep standard async-compatible lifecycle
    const state = resolver.resolve(assetRef);
    setResolution(state);
  }, [assetRef, resolver]);

  if (!resolution) {
    return (
      <div className="w-full aspect-video max-w-sm mx-auto bg-surface-raised rounded-2xl flex items-center justify-center animate-pulse">
        <ImageIcon className="w-8 h-8 opacity-20" />
      </div>
    );
  }

  if (resolution.status === 'resolved') {
    const { asset } = resolution;
    if (asset.type === 'image') {
      return (
        <div className="w-full aspect-video max-w-sm mx-auto bg-white rounded-2xl border-2 border-surface-raised overflow-hidden relative">
          <img 
            src={asset.path} 
            alt={asset.alt || 'Activity Image'} 
            className="w-full h-full object-contain"
          />
        </div>
      );
    }
    // Future: Audio support UI placeholder
    return (
      <div className="w-full h-16 max-w-sm mx-auto bg-surface-raised rounded-2xl flex items-center justify-center">
        <p className="text-sm font-bold opacity-50">Audio Asset Resolved (UI Pending)</p>
      </div>
    );
  }

  if (resolution.status === 'missing') {
    return (
      <div className="w-full aspect-video max-w-sm mx-auto bg-surface-raised rounded-2xl border-2 border-dashed border-text-muted/30 flex flex-col items-center justify-center p-6 text-text-muted">
        <HelpCircle className="w-12 h-12 mb-3 opacity-50 text-secondary-500" />
        <p className="font-bold text-center">படம் கிடைக்கவில்லை</p>
        <p className="text-xs text-center mt-1 opacity-70">தற்காலிகமாக இது காட்டப்படுகிறது.</p>
      </div>
    );
  }

  if (resolution.status === 'invalid') {
    return (
      <div className="w-full aspect-video max-w-sm mx-auto bg-error/10 rounded-2xl border-2 border-dashed border-error/30 flex flex-col items-center justify-center p-6 text-error">
        <AlertTriangle className="w-12 h-12 mb-3 opacity-80" />
        <p className="font-bold text-center">படத்தை ஏற்ற முடியவில்லை</p>
      </div>
    );
  }

  return null;
}

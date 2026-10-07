import { useState, useEffect, useMemo } from 'react';
import { Image as ImageIcon, AlertTriangle, HelpCircle } from 'lucide-react';
import { AssetReference, AssetResolver, AssetResolutionState } from '../../../engine/assets';

interface ActivityAssetProps {
  assetRef: AssetReference;
  language?: 'tamil' | 'english';
  alt?: string;
}

export function ActivityAsset({ assetRef, language, alt }: ActivityAssetProps) {
  const [resolution, setResolution] = useState<AssetResolutionState | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const resolver = useMemo(() => new AssetResolver(), []);
  const isEnglish = language === 'english' || assetRef.id.startsWith('eng-') || assetRef.id.startsWith('english-');

  useEffect(() => {
    // For local resolution this is synchronous, but we keep standard async-compatible lifecycle
    const state = resolver.resolve(assetRef);
    setResolution(state);
    setLoadFailed(false);
  }, [assetRef, resolver]);

  if (!resolution) {
    return (
      <div className="w-full aspect-video max-w-sm mx-auto bg-surface-raised rounded-2xl flex items-center justify-center animate-pulse">
        <ImageIcon className="w-8 h-8 opacity-20" />
      </div>
    );
  }

  if (resolution.status === 'resolved' && !loadFailed) {
    const { asset } = resolution;
    if (asset.type === 'image') {
      const altText = alt || asset.alt || (isEnglish ? 'Activity illustration' : 'செயல்பாட்டுப் படம்');
      return (
        <div className="w-full aspect-video max-w-sm mx-auto bg-white rounded-2xl border-2 border-surface-raised overflow-hidden relative shadow-sm">
          <img
            src={asset.path}
            alt={altText}
            className="w-full h-full object-contain"
            data-testid="activity-asset-image"
            onError={() => setLoadFailed(true)}
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
      <div 
        className="w-full aspect-video max-w-sm mx-auto bg-surface-raised rounded-2xl border-2 border-dashed border-text-muted/30 flex flex-col items-center justify-center p-6 text-text-muted"
        data-testid="asset-fallback-missing"
        role="img"
        aria-label={isEnglish ? "Image not available placeholder" : "படம் கிடைக்கவில்லை"}
      >
        <HelpCircle className="w-12 h-12 mb-3 opacity-50 text-secondary-500" />
        <p className="font-bold text-center">
          {isEnglish ? 'Image Not Available' : 'படம் கிடைக்கவில்லை'}
        </p>
        <p className="text-xs text-center mt-1 opacity-70">
          {isEnglish ? 'A placeholder is shown temporarily.' : 'தற்காலிகமாக இது காட்டப்படுகிறது.'}
        </p>
      </div>
    );
  }

  if (resolution.status === 'invalid' || loadFailed) {
    return (
      <div 
        className="w-full aspect-video max-w-sm mx-auto bg-error/10 rounded-2xl border-2 border-dashed border-error/30 flex flex-col items-center justify-center p-6 text-error"
        data-testid="asset-fallback-invalid"
        role="alert"
        aria-label={isEnglish ? "Could not load image" : "படத்தை ஏற்ற முடியவில்லை"}
      >
        <AlertTriangle className="w-12 h-12 mb-3 opacity-80" />
        <p className="font-bold text-center">
          {isEnglish ? 'Could Not Load Image' : 'படத்தை ஏற்ற முடியவில்லை'}
        </p>
      </div>
    );
  }

  return null;
}

import { useState, useMemo } from 'react';
import { Page } from '../../components/ui/Page';
import { BackButton } from '../../components/ui/BackButton';
import { Search, ExternalLink, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import creditsData from '../../content/image-credits.json';

export interface ImageCreditItem {
  id: string;
  word: string;
  path: string;
  creator: string;
  license: string;
  licenseName: string;
  licenseUrl: string;
  sourcePageUrl: string;
}

export function CreditsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const credits = creditsData as ImageCreditItem[];

  const filteredCredits = useMemo(() => {
    if (!searchTerm.trim()) return credits;
    const term = searchTerm.trim().toLowerCase();
    return credits.filter(
      item =>
        item.word.toLowerCase().includes(term) ||
        item.creator.toLowerCase().includes(term) ||
        item.licenseName.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term)
    );
  }, [credits, searchTerm]);

  return (
    <Page>
      <div className="max-w-6xl mx-auto space-y-8 py-4 sm:py-8">
        {/* Header */}
        <div className="space-y-4">
          <BackButton />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-text">
                Image credits / படங்களுக்கான நன்றி
              </h1>
              <p className="text-text-muted text-sm sm:text-base mt-1">
                Images used under Creative Commons attribution licenses across Tamil learning activities.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-200 text-primary-800 text-sm font-semibold self-start md:self-auto">
              <ShieldCheck className="w-4 h-4 text-primary-600" />
              <span>{credits.length} Credited Images</span>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by word, creator, or license..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-highlight bg-surface-raised text-text placeholder:text-text-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
        </div>

        {/* Results summary if searching */}
        {searchTerm.trim() && (
          <p className="text-xs sm:text-sm text-text-muted">
            Found {filteredCredits.length} matching {filteredCredits.length === 1 ? 'image' : 'images'}.
          </p>
        )}

        {/* Images Grid */}
        {filteredCredits.length === 0 ? (
          <div className="text-center py-16 bg-surface-raised rounded-3xl border border-surface-highlight p-8">
            <ImageIcon className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
            <h3 className="text-lg font-bold text-text">No images found</h3>
            <p className="text-sm text-text-muted mt-1">Try another search keyword.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCredits.map(item => (
              <div
                key={item.path}
                className="bg-surface-raised border border-surface-highlight rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Thumbnail */}
                <div className="w-full aspect-[4/3] bg-white relative overflow-hidden border-b border-surface-highlight flex items-center justify-center p-2">
                  <img
                    src={item.path}
                    alt={item.word}
                    loading="lazy"
                    className="w-full h-full object-contain"
                    onError={e => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Info */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-lg font-bold text-text font-display">{item.word}</h2>
                      <span className="text-[11px] font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded border border-surface-highlight">
                        {item.id}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      <span className="font-medium text-text">Creator: </span>
                      <span className="font-normal">{item.creator || 'Not specified'}</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-surface-highlight/60 flex items-center justify-between text-xs gap-2">
                    <a
                      href={item.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary-600 hover:text-primary-800 hover:underline inline-flex items-center gap-1"
                      title={`View ${item.licenseName} license terms`}
                    >
                      {item.licenseName}
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>

                    {item.sourcePageUrl && (
                      <a
                        href={item.sourcePageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-muted hover:text-text hover:underline inline-flex items-center gap-1 text-[11px]"
                        title="View original Wikimedia source page"
                      >
                        Source
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

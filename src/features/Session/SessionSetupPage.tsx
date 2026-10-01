import { useState, useEffect } from 'react';
import { Page } from '../../components/ui/Page';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LocalContentRepository } from '../../repositories/implementations/LocalContentRepository';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { ActivityCategory } from '../../types';

export function SessionSetupPage() {
  const { classId, subjectId } = useParams<{ classId: string; subjectId: string }>();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') as ActivityCategory | null;
  const navigate = useNavigate();

  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [size, setSize] = useState<number>(10);
  const [level, setLevel] = useState<number | 'all'>('all');

  useEffect(() => {
    async function checkAvailability() {
      setIsLoading(true);
      try {
        const repo = new LocalContentRepository();
        const count = await repo.getActivityCount({
          classLevel: Number(classId),
          subject: subjectId === 'tamil' ? 'Tamil' : subjectId,
          category: category || undefined,
          level: level === 'all' ? undefined : level
        });
        setAvailableCount(count);
      } catch {
        setError('உள்ளடக்கத்தைச் சரிபார்க்க முடியவில்லை.');
      } finally {
        setIsLoading(false);
      }
    }
    checkAvailability();
  }, [classId, subjectId, category, level]);

  const handleStart = () => {
    let url = `/session/${classId}/${subjectId}/play?size=${size}`;
    if (category) url += `&category=${category}`;
    if (level !== 'all') url += `&level=${level}`;
    navigate(url);
  };

  if (isLoading && availableCount === null) {
    return <Page><LoadingState message="உள்ளடக்கம் சரிபார்க்கப்படுகிறது..." /></Page>;
  }

  if (error) {
    return <Page><ErrorState message={error} onRetry={() => window.location.reload()} /></Page>;
  }

  const title = category ? 'வகைப் பயிற்சி' : 'கலப்பு பயிற்சி';

  return (
    <Page>
      <div className="max-w-2xl mx-auto py-12 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-display font-bold text-text">{title}</h1>
          <p className="text-xl text-text-muted">உங்கள் பயிற்சி அமைப்பைத் தேர்ந்தெடுக்கவும்</p>
        </div>

        <div className="bg-surface-raised p-8 rounded-[32px] space-y-8">
          
          {/* Level Selection */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-text">கடின நிலை</h2>
            <div className="flex flex-wrap gap-4">
              {['all', 1, 2, 3].map(opt => (
                <button
                  key={opt}
                  className={`px-6 py-3 rounded-2xl font-bold transition-all ${
                    level === opt 
                      ? 'bg-primary-500 text-white shadow-button'
                      : 'bg-surface text-text hover:bg-surface-highlight'
                  }`}
                  onClick={() => setLevel(opt as number | 'all')}
                >
                  {opt === 'all' ? 'அனைத்து நிலைகளும்' : `நிலை ${opt}`}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-text">செயல்களின் எண்ணிக்கை</h2>
            <div className="flex flex-wrap gap-4">
              {[5, 10, 'all'].map(opt => (
                <button
                  key={opt}
                  className={`px-6 py-3 rounded-2xl font-bold transition-all ${
                    size === opt || (opt === 'all' && size === 9999)
                      ? 'bg-primary-500 text-white shadow-button'
                      : 'bg-surface text-text hover:bg-surface-highlight'
                  }`}
                  onClick={() => setSize(opt === 'all' ? 9999 : opt as number)}
                >
                  {opt === 'all' ? 'அனைத்தும்' : opt}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-surface-highlight flex items-center justify-between">
            <div className="text-text-muted">
              <span className="font-bold text-text">{availableCount}</span> செயல்கள் உள்ளன
            </div>
            <Button 
              onClick={handleStart} 
              disabled={availableCount === 0 || isLoading}
            >
              பயிற்சியைத் தொடங்கு
            </Button>
          </div>
        </div>
      </div>
    </Page>
  );
}

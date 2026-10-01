import { useState, useEffect } from 'react';
import { Page } from '../../components/ui/Page';
import { CategoryCard, CategoryPresentation } from '../../components/domain/CategoryCard';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { LocalContentRepository } from '../../repositories/implementations/LocalContentRepository';
import { ActivityCategory } from '../../types';
import { Image, Puzzle, Blocks, BookOpen, PenTool, Languages } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProgressService, LocalProgressRepository, CategoryProgress } from '../../progress';

const PRESENTATION_MAP: Record<ActivityCategory, Omit<CategoryPresentation, 'id'>> = {
  'picture-recognition': {
    title: 'படம் பார்த்து சொல்',
    description: 'படங்களைப் பார்த்து தமிழ்ச் சொற்களைக் கற்க',
    icon: <Image size={32} />
  },
  'word-completion': {
    title: 'சொல் நிரப்புக',
    description: 'விடுபட்ட எழுத்தைக் கண்டறிக',
    icon: <Puzzle size={32} />
  },
  'arrange-word': {
    title: 'சொல் உருவாக்குக',
    description: 'எழுத்துகளை ஒழுங்குபடுத்தி சொல் உருவாக்குக',
    icon: <Blocks size={32} />
  },
  'spelling-choice': {
    title: 'சரியான எழுத்துக்கூட்டல்',
    description: 'சொல்லின் சரியான எழுத்துக்கூட்டலைத் தேர்ந்தெடுக்க',
    icon: <BookOpen size={32} />
  },
  'context-choice': {
    title: 'வாக்கியப் பயிற்சி',
    description: 'சரியான சொல்லைக் கொண்டு வாக்கியத்தை நிரப்புக',
    icon: <PenTool size={32} />
  },
  'meaning-match': {
    title: 'பொருள் அறிவோம்',
    description: 'ஆங்கிலப் பொருளுக்குரிய தமிழ்ச் சொல்லைத் தேர்ந்தெடுக்க',
    icon: <Languages size={32} />
  }
};

const ALL_CATEGORIES: ActivityCategory[] = [
  'picture-recognition',
  'word-completion',
  'arrange-word',
  'spelling-choice',
  'context-choice',
  'meaning-match',
];

export function LearningAreaPage() {
  const { classId, subjectId } = useParams<{ classId: string; subjectId: string }>();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<ActivityCategory, number> | null>(null);
  const [progressByCategory, setProgressByCategory] = useState<Record<ActivityCategory, CategoryProgress> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const repo = new LocalContentRepository();
      const progressService = new ProgressService(new LocalProgressRepository());
      
      const newCounts = {} as Record<ActivityCategory, number>;
      const newProgress = {} as Record<ActivityCategory, CategoryProgress>;
      
      for (const cat of ALL_CATEGORIES) {
        const count = await repo.getActivityCount({ 
          classLevel: Number(classId), 
          subject: subjectId === 'tamil' ? 'Tamil' : subjectId,
          category: cat 
        });
        newCounts[cat] = count;
        newProgress[cat] = await progressService.getCategoryProgress(cat, count);
      }
      
      setCounts(newCounts);
      setProgressByCategory(newProgress);
      setIsLoading(false);
    }
    
    loadData();
  }, [classId, subjectId]);

  if (isLoading) {
    return <Page><LoadingState message="கற்றல் பகுதி ஏற்றப்படுகிறது..." /></Page>;
  }

  const hasContent = counts && Object.values(counts).some(count => count > 0);

  if (!hasContent) {
    return (
      <Page>
        <EmptyState 
          title="இங்கு இன்னும் உள்ளடக்கம் இல்லை" 
          message={`வகுப்பு ${classId} ${subjectId} பாடத்திற்கான செயல்பாடுகள் தயாராகி வருகின்றன.`} 
        />
      </Page>
    );
  }

  return (
    <Page>
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text">தமிழ் கற்றல் பகுதி</h1>
          <p className="text-xl text-text-muted">இன்று நீங்கள் பயில விரும்பும் பகுதியைப் தேர்ந்தெடுக்கவும்</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
          <div 
            className="col-span-1 md:col-span-2 lg:col-span-3 bg-primary-50 p-8 rounded-3xl border-2 border-primary-200 hover:border-primary-400 cursor-pointer transition-all flex items-center justify-between"
            onClick={() => navigate(`/session/${classId}/${subjectId}/setup`)}
          >
            <div>
              <h2 className="text-2xl font-bold text-primary-900">கலப்பு பயிற்சி</h2>
              <p className="text-primary-700 mt-1">அனைத்துப் பகுதிகளிலிருந்தும் கலந்து பயிற்சி செய்ய</p>
            </div>
            <div className="bg-primary-500 text-white font-bold py-3 px-6 rounded-2xl shadow-button">
              தொடங்கு
            </div>
          </div>

          {(Object.entries(PRESENTATION_MAP) as [ActivityCategory, Omit<CategoryPresentation, 'id'>][]).map(([id, pres]) => {
            const count = counts?.[id] || 0;
            if (count === 0) return null;
            
            const catProgress = progressByCategory?.[id];
            const completedCount = catProgress?.completed ?? 0;
            
            return (
              <CategoryCard 
                key={id}
                presentation={{ id, ...pres }}
                activityCount={count}
                completedCount={completedCount}
                onClick={(cat) => navigate(`/session/${classId}/${subjectId}/setup?category=${cat}`)}
              />
            );
          })}
        </div>
      </div>
    </Page>
  );
}

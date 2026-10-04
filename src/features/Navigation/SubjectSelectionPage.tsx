import { Page } from '../../components/ui/Page';
import { SubjectCard } from '../../components/domain/SubjectCard';
import { useNavigate, useParams } from 'react-router-dom';

export function SubjectSelectionPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  
  const subjects = [
    { id: 'tamil', name: 'Tamil', nativeName: 'தமிழ்', isAvailable: true },
    { id: 'english', name: 'English', nativeName: 'English', isAvailable: classId === '3' },
    { id: 'maths', name: 'Mathematics', nativeName: 'கணிதம்', isAvailable: false },
    { id: 'evs', name: 'EVS', nativeName: 'சூழ்நிலையியல்', isAvailable: false },
    { id: 'science', name: 'Science', nativeName: 'அறிவியல்', isAvailable: false },
  ];

  return (
    <Page>
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text">Class {classId} Subjects</h1>
          <p className="text-xl text-text-muted">What would you like to learn today?</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-stretch gap-6 pt-8 max-w-3xl mx-auto">
          {subjects.filter(s => ['tamil', 'english'].includes(s.id)).map(s => (
            <SubjectCard 
              key={s.id} 
              subject={s.name}
              nativeName={s.nativeName}
              isAvailable={s.isAvailable}
              onClick={() => navigate(`/classes/${classId}/subjects/${s.id}`)}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}

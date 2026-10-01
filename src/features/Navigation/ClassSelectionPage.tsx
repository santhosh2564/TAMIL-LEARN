import { Page } from '../../components/ui/Page';
import { ClassCard } from '../../components/domain/ClassCard';
import { useNavigate } from 'react-router-dom';

export function ClassSelectionPage() {
  const navigate = useNavigate();
  const classes = [1, 2, 3, 4, 5];

  return (
    <Page>
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text">வகுப்பைத் தேர்ந்தெடுக்கவும்</h1>
          <p className="text-xl text-text-muted">பாடங்களைக் காண உங்கள் வகுப்பைத் தேர்ந்தெடுக்கவும்</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 pt-8">
          {classes.map(level => (
            <ClassCard 
              key={level} 
              level={level} 
              isAvailable={level === 3}
              onClick={(l) => navigate(`/classes/${l}/subjects`)}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}

import { Page } from '../../components/ui/Page';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <Page className="flex flex-col items-center justify-center text-center">
      <div className="max-w-2xl space-y-12 py-12">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-7xl font-display text-primary-600 font-extrabold drop-shadow-sm">
            தமிழ் கற்போம்!
          </h1>
          <h2 className="text-3xl md:text-4xl font-display text-text font-bold">
            Let's Learn Tamil
          </h2>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-6">
          <Button 
            size="large" 
            variant="primary"
            onClick={() => navigate('/classes/3/subjects/tamil')}
            className="w-full sm:w-auto text-2xl font-bold px-12 py-6 rounded-full shadow-lg"
          >
            Start Learning
          </Button>
          
          <Button 
            size="large" 
            variant="secondary"
            onClick={() => navigate('/classes')}
            className="w-full sm:w-auto text-xl font-bold px-8 py-5 rounded-full"
          >
            Choose Class
          </Button>
        </div>
      </div>
    </Page>
  );
}

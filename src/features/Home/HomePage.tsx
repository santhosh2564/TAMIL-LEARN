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
            Learn. Play. Grow.
          </h1>
          <h2 className="text-2xl md:text-3xl font-display text-text font-bold">
            Explore தமிழ் and English through playful activities.
          </h2>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-6">
          <Button 
            size="large" 
            variant="primary"
            onClick={() => navigate('/classes/3/subjects')}
            className="w-full sm:w-auto text-2xl font-bold px-12 py-6 rounded-full shadow-lg"
          >
            Start Learning
          </Button>
        </div>
      </div>
    </Page>
  );
}

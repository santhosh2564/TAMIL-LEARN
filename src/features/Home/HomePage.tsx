import { Page } from '../../components/ui/Page';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useStudent } from '../../student';
import { Users } from 'lucide-react';

export function HomePage() {
  const navigate = useNavigate();
  const { activeStudent } = useStudent();

  const handleStart = () => {
    if (activeStudent) {
      navigate('/classes/3/subjects');
    } else {
      navigate('/students');
    }
  };

  return (
    <Page className="flex flex-col items-center justify-center text-center">
      <div className="max-w-2xl space-y-10 py-12">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-7xl font-display text-primary-600 font-extrabold drop-shadow-sm">
            Learn. Play. Grow.
          </h1>
          <h2 className="text-2xl md:text-3xl font-display text-text font-bold">
            Explore தமிழ் and English through playful activities.
          </h2>
        </div>

        {activeStudent && (
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-primary-50 border border-primary-200">
            <span className="text-text-muted font-medium">Learning as:</span>
            <span className="text-primary-700 font-bold text-lg">{activeStudent.name}</span>
            <button
              onClick={() => navigate('/students')}
              className="ml-2 text-sm text-primary-600 hover:text-primary-800 underline font-semibold cursor-pointer"
            >
              Switch
            </button>
          </div>
        )}

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="large"
            variant="primary"
            onClick={handleStart}
            className="w-full sm:w-auto text-2xl font-bold px-12 py-6 rounded-full shadow-lg"
          >
            Start Learning
          </Button>

          {!activeStudent ? (
            <Button
              size="large"
              variant="secondary"
              onClick={() => navigate('/students')}
              className="w-full sm:w-auto text-xl font-bold px-8 py-6 rounded-full"
            >
              <Users className="w-5 h-5 mr-2" /> Who is Learning?
            </Button>
          ) : (
            <Button
              size="large"
              variant="secondary"
              onClick={() => navigate('/students')}
              className="w-full sm:w-auto text-xl font-bold px-8 py-6 rounded-full"
            >
              <Users className="w-5 h-5 mr-2" /> Switch Student
            </Button>
          )}
        </div>
      </div>
    </Page>
  );
}

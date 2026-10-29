import { Page } from '../../components/ui/Page';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useStudent, CLASS_CODE_PATH } from '../../student';

export function HomePage() {
  const navigate = useNavigate();
  const { activeStudent } = useStudent();

  // Students join through their class link; a child already in a session goes straight to learning.
  const handleStart = () => {
    navigate(activeStudent ? '/classes/3/subjects' : CLASS_CODE_PATH);
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
        </div>
      </div>
    </Page>
  );
}

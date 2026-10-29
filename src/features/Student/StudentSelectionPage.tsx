import { useNavigate, useLocation } from 'react-router-dom';
import { Page } from '../../components/ui/Page';
import { StudentSelectionView } from './StudentSelectionView';

export function StudentSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string })?.from || '/classes/3/subjects';

  const handleSuccess = () => {
    navigate(from, { replace: true });
  };

  return (
    <Page hideHeader={false} className="flex flex-col items-center justify-center min-h-[75vh]">
      <StudentSelectionView onSuccess={handleSuccess} />
    </Page>
  );
}

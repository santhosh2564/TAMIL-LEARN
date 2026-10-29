import { Navigate, Outlet } from 'react-router-dom';
import { useStudent } from './useStudent';
import { LoadingState } from '../components/ui/LoadingState';

export const CLASS_CODE_PATH = '/join';

/**
 * Guards learning pages: they need a server student session (restored from
 * /api/student/session). Without one, the child is sent to the class-code page.
 */
export function RequireStudent() {
  const { activeStudent, isLoading } = useStudent();

  if (isLoading) {
    return <LoadingState message="ஏற்றுகிறது... / Loading..." />;
  }
  if (!activeStudent) {
    return <Navigate to={CLASS_CODE_PATH} replace />;
  }
  return <Outlet />;
}

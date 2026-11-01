import { Navigate, Outlet } from 'react-router-dom';
import { useStudent } from './useStudent';
import { LoadingState } from '../components/ui/LoadingState';

export const STUDENT_LOGIN_PATH = '/';
export const CLASS_CODE_PATH = '/'; // backwards compat for any remaining imports

/**
 * Guards learning pages: they need a server student session (restored from
 * /api/student/session). Without one, the child is sent to the student screen.
 */
export function RequireStudent() {
  const { activeStudent, isLoading } = useStudent();

  if (isLoading) {
    return <LoadingState message="ஏற்றுகிறது... / Loading..." />;
  }
  if (!activeStudent) {
    return <Navigate to={STUDENT_LOGIN_PATH} replace />;
  }
  return <Outlet />;
}

import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { StudentProvider } from '../student';
import { AuthProvider } from '../auth';

export const App = () => {
  return (
    <AuthProvider>
      <StudentProvider>
        <RouterProvider router={router} />
      </StudentProvider>
    </AuthProvider>
  );
};

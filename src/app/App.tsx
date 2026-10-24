import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { StudentProvider } from '../student';

export const App = () => {
  return (
    <StudentProvider>
      <RouterProvider router={router} />
    </StudentProvider>
  );
};

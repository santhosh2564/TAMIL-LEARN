import { createBrowserRouter } from 'react-router-dom';

// Features
import { HomePage } from '../features/Home/HomePage';
import { ClassSelectionPage } from '../features/Navigation/ClassSelectionPage';
import { SubjectSelectionPage } from '../features/Navigation/SubjectSelectionPage';
import { LearningAreaPage } from '../features/Navigation/LearningAreaPage';
import { EnglishLearningAreaPage } from '../features/Navigation/EnglishLearningAreaPage';
import { EnglishModuleDetailPage } from '../features/Navigation/EnglishModuleDetailPage';
import { SessionPage } from '../features/Session/SessionPage';
import { SessionSetupPage } from '../features/Session/SessionSetupPage';
import { ResultsPage } from '../features/Session/ResultsPage';
import { SettingsPage } from '../features/Settings/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <div className="p-8 text-center text-red-500 font-bold">App Error</div>,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'classes',
        element: <ClassSelectionPage />,
      },
      {
        path: 'classes/:classId/subjects',
        element: <SubjectSelectionPage />,
      },
      {
        path: 'classes/:classId/subjects/english',
        element: <EnglishLearningAreaPage />,
      },
      {
        path: 'classes/:classId/subjects/english/modules/:moduleId',
        element: <EnglishModuleDetailPage />,
      },
      {
        path: 'classes/:classId/subjects/:subjectId',
        element: <LearningAreaPage />,
      },
      {
        path: 'session/:classId/:subjectId/setup',
        element: <SessionSetupPage />,
      },
      {
        path: 'session/:classId/:subjectId/play',
        element: <SessionPage />,
      },
      {
        path: 'session/results',
        element: <ResultsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <div className="p-8 text-center font-bold text-xl">404 - Not Found</div>,
      },
    ],
  },
]);

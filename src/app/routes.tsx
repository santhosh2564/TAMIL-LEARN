import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';

// Features
import { HomePage } from '../features/Home/HomePage';
import { SubjectSelectionPage } from '../features/Navigation/SubjectSelectionPage';
import { LearningAreaPage } from '../features/Navigation/LearningAreaPage';
import { EnglishLearningAreaPage } from '../features/Navigation/EnglishLearningAreaPage';
import { EnglishModuleDetailPage } from '../features/Navigation/EnglishModuleDetailPage';
import { TamilLearningAreaPage } from '../features/Navigation/TamilLearningAreaPage';
import { TamilModuleDetailPage } from '../features/Navigation/TamilModuleDetailPage';
import { SessionPage } from '../features/Session/SessionPage';
import { SessionSetupPage } from '../features/Session/SessionSetupPage';
import { ResultsPage } from '../features/Session/ResultsPage';
import { SettingsPage } from '../features/Settings/SettingsPage';
import { StudentSelectionPage } from '../features/Student/StudentSelectionPage';
import { RequireStudent } from '../student/RequireStudent';
import { CreditsPage } from '../features/Credits/CreditsPage';

// Admin Features & Security
import { AdminLoginPage } from '../features/Admin/AdminLoginPage';
import { AdminLayout } from '../features/Admin/AdminLayout';
import { AdminDashboardPage } from '../features/Admin/AdminDashboardPage';
import { AdminStudentDetailPage } from '../features/Admin/AdminStudentDetailPage';
import { AdminSchoolsPage } from '../features/Admin/AdminSchoolsPage';
import { AdminStudentsPage } from '../features/Admin/AdminStudentsPage';
import { AdminReportsPage } from '../features/Admin/AdminReportsPage';
import { SetupComputerPage } from '../features/Admin/SetupComputerPage';
import { AdminRoute } from '../auth/AdminRoute';

export const routes: RouteObject[] = [
  {
    path: '/',
    errorElement: <div className="p-8 text-center text-red-500 font-bold">App Error</div>,
    children: [
      {
        index: true,
        // Root route is the Student Welcome / Name Entry screen
        element: <StudentSelectionPage />,
      },
      {
        path: 'students',
        element: <StudentSelectionPage />,
      },
      {
        path: 'home',
        element: <HomePage />,
      },
      {
        path: 'setup',
        element: <SetupComputerPage />,
      },
      {
        // Protected learning routes: requires active student session
        element: <RequireStudent />,
        children: [
          {
            path: 'classes',
            element: <Navigate to="/subjects" replace />,
          },
          {
            path: 'subjects',
            element: <SubjectSelectionPage />,
          },
          {
            path: 'subjects/english',
            element: <EnglishLearningAreaPage />,
          },
          {
            path: 'subjects/english/modules/:moduleId',
            element: <EnglishModuleDetailPage />,
          },
          {
            path: 'subjects/tamil',
            element: <TamilLearningAreaPage />,
          },
          {
            path: 'subjects/tamil/modules/:moduleId',
            element: <TamilModuleDetailPage />,
          },
          {
            path: 'subjects/:subjectId',
            element: <LearningAreaPage />,
          },
          {
            path: 'session/:subjectId/setup',
            element: <SessionSetupPage />,
          },
          {
            path: 'session/:subjectId/play',
            element: <SessionPage />,
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
            path: 'classes/:classId/subjects/tamil',
            element: <TamilLearningAreaPage />,
          },
          {
            path: 'classes/:classId/subjects/tamil/modules/:moduleId',
            element: <TamilModuleDetailPage />,
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
        ],
      },
      {
        path: 'credits',
        element: <CreditsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'admin/login',
        element: <AdminLoginPage />,
      },
      {
        path: 'admin',
        element: (
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="dashboard" replace />,
          },
          {
            path: 'dashboard',
            element: <AdminDashboardPage />,
          },
          {
            path: 'reports',
            element: <AdminReportsPage />,
          },
          {
            path: 'schools',
            element: <AdminSchoolsPage />,
          },
          {
            path: 'students',
            element: <AdminStudentsPage />,
          },
          {
            path: 'students/:studentId',
            element: <AdminStudentDetailPage />,
          },
          {
            path: 'setup-computer',
            element: <SetupComputerPage />,
          },
        ],
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);

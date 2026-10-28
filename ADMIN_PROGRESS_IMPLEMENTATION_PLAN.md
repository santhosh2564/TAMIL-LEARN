# Admin Progress Dashboard & Rule-Based Authentication Implementation Plan

## 1. Current Architecture Overview

### 1.1 Existing Student Identity & Selection
- **Model**: `StudentProfile` (`id`, `name`, `createdAt`, `lastActiveAt`) in `src/student/types.ts`.
- **Generation**: Collision-resistant UUID / fallback via `generateStudentId()`.
- **Persistence**: `LocalStudentRepository` persists to `localStorage` under key `sa.students.v1`. Active student pointer stored in `sa.activeStudentId.v1`.
- **Context & Hooks**: `StudentContext` and `useStudent()` provide reactive state across the application.
- **Student UX**: Intentionally child-friendly and login-free. Learners either pick an existing avatar/name or enter their name on `/students`.

### 1.2 Existing Progress & Attempt Architecture
- **Attempts Layer**:
  - `AttemptRecord` in `src/attempts/types.ts` (`id`, `studentId`, `activityId`, `category`, `attemptNumber`, `result`, `completed`, `timestamp`).
  - `LocalAttemptRepository` stores chronological attempt history in `sa.learning.attempts.v1` partitioned by `studentId`.
  - `AttemptService` computes authoritative metrics per activity (`attempts`, `retryCount`, `firstAttemptCorrect`, `completed`, `lastAttemptAt`).
- **Progress Layer**:
  - `ActivityProgress` in `src/progress/types.ts` stores summarized learner state per activity.
  - `LocalProgressRepository` stores progress under `sa.learning.progress.v2` (student-isolated map: `students[studentId][activityId]`).
  - `ProgressService` coordinates saving attempts and computing metrics, with fallback legacy v1 support.
- **Activity Engine & Flow**:
  - `CoreActivityEngine` evaluates answers via registry-provided evaluators (`picture-recognition`, `spelling-choice`, `meaning-match`, `context-choice`, `arrange-word`, `word-completion`).
  - `SessionPage` manages session playback, triggering progress persistence on submission.

### 1.3 Routing & Navigation
- Implemented with `react-router-dom` v6 (`createBrowserRouter` in `src/app/routes.tsx`).
- Top-level paths: `/`, `/students`, `/classes/...`, `/session/...`, `/settings`, `/credits`.

---

## 2. Missing Pieces Identified

1. **Authentication & Authorization**:
   - No concept of Admin users or credentials.
   - No login route or authentication state management.
   - No route protection or role-based access control (RBAC) guards.
   - `src/types/index.ts` has a placeholder `User` interface, but no service, repository, or context exists.

2. **Unified Progress Aggregation Across Subjects & Questions**:
   - While attempts and progress exist, English activities currently persist into a separate unisolated key (`sa.learning.progress.english.v1`) and omit attempt-level tracking in `sa.learning.attempts.v1`.
   - Admin queries require cross-student aggregation (e.g. Total Students, Active Students, Total Activities Completed, First-Attempt Successes, Questions Retried, Total Retries).
   - Need an `AdminProgressService` that aggregates both Tamil and English content, joins with `ContentRepository` for total question counts, and yields student attempt timelines.

3. **Admin UI**:
   - No admin login page (`/admin/login`).
   - No admin dashboard page (`/admin` / `/admin/dashboard`).
   - No student detail analytics page (`/admin/students/:studentId`).
   - No admin navigation layout with logout controls.

---

## 3. Proposed Data & Domain Models

### 3.1 Authentication & Authorization Models (`src/auth/types.ts`)
```typescript
export type UserRole = 'student' | 'admin';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export type Permission =
  | 'access:learning'
  | 'access:own_progress'
  | 'access:admin_dashboard'
  | 'view:all_students'
  | 'view:student_details'
  | 'view:student_attempts';

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
}
```

### 3.2 Role-Based Access Rules
| Role | Access Learning | Access Own Progress | Access Admin Dashboard | View All Students | View Student History |
|---|---|---|---|---|---|
| `student` | Allowed | Allowed | Denied | Denied | Denied |
| `admin` | Allowed | Allowed | Allowed | Allowed | Allowed |

### 3.3 Admin Aggregated Progress Models (`src/admin/types.ts`)
```typescript
export interface StudentProgressSummary {
  studentId: string;
  studentName: string;
  createdAt: string;
  lastActiveAt: string;
  activitiesCompleted: number;
  totalQuestionsAttempted: number;
  questionsCompleted: number;
  firstAttemptCorrectCount: number;
  questionsRetriedCount: number;
  totalRetriesCount: number;
  completionPercentage: number;
}

export interface AdminDashboardMetrics {
  totalStudents: number;
  activeStudents: number;
  totalActivitiesCompleted: number;
  totalQuestionsCompleted: number;
  firstAttemptSuccesses: number;
  questionsRetried: number;
  totalRetries: number;
}

export interface QuestionAttemptDetail {
  questionId: string;
  activityTitle: string;
  category: string;
  subject: string;
  attempts: number;
  retries: number;
  firstAttemptCorrect: boolean;
  status: 'completed' | 'in-progress' | 'not-started';
  lastAttemptAt?: string;
}
```

---

## 4. Authentication & Security Approach

1. **Architecture**:
   - `AuthRepository`: Interface defining `login`, `logout`, `getSession`, `saveSession`.
   - `LocalAuthRepository`: Implements `AuthRepository` storing session in `sessionStorage` (`sa.admin.session.v1`), ensuring admin sessions do not leak across browser tabs/restarts or expose permanent tokens.
   - `AuthService`: Orchestrates credential validation, token generation, rule checks (`can(user, permission)`).
   - `AuthContext` & `useAuth()`: Provides reactive auth state to React components.
2. **Environment & Production Readiness**:
   - Demo/dev admin credentials configurable via environment (`VITE_ADMIN_USERNAME`, `VITE_ADMIN_PASSWORD_HASH` or fallback default `admin` / `saraAdmin2026!`).
   - Credential validation abstracts password comparison through a hash/digest function (SHA-256 via Web Crypto API).
   - Document clearly that in a static/offline SPA, true non-repudiation requires backend/Neon Auth; the abstraction provided is designed to seamlessly plug in a backend/cloud provider without changing UI code.

---

## 5. Storage Strategy & Migration

1. **Storage Keys**:
   - `sa.admin.session.v1`: Stored in `sessionStorage` (isolated, temporary admin token).
   - `sa.students.v1`: Existing student profiles.
   - `sa.learning.progress.v2`: Student progress records.
   - `sa.learning.attempts.v1`: Student attempt records.
2. **Backward Compatibility**:
   - Existing student data is completely preserved.
   - Schema versioning handles missing fields gracefully (e.g., if older records lack `firstAttemptCorrect`, derive from attempt records or default to false).
   - Anonymous learners who play before creating a profile are assigned a stable fallback profile so progress is never lost.

---

## 6. Dashboard Architecture & UI Components

1. **Routes**:
   - `/admin/login`: `AdminLoginPage`
   - `/admin`: `AdminLayout` (protected)
     - `/admin/dashboard`: `AdminDashboardPage`
     - `/admin/students/:studentId`: `AdminStudentDetailPage`
2. **Protected Route Guard (`AdminRoute`)**:
   - Verifies `isAuthenticated()` and `hasRole('admin')`.
   - Unauthorized attempts immediately redirect to `/admin/login?from=...`.
   - Never renders children or exposes student metrics before authorization resolves.
3. **Dashboard Components**:
   - `AdminLayout`: Header with Sara design system branding, Admin badge, Admin user greeting, Logout button.
   - `SummaryCards`: 7 metric cards (Total Students, Active Students, Activities Completed, Questions Completed, First-Attempt Successes, Questions Retried, Total Retries).
   - `StudentTable`: Searchable, sortable, filterable student progress overview.
   - `StudentDetail`: Deep-dive into category mastery and granular question attempt history.

---

## 7. Testing Strategy

1. **Unit & Integration Tests (Vitest)**:
   - `AuthService`: Valid login, invalid credentials, logout, role checking, permissions matrix.
   - `AdminRoute`: Direct navigation without login redirects; authorized navigation renders.
   - `Attempt & Progress Calculation`:
     - Attempt 1 -> wrong, Attempt 2 -> wrong, Attempt 3 -> correct => `attempts = 3`, `retries = 2`, `firstAttemptCorrect = false`, `completed = true`.
     - Attempt 1 -> correct => `attempts = 1`, `retries = 0`, `firstAttemptCorrect = true`, `completed = true`.
   - `AdminProgressService`: Aggregation across multiple students, category breakdown, empty states.
2. **Playwright E2E Scenarios**:
   - **Scenario 1 (Student Flow)**: Complete questions (first attempt correct, retry flow), verify localStorage persistence.
   - **Scenario 2 (Admin Login)**: Invalid login fails, valid login succeeds and navigates to `/admin/dashboard`.
   - **Scenario 3 (Dashboard Metrics)**: Verify exact metric values matching student activity.
   - **Scenario 4 (Security & Guards)**: Direct navigation to `/admin/dashboard` while logged out or as student is blocked.
   - **Scenario 5 (Admin Logout)**: Logout clears session and blocks admin route access.

---

## 8. Implementation Steps

1. **Step 1**: Create `src/auth/` (types, `AuthRepository`, `LocalAuthRepository`, `AuthService`, `AuthContext`, `useAuth`, `ProtectedRoute`).
2. **Step 2**: Create `src/admin/` domain services (`AdminProgressService` for aggregating student metrics and attempt timelines).
3. **Step 3**: Unify question attempt recording in `SessionPage` so both Tamil and English consistently record attempts into `AttemptService` and student progress.
4. **Step 4**: Create Admin UI pages: `AdminLoginPage`, `AdminLayout`, `AdminDashboardPage`, `AdminStudentDetailPage`.
5. **Step 5**: Register routes in `src/app/routes.tsx` and add an Admin link to the footer for easy staff access.
6. **Step 6**: Add comprehensive unit & integration tests (`vitest`).
7. **Step 7**: Create and run Playwright E2E tests (`tests/e2e/admin/admin-flow.spec.ts`).
8. **Step 8**: Run full regression test suite (`npm test`, `npm run build`, `npm run lint`).
9. **Step 9**: Produce final verification report.

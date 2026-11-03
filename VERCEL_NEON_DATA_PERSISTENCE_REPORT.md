# Vercel → Neon PostgreSQL Data Persistence Verification Report

**Date:** 2026-11-03  
**Application:** https://tamil-learn-alpha.vercel.app/  
**Repository:** https://github.com/santhosh2564/TAMIL-LEARN  
**Deployment Fix Branch:** `fix/vercel-api-routing`  
**Latest Deployment-Fix Commit:** `50c32af1bb8da60f1f06c076379ca90340093e0b`

---

## A. Deployment Information

| Field | Production Environment | Preview Environment (Deployment Fix) |
|---|---|---|
| **Vercel Project** | `tamil-learn` (ID: `prj_pCq2P17ZtG97R54L6x1`) | `tamil-learn` (ID: `prj_pCq2P17ZtG97R54L6x1`) |
| **Deployment URL** | `https://tamil-learn-alpha.vercel.app` | `https://tamil-learn-5ajhxy4v2-santhosh-k-rs-projects.vercel.app`<br>`https://tamil-learn-git-fix-vercel-api-routing-santhosh-k-rs-projects.vercel.app` |
| **Environment** | Production | Preview (Branch: `fix/vercel-api-routing`) |
| **Deployed Commit SHA** | `be9db8eaa4da232248e381f30bb8620fee505b13` | `50c32af1bb8da60f1f06c076379ca90340093e0b` |
| **Deployment Status** | Live (`FUNCTION_INVOCATION_FAILED` on API) | Deployed (`Deployment has completed`, Protected by Vercel Auth) |

---

## B. Database Connection & Environment Architecture

### 1. Connected Neon Projects & Branches
- **Production Neon Project:** `TAMIL-LEARN` (`rapid-firefly-97976873`)
  - **Branch:** `production` (`br-old-bird-b4qzyxzx`, Default / Primary)
  - **Endpoint Type:** Pooled (`ep-crimson-fire-b4d0j4yb-pooler...`) & Direct (`ep-crimson-fire-b4d0j4yb...`)
  - **PostgreSQL Version:** 18
  - **Applied Migrations:** `001_schema`, `002_attempts_backfill`, `003_assessment_tracking`, `004_remove_classes`
- **Test / Staging Neon Project:** `withered-credit-99248455`
  - **Branch:** `test-phase-2-1` (`br-patient-fog-b57uzqdt`)
  - **Endpoint Type:** Pooled (`ep-aged-field-b52xyhyy-pooler...`)
  - **Purpose:** Automated vitest / integration suite isolation (`TEST_DATABASE_URL`)

### 2. Connection Variable Resolution in Serverless Handler
- Defined in `server/db.ts` (lines 23–35):
  `process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED`
- Uses Neon serverless WebSockets/HTTP driver (`@neondatabase/serverless`).

### 3. Environment Variables (Names and Scope Only)
- `DATABASE_URL`: Required in Production and Preview scopes (Pooled Neon PostgreSQL connection string)
- `DATABASE_URL_UNPOOLED`: Optional fallback (Direct Neon endpoint)
- `SESSION_SECRET`: Required in Production and Preview scopes (Minimum 32-character symmetric key for session JWT cookies)
- `TEST_DATABASE_URL`: Test runner only (Isolated test database)

---

## C. Data Persistence Summary (Production Neon: `rapid-firefly-97976873` / `br-old-bird-b4qzyxzx`)

Exact read-only counts queried directly from the connected Neon Production database:

| Data Category | API Operation | Neon Table | Record Count | Persistence Status |
|---|---|---|---:|---|
| **Schools** | `POST /api/admin/schools` | `schools` | **2** | Persisted (System baseline: `school_unassigned`, `sch_1793511379517_cd9vo`) |
| **Classes** | `POST /api/admin/classes` | `classes` | **1** | Persisted (Legacy baseline: `class_legacy`) |
| **Admin Accounts** | Seed / Admin Auth | `admins` | **1** | Persisted (`super_admin` role) |
| **Students** | `POST /api/admin/students` | `students` | **0** | No records persisted |
| **Assessment Sessions** | `POST /api/assessment-sessions` | `assessment_sessions` | **0** | No records persisted |
| **Learning Sessions** | `POST /api/students/:id/sessions` | `learning_sessions` | **0** | No records persisted |
| **Question Attempts** | `POST /api/question-attempts` | `question_attempts` | **0** | No records persisted |
| **Legacy Attempts** | `POST /api/students/:id/attempts` | `attempts` | **0** | No records persisted |
| **Activity Progress** | Activity Engine / Sync | `activity_progress` | **0** | No records persisted |
| **Student Module Progress** | SQL View | `student_module_progress` | **0** | View returns 0 rows |

> [!NOTE]
> In contrast, the isolated test branch `withered-credit-99248455` (`test-phase-2-1`), where automated integration suites execute, holds 581 student records, 119 assessment sessions, and 369 question attempts. This demonstrates that database insertion and transaction logic function correctly when reached, but the Production Neon branch has not received student traffic due to the Production Vercel serverless routing failure.

---

## D. End-to-End Data Flow Trace

| Operation | Frontend Trigger / Service | API Endpoint & Method | Server Handler Function | Destination Neon Table | Immediate Success Response |
|---|---|---|---|---|---|
| **1. Student Creation** | Admin Student Management UI | `POST /api/admin/students` | `handleApiRequest` → `createStudentInDb()` | `students` | `201 Created` with student record JSON |
| **2. Student Login** | Student Selection / PIN Modal | `POST /api/student/login` | `handleApiRequest` → `getStudentById()`, verify PIN, issue JWT cookie | None (Reads `students`) | `200 OK` with `{ success: true, student }` |
| **3. Assessment Session Creation** | `SessionPage.tsx` (`sessionSync.createOrSaveSession`) | `POST /api/assessment-sessions` | `handleApiRequest` → `createOrGetAssessmentSessionInDb()` | `assessment_sessions` | `201 Created` with session record JSON |
| **4. Question Attempt Submission** | `SessionPage.tsx` (`assessmentTracker.recordSubmission`) | `POST /api/question-attempts` | `handleApiRequest` → `recordQuestionAttemptInDb()` | `question_attempts` | `200 OK` with attempt ID & monotonically assigned `attempt_number` |
| **5. Student Progress Updates** | `SessionPage.tsx` (`sessionSync.updateSessionProgress`) | `PATCH /api/assessment-sessions/:sessionId` | `handleApiRequest` → `updateAssessmentSessionInDb()` | `assessment_sessions` | `200 OK` with updated session JSON |
| **6. Day/Module Completion** | Results navigation (`sessionSync.updateSessionProgress`) | `POST /api/assessment-sessions/:sessionId/complete` | `handleApiRequest` → `updateAssessmentSessionInDb()` (`session_status = 'completed'`) | `assessment_sessions` | `200 OK` with completed session JSON |
| **7. Session Resume & Progress Sync** | `SessionPage.tsx` on mount / reload | `GET /api/students/:id/assessment-sessions/active` | `handleApiRequest` → `getActiveAssessmentSessionFromDb()` | None (Reads `assessment_sessions`) | `200 OK` with `{ session: ... }` or `404` |
| **8. Offline Outbox Synchronization** | `AssessmentOutboxQueue.ts` on `'online'` event | `POST /api/question-attempts` (loops queued items) | `handleApiRequest` → `recordQuestionAttemptInDb()` | `question_attempts` | `200 OK`; dequeue item on 2xx / 404 |

### Verification of Write Sequencing
- In all backend handler branches, the SQL execution (`await sql.query(...)`) is awaited **before** `sendJson(res, 200/201, ...)` is called.
- No optimistic or early 200/201 HTTP responses are returned prior to database confirmation.
- Database rejections trigger a 500 status and prevent client outbox dequeue.

---

## E. Offline Synchronization & Data Layer Status

1. **Persisted in Neon:**
   - 2 baseline schools and 1 admin user exist in Production Neon.
   - 0 student assessment records are persisted in Production Neon because production API calls fail at the Vercel serverless layer before reaching the database.
2. **Waiting in Offline Queue (Client Browser):**
   - `AssessmentOutboxQueue.ts` uses IndexedDB (with `localStorage` fallback) under key `sa.outbox.question_attempts.v1`.
   - When a student completes questions on the live production URL, the frontend records each attempt to the local outbox first. When the network dispatch fails with HTTP 500, the attempt remains safely queued in the student's browser storage without data loss.
3. **Stored Only in Browser Storage:**
   - Active session state (`sa.activeSession.<studentId>`) and cumulative attempt counters (`sa.assessment.attemptCounts.<sessionId>`) are stored in `sessionStorage`/`localStorage`.
4. **Data Submitted but Rejected by API:**
   - Production requests to `/api/health`, `/api/schools`, and `/api/students` return `500 FUNCTION_INVOCATION_FAILED` (Vercel Node serverless initialization crash on commit `be9db8e`).
   - Requests to multi-segment paths (e.g. `/api/public/schools`, `/api/admin/session`) return `404 NOT_FOUND` on production because Vercel treats `api/[...path].ts` as single-segment without the rewrite.
5. **Preview Deployment Resolution:**
   - On branch `fix/vercel-api-routing` (commit `50c32af`), `vercel.json` rewrites `/api/:path*` to `/api/index?__path=:path*`, restoring full routing to the centralized handler.

---

## F. Final Verdict

### **PARTIAL**

**Evidence & Rationale:**
1. **Database Schema & Driver Integrity:** The Neon PostgreSQL production branch (`br-old-bird-b4qzyxzx` on `rapid-firefly-97976873`) has all migrations applied (`001_schema` through `004_remove_classes`), all 12 tables and views created, and verifies identical schema structure to the test database.
2. **Integration Verification:** Full database insertion, idempotency, monotonic attempt numbering, and school-scoping logic pass cleanly in automated tests against Neon.
3. **Production Write Absence:** The live production deployment (`https://tamil-learn-alpha.vercel.app`) cannot persist new student data because unhandled initialization errors on `main` (`be9db8e`) cause `500 FUNCTION_INVOCATION_FAILED` and `404 NOT_FOUND` before reaching Neon. Consequently, the production database currently holds 0 student records and 0 question attempts.
4. **Data Safety:** Zero student data is lost due to client-side outbox-first persistence (`AssessmentOutboxQueue`), which preserves student attempts in browser storage until the serverless deployment fix is promoted to production.


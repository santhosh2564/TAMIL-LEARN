# Production Deployment Guide: Sara Kids Learning Platform

This document describes the exact steps required to deploy the Sara platform to Vercel and Neon PostgreSQL, execute schema migrations, initialize administrative accounts, and verify full production readiness.

---

## 1. Vercel Environment Variables Configuration

Navigate to your Vercel Project Settings: **Settings → Environment Variables**.

Configure the variables by environment scope:

### Production Environment (`Production` checkbox only)

| Variable Name | Value / Description | Example / Endpoint |
|---|---|---|
| `DATABASE_URL` | Neon Production pooled connection string | `postgresql://neondb_owner:***@ep-late-haze-b593dxrs-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `SESSION_SECRET` | Strong random secret for production JWT session signing (min 32 chars) | e.g., generated with `openssl rand -hex 32` |

> [!IMPORTANT]
> Never point Production `DATABASE_URL` to the test or dev branch endpoints. Production must always point to the primary branch compute endpoint (`ep-late-haze-b593dxrs`).

### Preview Environment (`Preview` and `Development` checkboxes)

| Variable Name | Value / Description | Example / Endpoint |
|---|---|---|
| `DATABASE_URL` | Neon TEST branch pooled connection string | `postgresql://neondb_owner:***@ep-aged-field-b52xyhyy-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `TEST_DATABASE_URL` | Same TEST branch connection string (for verification & test suites) | `postgresql://neondb_owner:***@ep-aged-field-b52xyhyy-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `SESSION_SECRET` | Distinct random secret for Preview/Staging JWT session signing | e.g., generated with `openssl rand -hex 32` |

---

## 2. Production Database Schema Migration

All migrations required to bring an empty or earlier database up to date are consolidated and verified idempotent in [`server/migrations/pending_production.sql`](file:///server/migrations/pending_production.sql).

### Option A: Using `npm run db:migrate:prod` (Recommended)

Set `PRODUCTION_DATABASE_URL` or `DATABASE_URL` in your environment or `.env.local` to the production connection string, then run:

```bash
# Set your production database URL
export DATABASE_URL="postgresql://neondb_owner:***@ep-late-haze-b593dxrs-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Execute the verified idempotent migration
npm run db:migrate:prod
```

### Option B: Using standard PostgreSQL CLI (`psql`)

```bash
psql "$PRODUCTION_DATABASE_URL" -v ON_ERROR_STOP=1 -f server/migrations/pending_production.sql
```

Both options execute all schema definitions, rate limiting tables `(ip, kind, window_start)`, indexes, constraints, and metadata backfills inside a safe transaction.

---

## 3. Create the Initial Super Admin User

Run the interactive admin creation tool targeting the production database:

```bash
DATABASE_URL="postgresql://neondb_owner:***@ep-late-haze-b593dxrs-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require" npm run admin:create
```

Follow the interactive prompts:
1. **Username**: Enter the super admin username (e.g., `admin`).
2. **Password**: Enter a secure password (minimum 12 characters).
3. **Role**: Select `super_admin`.
4. **School**: Super admins have unscoped system-wide access (leave school empty or unassigned).

The script securely hashes the password with `bcrypt` (cost factor 12) and creates the admin in PostgreSQL.

---

## 4. 10-Step Manual Smoke Test on the Production URL

Once deployed to `https://<your-production-domain>.vercel.app`, perform this 10-step end-to-end smoke test:

### Step 1: Admin Login
- Open `https://<your-production-domain>/admin/login`.
- Enter the super admin credentials created in Section 3.
- **Verify**: Login succeeds with HTTP 200, sets `sa_admin_jwt` HTTP-only cookie, and redirects to `/admin/dashboard`.

### Step 2: Create Class
- In the Admin Dashboard, navigate to **Classes** (`/admin/classes`).
- Click **"Create Class"** / **"Add New Class"**.
- Enter Class Name (e.g. `Class 2 Alpha`), select Grade (`Class 2-3`).
- Click **Save**.
- **Verify**: Class is created with a unique 6-character alphanumeric class code (e.g. `ABC123`).

### Step 3: Add 2 Students
- Click into the newly created class and open the **Students** tab or click **"Add Students"**.
- **Student 1**:
  - Name: `Student One`
  - Roll No: `01`
  - Select 3 picture icons for the PIN (e.g., Apple, Sun, Star).
  - Click **Save**.
- **Student 2**:
  - Name: `Student Two`
  - Roll No: `02`
  - Select 3 picture icons for the PIN (e.g., Elephant, Moon, Heart).
  - Click **Save**.
- **Verify**: Both students appear in the class roster table.

### Step 4: Print Cards
- On the class management page, click **"Print Cards"** (`/admin/classes/<classId>/print`).
- **Verify**:
  - Two student login cards render.
  - Each card displays the school name, class name, student name, roll number, 3 PIN pictures in order, and a scannable QR code pointing to `/join?code=<classCode>`.
  - Press `Ctrl+P` (or Print Preview) and verify that headers, sidebars, and action buttons are cleanly hidden (`print:hidden`).

### Step 5: Student Login on 2 Browsers
- **Browser A** (e.g. Chrome normal window):
  - Go to `https://<your-production-domain>/join`.
  - Enter the class code.
  - Select `Student One`.
  - Enter the 3 PIN pictures.
  - **Verify**: Successfully logs in and enters `/home`.
- **Browser B** (e.g. Chrome incognito window or Firefox):
  - Go to `https://<your-production-domain>/join`.
  - Enter the class code.
  - Select `Student Two`.
  - Enter the 3 PIN pictures.
  - **Verify**: Successfully logs in and enters `/home` independently.

### Step 6: Answer Questions
- In **Browser A** (`Student One`):
  - Select **Tamil** or **English** from the Subject selection page.
  - Launch an activity module (e.g. Grade 2-3 Spelling Choice).
  - Answer 2 questions correctly by clicking the answer choices and clicking **தொடர்க** / **Continue**.
  - **Verify**: Audio/visual celebration feedback plays, progress bar advances, and score updates.

### Step 7: Resume Session
- In **Browser A**, refresh the browser window or navigate back to `/home` and re-enter the subject/module.
- **Verify**: The student's active learning session resumes seamlessly without resetting progress to Question 1.

### Step 8: Dashboard Shows Answers (Cross-Context Sync)
- Switch back to the **Teacher/Admin Dashboard** in your admin browser window.
- Click **"Refresh"** on the Student Progress Roster table.
- Locate `Student One`.
- **Verify**: The **Questions Completed** column (`td.nth(2)`) reflects the 2 completed questions, matching the live database record in real time.

### Step 9: Archive Student
- In the Admin Dashboard, navigate to the class students list.
- Click **Archive** / **Delete** on `Student Two`.
- Confirm the dialog.
- **Verify**:
  - `Student Two` is removed from the active class roster.
  - In Browser B, attempt to log in as `Student Two` with the same PIN; verify access is rejected with a friendly message.

### Step 10: Logout
- In the Admin browser: Click **Log out** in the user menu. Verify session cookie is invalidated and admin is redirected to `/admin/login`.
- In Browser A (`Student One`): Click **Log out**. Verify student session is cleared, pending outbox items are safe in storage, and user is redirected to the home/join screen.


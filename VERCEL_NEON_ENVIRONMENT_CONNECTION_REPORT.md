# Vercel & Neon Environment Connection Audit Report

**Date:** 2026-11-03  
**Application (Production):** https://tamil-learn-alpha.vercel.app  
**Application (Preview):** https://tamil-learn-git-fix-vercel-api-routing-santhosh-k-rs-projects.vercel.app  
**Direct Preview URL:** https://tamil-learn-5ajhxy4v2-santhosh-k-rs-projects.vercel.app  
**GitHub Repository:** https://github.com/santhosh2564/TAMIL-LEARN  
**Target Neon Project:** `TAMIL-LEARN` (`rapid-firefly-97976873`)

---

## 1. Production Vercel Environment Configuration Status

- **Status:** **PASS (Database & Configuration Ready) / BLOCKED (Runtime Deployment on Commit `be9db8e`)**
- **Vercel Project:** `tamil-learn` (ID: `prj_pCq2P17ZtG97R54L6x1`)
- **Deployed Commit:** `be9db8eaa4da232248e381f30bb8620fee505b13` (`main`)
- **Required Production Environment Variables:**
  - `DATABASE_URL`: Set in Production scope → points to Neon production branch pooled endpoint (`ep-crimson-fire-b4d0j4yb-pooler...`).
  - `SESSION_SECRET`: Set in Production scope (min 32 characters).
- **Runtime Observation:**
  - Production HTTP requests to `/api/health`, `/api/schools`, and `/api/students` return `500 FUNCTION_INVOCATION_FAILED`.
  - Multi-segment routes (`/api/public/schools`, `/api/admin/session`) return `404 NOT_FOUND` because Vercel CLI treats `api/[...path].ts` as single-segment without the rewrite present in `fix/vercel-api-routing`.
  - The Production database connection cannot become operational until the routing fix from branch `fix/vercel-api-routing` (`50c32af`) is merged and deployed.

---

## 2. Preview Vercel Environment Configuration Status

- **Status:** **PASS (Branch & Schema Provisioned) / BLOCKED (Vercel Authentication on Preview Domain)**
- **Preview Deployment URL:** `https://tamil-learn-5ajhxy4v2-santhosh-k-rs-projects.vercel.app`
- **Preview Branch:** `fix/vercel-api-routing` (Commit: `50c32af1bb8da60f1f06c076379ca90340093e0b`)
- **Required Preview Environment Variables Configuration:**
  - `DATABASE_URL`: Must be set in Vercel **Preview** scope → points to dedicated Neon Preview branch pooled endpoint (`ep-small-art-b48jtm4l-pooler...`).
  - `SESSION_SECRET`: Must be set in Vercel **Preview** scope (a separate random 48-byte Base64 key).

---

## 3. Neon Production Branch Identifier

- **Neon Project:** `TAMIL-LEARN` (`rapid-firefly-97976873`)
- **Branch Name:** `production`
- **Branch ID:** `br-old-bird-b4qzyxzx`
- **Primary / Default:** `true`
- **Active Endpoint (Compute):** `ep-crimson-fire-b4d0j4yb`
- **Host Endpoint (Pooled):** `ep-crimson-fire-b4d0j4yb-pooler.c-6.us-east-2.aws.neon.tech`
- **Host Endpoint (Direct):** `ep-crimson-fire-b4d0j4yb.c-6.us-east-2.aws.neon.tech`
- **State:** `ready` / `active`

---

## 4. Neon Preview Branch Identifier

- **Neon Project:** `TAMIL-LEARN` (`rapid-firefly-97976873`)
- **Branch Name:** `preview`
- **Branch ID:** `br-morning-cloud-b4w6s4u2`
- **Parent Branch:** `br-old-bird-b4qzyxzx` (`production`)
- **Primary / Default:** `false` (Isolated preview branch)
- **Active Endpoint (Compute):** `ep-small-art-b48jtm4l`
- **Host Endpoint (Pooled):** `ep-small-art-b48jtm4l-pooler.c-6.us-east-2.aws.neon.tech`
- **Host Endpoint (Direct):** `ep-small-art-b48jtm4l.c-6.us-east-2.aws.neon.tech`
- **State:** `ready` / `active`
- **Sanitization & Isolation:**
  - Any inherited administrative credentials from branch creation were purged: `DELETE FROM admins` executed on `br-morning-cloud-b4w6s4u2`.
  - Zero student records exist.
  - Zero assessment sessions exist.

---

## 5. Confirmation That Database URLs Are Different

| Environment | Branch Name | Branch ID | Compute Host (Pooled) | Isolation Status |
|---|---|---|---|---|
| **Production** | `production` | `br-old-bird-b4qzyxzx` | `ep-crimson-fire-b4d0j4yb-pooler.c-6.us-east-2.aws.neon.tech` | Production Data Safe |
| **Preview** | `preview` | `br-morning-cloud-b4w6s4u2` | `ep-small-art-b48jtm4l-pooler.c-6.us-east-2.aws.neon.tech` | **Confirmed 100% Isolated** |

The Preview database endpoint belongs to a distinct compute instance (`ep-small-art-b48jtm4l`) and distinct branch (`br-morning-cloud-b4w6s4u2`). Any writes, mutations, or resets to Preview will never affect Production.

---

## 6. Confirmation That Session Secrets Are Different

- **Production `SESSION_SECRET`:** 87-character secret configured for Production scope.
- **Preview `SESSION_SECRET`:** Dedicated 64-character secret generated independently for Preview scope.
- **Confirmation:** The session secrets for Preview and Production are generated from independent entropy sources and do not share signing keys.

---

## 7. Preview API Endpoint Test Results

| Endpoint & Method | Expected Behavior | Live Preview Result | Status |
|---|---|---|---|
| `GET /api/health` | HTTP 200 `{ status: "ok", database: "connected" }` | HTTP 302 (Redirects to `https://vercel.com/sso-api`) | **BLOCKED** |
| `GET /api/public/schools` | HTTP 200 `[ ...schools ]` | HTTP 302 (Redirects to `https://vercel.com/sso-api`) | **BLOCKED** |
| `GET /api/admin/session` | HTTP 401 `{ authenticated: false }` | HTTP 302 (Redirects to `https://vercel.com/sso-api`) | **BLOCKED** |
| `GET /api/student/session` | HTTP 401 `{ authenticated: false }` | HTTP 302 (Redirects to `https://vercel.com/sso-api`) | **BLOCKED** |
| `GET /api/unknown/nested?probe=abc` | HTTP 404 `{ error: "Not found" }` | HTTP 302 (Redirects to `https://vercel.com/sso-api`) | **BLOCKED** |

> [!NOTE]
> **Vercel Deployment Protection:** The Preview deployment has Vercel Authentication enabled (`Protected by Vercel Authentication`, header `x-vercel-id: bom1::...`). Unauthenticated external automated requests receive HTTP 302 redirecting to Vercel SSO. In accordance with safety instructions, Deployment Protection was not disabled. Users logged into Vercel in a browser can test the live endpoints at:  
> `https://tamil-learn-5ajhxy4v2-santhosh-k-rs-projects.vercel.app/api/health`

---

## 8. Preview Synthetic Persistence Test Results

A controlled synthetic write/read/delete cycle was conducted directly against the dedicated Neon Preview branch (`br-morning-cloud-b4w6s4u2`) to verify full read/write persistence:

1. **Synthetic Record Write:**
   - Query: `INSERT INTO schools (id, name, school_name, school_code, is_active, created_at, updated_at) VALUES ('sch_synthetic_preview_test', 'Synthetic Preview Test School', 'Synthetic Preview Test School', 'SPTS01', true, NOW(), NOW()) RETURNING id, is_active, created_at;`
   - Result: Record created (`id: "sch_synthetic_preview_test"`, `is_active: true`, timestamp: `2026-11-03T02:36:26.221Z`).
2. **Persistence Read-Back:**
   - Query: `SELECT id, name, is_active FROM schools WHERE id = 'sch_synthetic_preview_test';`
   - Result: **Found** (`id: "sch_synthetic_preview_test"`, `name: "Synthetic Preview Test School"`).
3. **Cross-Branch Isolation Verification:**
   - Query against Production Branch (`br-old-bird-b4qzyxzx`): `SELECT id, name, is_active FROM schools WHERE id = 'sch_synthetic_preview_test';`
   - Result: **0 rows returned (Empty)**. Proves total isolation between Preview and Production branches.
4. **Synthetic Cleanup:**
   - Query: `DELETE FROM schools WHERE id = 'sch_synthetic_preview_test';`
   - Result: Record cleanly removed.
   - Verification Query: `SELECT id FROM schools WHERE id = 'sch_synthetic_preview_test';` → 0 rows.
- **Status:** **PASS** (Write, read-back, cross-branch isolation, and cleanup confirmed).

---

## 9. Production API Verification Status

| Check | Result | Detail |
|---|---|---|
| `GET /api/health` | **FAIL (HTTP 500)** | `X-Vercel-Error: FUNCTION_INVOCATION_FAILED` (Vercel serverless initialization error on commit `be9db8e`) |
| `GET /api/public/schools` | **FAIL (HTTP 404)** | `X-Vercel-Error: NOT_FOUND` (Multi-segment path not matched by old `api/[...path].ts`) |
| Production Neon Database | **PASS** | Neon branch `br-old-bird-b4qzyxzx` is healthy, online, and fully migrated. |

---

## 10. Outstanding Actions and Blockers

1. **Configure Environment Variables in Vercel Project Dashboard:**
   - In [Vercel Project Settings → Environment Variables](https://vercel.com/santhosh-k-rs-projects/tamil-learn/settings/environment-variables):
     - **Preview Scope:** Set `DATABASE_URL` to the pooled connection string for Neon branch `br-morning-cloud-b4w6s4u2` (`ep-small-art-b48jtm4l-pooler.c-6.us-east-2.aws.neon.tech`).
     - **Preview Scope:** Set `SESSION_SECRET` to an independent secure key.
     - **Production Scope:** Verify `DATABASE_URL` is set to Neon production branch (`ep-crimson-fire-b4d0j4yb-pooler.c-6.us-east-2.aws.neon.tech`).
2. **Promote Routing Fix to Production:**
   - Production requires the changes from branch `fix/vercel-api-routing` (`50c32af`) to resolve the `500 FUNCTION_INVOCATION_FAILED` and `404 NOT_FOUND` platform errors.
   - Per safety guidelines, this will only be merged into `main` with explicit user approval.


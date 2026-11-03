# Admin Credential Reset Report

**Last updated:** 2026-11-03 (IST)
**Requested change:** rename the existing Production admin to `Saranya` and set a new password.
**Account update status:** ⏳ **Not yet applied.** It is ready to run with `npm run admin:reset`, which you run yourself.

No password, hash, connection string or secret appears in this report.

---

## 1. Why the agent did not apply it

- **Standing rule:** agents never run SQL against the production database; the owner applies production changes. The rule dates from 2026-10-29, when an agent migrated production without reporting it.
- **Password entry:** the password has to be typed into a hidden terminal prompt. Only the owner can do that.

So the agent inspected the code, verified the environment, and prepared a guarded script. It never connected to the production database.

## 2. Authentication implementation (inspected)

| Item | Finding |
|---|---|
| Table | `admins(id TEXT PK, username TEXT UNIQUE, password_hash TEXT, role ∈ {super_admin, school_admin}, school_id, failed_attempts, locked_until)` |
| Hashing | `bcryptjs`, cost **12** (`scripts/create-admin.ts`) |
| Login | `POST /api/admin/login` → `getAdminByUsername` uses `username ILIKE $1`, which is **case-insensitive**, then `bcrypt.compare` |
| Lockout | `failed_attempts` / `locked_until` on the admin row |
| Session check | `GET /api/admin/session` returns the cookie session's `username` and `role` |
| Existing scripts | `npm run admin:create` upserts on username, so it would **create a new** admin under a new name. That makes it unsuitable for a rename. |

## 3. Database environment verification

Verified from Neon project metadata via `neonctl`. No SQL was run.

| | Neon project | Branch | Compute endpoint |
|---|---|---|---|
| **Production** | `TAMIL-LEARN` (`rapid-firefly-97976873`) | `production` (`br-old-bird-b4qzyxzx`, **default**) | **`ep-crimson-fire-b4d0j4yb`** |
| Preview | `TAMIL-LEARN` | `preview` (`br-morning-cloud-b4w6s4u2`) | `ep-small-art-b48jtm4l` |
| Test | `withered-credit-99248455` | — | — |

- The `DATABASE_URL` that Vercel provides for the `tamil-learn` project resolves to `ep-crimson-fire-b4d0j4yb`.
- The older production project (`lingering-butterfly-31775948`, `ep-late-haze`) is no longer in this Neon account.
- **Not verified:** the agent couldn't read Vercel's *Production*-scoped variables (blocked), and `vercel env ls` lists no project-level vars. Check in the Vercel dashboard that Production's `DATABASE_URL` points at `ep-crimson-fire`.
- ⚠️ The local `.env.local` currently points at **production**, overwritten by `vercel link` on 2026-11-03. Any local script or test that uses `DATABASE_URL` will hit production.

## 4. Safeguards in `scripts/reset-admin-credentials.ts`

- Exits without connecting unless the endpoint is exactly `ep-crimson-fire-b4d0j4yb` (tested: the preview endpoint and a malformed URL are both rejected).
- Lists existing admins (id, username, role, school, lock state; no hashes). You pick the admin by ID; if there is only one, it's the default.
- Aborts if another admin already holds `Saranya` in any letter case (login is case-insensitive).
- Hidden password prompt, entered twice, minimum 12 characters. Refuses to run without a TTY rather than show the password.
- Requires typing `UPDATE` to proceed.
- Runs a single `UPDATE admins SET username, password_hash WHERE id = … AND username = <old>` that must affect exactly 1 row. id, role, school_id and lockout state are untouched. A lockout is cleared only if you answer `y`.
- No inserts or deletes, no student tables, no migrations, `SESSION_SECRET` untouched.

## 5. Verification (performed by the script after the update)

| Check | Result |
|---|---|
| `Saranya` exists exactly once (case-insensitive) | _pending run_ |
| Admin ID unchanged | _pending run_ |
| Role and school unchanged | _pending run_ |
| Stored value is a bcrypt cost-12 hash | _pending run_ |
| Stored hash matches the new password | _pending run_ |
| `POST /api/admin/login` on tamil-learn-alpha.vercel.app | _pending_: **production API currently down** (404 / `ERR_MODULE_NOT_FOUND`); fix in PR santhosh2564/TAMIL-LEARN#1 |
| `GET /api/admin/session` / dashboard access | _pending_: same |

## 6. How to run

```bash
npm run admin:reset
```

Run it in your own terminal (PowerShell or Windows Terminal). The live login test only passes after PR #1 is deployed to production and Production has `DATABASE_URL` and `SESSION_SECRET` set. You can rerun just the login part later by signing in at `/setup` or `/admin/login`.

After running, record the results in section 5 with the timestamp the script prints.

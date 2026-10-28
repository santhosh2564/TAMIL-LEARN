   # Sara Learning Platform

A React and TypeScript learning platform for Tamil and English activities, built for Class 2–3 children in government schools. Uses Vite + React 18 + TypeScript on the front end, Neon Lakebase Postgres on the back end, and deploys to Vercel.

## Requirements

- Node.js (current LTS)
- npm (included with Node.js)
- A Neon Postgres database (see [neon.tech](https://neon.tech))

## Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon pooled connection string |
| `SESSION_SECRET` | ✅ | Random string ≥ 32 chars for signing admin session JWTs |

Generate a strong `SESSION_SECRET`:

```bash
openssl rand -base64 48
```

> **Never commit `.env.local` or any file containing real secrets.**
> The server refuses to start if `DATABASE_URL` or `SESSION_SECRET` are missing or invalid.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the database migration:

   ```bash
   npm run db:migrate
   ```

3. Create the first admin user:

   ```bash
   npm run admin:create
   ```

   Follow the prompts. Password is not echoed. Minimum 12 characters.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the URL printed in the terminal (usually <http://localhost:5173>).

## Other commands

```bash
npm run build          # Type-check and create a production build in dist/
npm run preview        # Serve the production build locally (run after build)
npm run lint           # Check source files with ESLint
npm test               # Run the Vitest test suite (src + server)
npm run admin:create   # Create or update an admin user in the database
npm run db:migrate     # Run database migrations (idempotent)
```

## Vercel deployment

1. Set `DATABASE_URL` and `SESSION_SECRET` in your Vercel project's environment variables.
2. Deploy. The `api/` directory contains the Vercel serverless functions.
3. `vercel.json` excludes `/api/*` from the SPA catch-all rewrite so API routes are served correctly.

### Verify the deployment

See [Deployment Verification Checklist](#deployment-verification-checklist) below.

## Deployment Verification Checklist

After deploying a new version to a Vercel preview or production deployment:

### a) Health check returns JSON

```bash
curl https://your-deployment.vercel.app/api/health
# Expected: {"status":"ok","database":"connected"}
```

### b) Admin login sets a cookie

```bash
curl -c cookies.txt -X POST https://your-deployment.vercel.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"youradmin","password":"yourpassword"}'
# Expected: 200 {"user":{"id":"...","username":"youradmin","role":"...",...}}
# The response sets a Set-Cookie header with sara_admin_session=<token>
```

### c) Protected route returns 401 without cookie, 200 with it

```bash
# Without cookie — must return 401
curl https://your-deployment.vercel.app/api/students
# Expected: 401 {"error":"Authentication required"}

# With cookie from step b — must return 200
curl -b cookies.txt https://your-deployment.vercel.app/api/students
# Expected: 200 {"students":[...]}
```

### d) Session endpoint rehydrates auth state

```bash
curl -b cookies.txt https://your-deployment.vercel.app/api/admin/session
# Expected: 200 {"user":{"id":"...","username":"...","role":"..."}}
```

### e) Logout clears the cookie

```bash
curl -b cookies.txt -c cookies.txt -X POST https://your-deployment.vercel.app/api/admin/logout
# Expected: 200 {"success":true}

curl -b cookies.txt https://your-deployment.vercel.app/api/students
# Expected: 401 (cookie was cleared)
```

## Content tools

```bash
npm run content:check            # Validate Tamil/English content
npm run content:runtime-check    # Check activity runtime compatibility
npm run content:assets-check     # Validate referenced media assets
npm run content:english-check    # Validate English content
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for an overview of the source layout and application design.

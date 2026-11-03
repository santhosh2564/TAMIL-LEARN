#!/usr/bin/env tsx
/**
 * scripts/reset-admin-credentials.ts
 *
 * Renames an EXISTING admin and sets a new password, in place.
 * Keeps the admin's id, role, school_id and lockout state (unless you choose
 * to clear a lockout). Never creates or deletes admins.
 *
 * Usage (run it yourself, in a real terminal):
 *   npm run admin:reset
 *
 * Safety:
 *   - Refuses to run unless the database endpoint is the TAMIL-LEARN Neon
 *     project's production branch (EXPECTED_ENDPOINT below).
 *   - Password is read with hidden input; never echoed, logged or written to disk.
 *   - Prints no connection strings, hashes or passwords.
 *   - The UPDATE matches both id and the current username, and must hit exactly one row.
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

// Neon project TAMIL-LEARN (rapid-firefly-97976873), branch `production` (br-old-bird-b4qzyxzx)
const EXPECTED_ENDPOINT = 'ep-crimson-fire-b4d0j4yb';
const NEW_USERNAME = 'Saranya';
const BCRYPT_COST = 12; // same as scripts/create-admin.ts
const PROD_ORIGIN = 'https://tamil-learn-alpha.vercel.app';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('\n❌  DATABASE_URL is not set. Cannot connect to the database.\n');
  process.exit(1);
}

let endpointId: string;
try {
  endpointId = new URL(dbUrl).hostname.split('.')[0].replace(/-pooler$/, '');
} catch {
  console.error('\n❌  DATABASE_URL is not a valid URL.\n');
  process.exit(1);
}
if (endpointId !== EXPECTED_ENDPOINT) {
  console.error(
    `\n❌  Database endpoint is "${endpointId}", expected the production endpoint "${EXPECTED_ENDPOINT}".` +
      '\n    Nothing was changed.\n'
  );
  process.exit(1);
}

// ── Readline helpers ──────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

/** Read a password without echoing it. Refuses to run without a TTY. */
function askPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      console.error('\n❌  Not a TTY — refusing to read a password with visible input.\n');
      process.exit(1);
    }
    process.stdout.write(prompt);
    rl.pause();
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let password = '';
    const onData = (ch: string) => {
      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.resume();
        resolve(password);
      } else if (ch === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        process.exit(0);
      } else if (ch === '\u007f' || ch === '\b') {
        password = password.slice(0, -1);
      } else {
        password += ch;
      }
    };
    process.stdin.on('data', onData);
  });
}

interface AdminRow {
  id: string;
  username: string;
  role: string;
  school_id: string | null;
  failed_attempts: number;
  locked_until: string | null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n━━━ Sara Learning Platform — Reset Admin Credentials ━━━\n');
  console.log(`Database endpoint verified: ${endpointId} (TAMIL-LEARN / production)\n`);

  const sql = neon(dbUrl!);

  const admins = (await sql.query(
    'SELECT id, username, role, school_id, failed_attempts, locked_until FROM admins ORDER BY id;'
  )) as AdminRow[];

  if (admins.length === 0) {
    console.error('❌  No admins exist. This script only updates an existing admin. Nothing was changed.');
    process.exit(1);
  }

  console.log('Existing admins:');
  for (const a of admins) {
    const lock = a.locked_until && new Date(a.locked_until) > new Date() ? ' [LOCKED]' : '';
    console.log(`  ${a.id}  ${a.username}  ${a.role}  school=${a.school_id ?? '-'}${lock}`);
  }
  console.log('');

  const defaultId = admins.length === 1 ? admins[0].id : '';
  const idInput = await ask(`Admin ID to rename to "${NEW_USERNAME}"${defaultId ? ` [${defaultId}]` : ''}: `);
  const targetId = idInput || defaultId;
  const target = admins.find((a) => a.id === targetId);
  if (!target) {
    console.error('❌  No admin with that ID. Nothing was changed.');
    process.exit(1);
  }

  // Login uses `username ILIKE $1`, so a case-variant on another row would shadow this one.
  const clash = admins.find(
    (a) => a.id !== target.id && a.username.toLowerCase() === NEW_USERNAME.toLowerCase()
  );
  if (clash) {
    console.error(`❌  Admin ${clash.id} already uses "${clash.username}". Nothing was changed.`);
    process.exit(1);
  }

  const password = await askPassword('New password (min 12 chars, not echoed): ');
  if (password.length < 12) {
    console.error('❌  Password must be at least 12 characters. Nothing was changed.');
    process.exit(1);
  }
  const confirm = await askPassword('Confirm password: ');
  if (password !== confirm) {
    console.error('❌  Passwords do not match. Nothing was changed.');
    process.exit(1);
  }

  const go = await ask(
    `\nUpdate admin ${target.id} ("${target.username}" → "${NEW_USERNAME}", new password)? Type UPDATE to continue: `
  );
  if (go !== 'UPDATE') {
    console.log('Cancelled. Nothing was changed.');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const updated = (await sql.query(
    'UPDATE admins SET username = $1, password_hash = $2 WHERE id = $3 AND username = $4 RETURNING id;',
    [NEW_USERNAME, passwordHash, target.id, target.username]
  )) as { id: string }[];
  if (updated.length !== 1) {
    console.error(`❌  Expected to update 1 row, updated ${updated.length}. Check the admins table.`);
    process.exit(1);
  }
  console.log('✅  Admin updated.\n');

  // ── Verification ────────────────────────────────────────────────────────────
  const checks: [string, boolean][] = [];
  const matches = (await sql.query(
    'SELECT id, username, password_hash, role, school_id FROM admins WHERE username ILIKE $1;',
    [NEW_USERNAME]
  )) as (AdminRow & { password_hash: string })[];
  const row = matches[0];

  checks.push([`Username "${NEW_USERNAME}" exists exactly once`, matches.length === 1 && row.username === NEW_USERNAME]);
  checks.push(['Admin ID unchanged', row?.id === target.id]);
  checks.push(['Role and school unchanged', row?.role === target.role && row?.school_id === target.school_id]);
  checks.push([`Stored value is a bcrypt hash (cost ${BCRYPT_COST})`, /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(row?.password_hash ?? '')]);
  checks.push(['Stored hash matches the new password', !!row && (await bcrypt.compare(password, row.password_hash))]);

  for (const [label, ok] of checks) console.log(`  ${ok ? '✅' : '❌'}  ${label}`);
  if (checks.some(([, ok]) => !ok)) {
    console.error('\n❌  Verification failed. No further changes made.\n');
    process.exit(1);
  }

  const locked = target.locked_until && new Date(target.locked_until) > new Date();
  if (locked || target.failed_attempts > 0) {
    const clear = await ask(
      `\nThis admin has ${target.failed_attempts} failed attempt(s)${locked ? ' and is LOCKED' : ''}. Clear the lockout? (y/N): `
    );
    if (clear.toLowerCase() === 'y') {
      await sql.query('UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = $1;', [target.id]);
      console.log('  ✅  Lockout cleared.');
    }
  }

  // ── Optional live login test ────────────────────────────────────────────────
  const test = await ask(`\nTest login against ${PROD_ORIGIN}? (y/N): `);
  if (test.toLowerCase() === 'y') {
    const login = await fetch(`${PROD_ORIGIN}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: NEW_USERNAME, password }),
    });
    console.log(`  POST /api/admin/login   → ${login.status}`);
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
    if (login.ok && cookie) {
      const session = await fetch(`${PROD_ORIGIN}/api/admin/session`, { headers: { cookie } });
      const body = (await session.json().catch(() => ({}))) as { user?: { username?: string; role?: string } };
      console.log(`  GET  /api/admin/session → ${session.status} (user=${body.user?.username ?? '-'}, role=${body.user?.role ?? '-'})`);
    } else if (login.status === 404 || login.status >= 500) {
      console.log('  The production API is not serving logins yet (see PR #1). The account itself is updated.');
    }
  }

  console.log(`\nDone at ${new Date().toISOString()}\n`);
  rl.close();
}

main().catch((err: unknown) => {
  // Print only the message; driver errors can include the connection host but not credentials.
  console.error('\n❌  Error:', err instanceof Error ? err.message : 'unknown error');
  process.exit(1);
});

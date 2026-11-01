#!/usr/bin/env tsx
/**
 * scripts/create-admin.ts
 *
 * CLI tool to create or update an admin user in the database.
 *
 * Usage:
 *   npm run admin:create
 *
 * Requirements:
 *   - DATABASE_URL must be set (via .env.local or environment)
 *   - Password must be at least 12 characters
 *   - Role must be 'super_admin' or 'school_admin'
 *
 * Security:
 *   - Password is never echoed to the terminal
 *   - Hash is computed with bcrypt (cost factor 12)
 *   - Script never writes the plaintext password to disk
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { upsertAdminInDb } from '../server/db';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Validate DATABASE_URL early
if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  console.error('\n❌  DATABASE_URL is not set. Cannot connect to the database.\n');
  process.exit(1);
}

// ── Readline helpers ──────────────────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Read a password without echoing it to the terminal.
 * Falls back to normal readline if not a TTY (e.g. piped input in CI).
 */
function askPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      process.stdout.write(prompt);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      let password = '';
      const onData = (ch: string) => {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
        } else if (ch === '\u0003') {
          // Ctrl+C
          process.stdout.write('\n');
          process.exit(0);
        } else if (ch === '\u007f' || ch === '\b') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
        } else {
          password += ch;
        }
      };
      process.stdin.on('data', onData);
    } else {
      // Not a TTY — use normal readline (password will be visible)
      rl.question(prompt + ' [input visible — not a TTY] ', (answer) =>
        resolve(answer.trim())
      );
    }
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n━━━ Sara Learning Platform — Create Admin ━━━\n');

  // Username
  const username = await ask('Username: ');
  if (!username || username.length < 2) {
    console.error('❌  Username must be at least 2 characters.');
    process.exit(1);
  }

  // Role
  const roleInput = await ask('Role (super_admin / school_admin) [default: school_admin]: ');
  const role =
    roleInput === 'super_admin'
      ? 'super_admin'
      : roleInput === 'school_admin' || roleInput === ''
        ? 'school_admin'
        : null;

  if (!role) {
    console.error('❌  Role must be "super_admin" or "school_admin".');
    process.exit(1);
  }

  // School ID (required for school_admin, ignored for super_admin)
  let schoolId: string | null = null;
  if (role === 'school_admin') {
    schoolId = await ask('School ID (leave blank to assign later): ');
    if (!schoolId) schoolId = null;
  }

  // Password (hidden input)
  const password = await askPassword('Password (min 12 chars, not echoed): ');
  if (password.length < 12) {
    console.error('❌  Password must be at least 12 characters.');
    process.exit(1);
  }

  // Confirm password
  const confirm = await askPassword('Confirm password: ');
  if (password !== confirm) {
    console.error('❌  Passwords do not match.');
    process.exit(1);
  }

  rl.close();

  console.log('\nHashing password (bcrypt cost 12)…');
  const passwordHash = await bcrypt.hash(password, 12);

  const id = `adm_${crypto.randomBytes(8).toString('hex')}`;

  console.log('Writing to database…');
  await upsertAdminInDb({ id, username, passwordHash, role, schoolId });

  console.log(`\n✅  Admin created successfully:`);
  console.log(`    Username : ${username}`);
  console.log(`    Role     : ${role}`);
  console.log(`    School   : ${schoolId ?? '(none — assign in Phase 2)'}`);
  console.log(`    ID       : ${id}`);
  console.log('\nYou can now log in at /admin/login\n');
}

main().catch((err: unknown) => {
  console.error('\n❌ ', err instanceof Error ? err.message : err);
  process.exit(1);
});


import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import { runMigrations } from '../server/db';

// Migrates the TEST branch only. Production migrations are applied by hand from
// server/migrations/pending_production.sql, so this script refuses DATABASE_URL.
async function main() {
  const target = process.env.TEST_DATABASE_URL;
  if (!target) {
    throw new Error('TEST_DATABASE_URL is not set.');
  }
  if (process.env.DATABASE_URL && target.trim() === process.env.DATABASE_URL.trim()) {
    throw new Error('TEST_DATABASE_URL equals DATABASE_URL (production). Refusing to migrate.');
  }

  const host = new URL(target).host;
  console.log('Running migrations against TEST endpoint:', host);
  const sql = neon(target);
  await runMigrations(sql);
  console.log('✓ Migrations successfully executed!');

  const tables = await sql.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log('Current public tables:');
  console.table(tables);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

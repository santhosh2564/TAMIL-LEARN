import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local if DATABASE_URL is not set
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import { runMigrations, getDb } from '../server/db';

async function main() {
  console.log('Running Neon PostgreSQL migrations on branch:', process.env.NEON_BRANCH || 'default');
  await runMigrations();
  console.log('✓ Migrations successfully executed!');

  // Verify tables created
  const sql = getDb();
  const tables = await sql.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log('Current public tables in Neon database:');
  console.table(tables);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

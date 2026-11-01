import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from '../server/db';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Applies server/migrations/pending_production.sql to the target database.
// Target can be passed via PRODUCTION_DATABASE_URL or DATABASE_URL.
async function main() {
  const target = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
  if (!target) {
    throw new Error('Neither PRODUCTION_DATABASE_URL nor DATABASE_URL is set.');
  }

  const host = new URL(target).host;
  console.log('Running pending_production.sql against endpoint:', host);

  const sqlFile = path.resolve(process.cwd(), 'server', 'migrations', 'pending_production.sql');
  if (!fs.existsSync(sqlFile)) {
    throw new Error(`Migration file not found at ${sqlFile}`);
  }

  const content = fs.readFileSync(sqlFile, 'utf8');
  const sql = neon(target);

  // Strip BEGIN and COMMIT for statement-by-statement execution over HTTP driver
  const statements = splitSqlStatements(content).filter((s) => {
    const trimmed = s.trim().toUpperCase();
    return trimmed !== 'BEGIN' && trimmed !== 'COMMIT';
  });

  console.log(`Executing ${statements.length} statements...`);
  const startTime = Date.now();

  for (let i = 0; i < statements.length; i++) {
    await sql.query(statements[i]);
  }

  const duration = Date.now() - startTime;
  console.log(`✓ Production migration executed successfully (${statements.length} statements in ${duration}ms)!`);

  const tables = await sql.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log('Current public tables:');
  console.table(tables);
}

main().catch((err) => {
  console.error('Production migration failed:', err);
  process.exit(1);
});


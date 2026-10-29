/**
 * Prints a schema fingerprint (tables, columns, constraints, indexes, row counts) for a
 * connection URL. Read-only. Refuses the production DATABASE_URL.
 *   npx tsx scripts/schema-fingerprint.ts <connection-url>
 */
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const url = process.argv[2];
  if (!url) throw new Error('Usage: schema-fingerprint.ts <connection-url>');
  for (const prod of [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED]) {
    if (prod && new URL(prod).host.replace('-pooler', '') === new URL(url).host.replace('-pooler', '')) {
      throw new Error('Target is the production endpoint. Refusing.');
    }
  }
  const sql = neon(url);
  const branch = (await sql.query(`SELECT current_setting('neon.branch_id', true) AS b`)) as { b: string }[];
  console.log(`endpoint ${new URL(url).host}  branch ${branch[0].b}`);

  const tables = (await sql.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`
  )) as { table_name: string }[];
  const columns = (await sql.query(
    `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`
  )) as { table_name: string; column_name: string; data_type: string; is_nullable: string }[];
  const constraints = (await sql.query(
    `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY 1, 2`
  )) as { tbl: string; conname: string; def: string }[];
  const indexes = (await sql.query(
    `SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1, 2`
  )) as { tablename: string; indexname: string }[];

  for (const t of tables) {
    const n = (await sql.query(`SELECT count(*)::int AS n FROM "${t.table_name}"`)) as { n: number }[];
    const cols = columns.filter((c) => c.table_name === t.table_name).map((c) => c.column_name);
    console.log(`  ${t.table_name} (${n[0].n} rows): ${cols.join(', ')}`);
  }
  console.log(`  constraints: ${constraints.map((c) => c.conname).join(', ')}`);
  console.log(`  indexes: ${indexes.length}`);

  const fp = crypto
    .createHash('sha256')
    .update(JSON.stringify({ tables, columns, constraints, indexes }))
    .digest('hex')
    .slice(0, 16);
  console.log(`  schema fingerprint: ${fp}`);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});

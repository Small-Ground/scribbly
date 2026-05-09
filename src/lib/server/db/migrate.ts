/**
 * Applies the SQL migrations under /drizzle to the configured DATABASE_URL.
 * Run with: npm run db:migrate
 *
 * Idempotent: every CREATE statement uses IF NOT EXISTS, every ALTER lives
 * inside a DO $$ block that catches duplicate_object. Re-running on an
 * already-migrated database is a no-op.
 */
import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Aborting migrate.');
    process.exit(1);
  }
  const sql = neon(url);
  const dir = resolve(process.cwd(), 'drizzle');
  const files = (await readdir(dir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const f of files) {
    const path = resolve(dir, f);
    const text = await readFile(path, 'utf8');
    // Drizzle separates statements with `--> statement-breakpoint`.
    const statements = text
      .split(/-->\s*statement-breakpoint/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    console.log(`Applying ${f} (${statements.length} statement${statements.length === 1 ? '' : 's'})`);
    for (const stmt of statements) {
      // @neondatabase/serverless `neon()` returns a callable; passing a raw
      // string runs it as a single statement (DDL is fine here).
      await (sql as unknown as (q: string) => Promise<unknown>)(stmt);
    }
  }
  console.log('Migrations complete.');
}

main().catch((err) => {
  console.error('Migrate failed:', err);
  process.exit(1);
});

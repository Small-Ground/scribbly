/**
 * Seeds the four demo users used by the username-switcher login.
 * Run with: npm run db:seed
 *
 * Idempotent: re-running will not duplicate users.
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from './schema';

const SEED_USERS = [
  { name: 'Alice Nakamura', email: 'alice@scribbly.demo', color: '#6366f1' },
  { name: 'Bob Olawale', email: 'bob@scribbly.demo', color: '#16a34a' },
  { name: 'Carol Reyes', email: 'carol@scribbly.demo', color: '#db2777' },
  { name: 'Dan Petrov', email: 'dan@scribbly.demo', color: '#ea580c' }
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Aborting seed.');
    process.exit(1);
  }
  const sql = neon(url);
  const db = drizzle(sql, { schema });

  for (const u of SEED_USERS) {
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, u.email))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(schema.users).values({ name: u.name, email: u.email, color: u.color });
      console.log(`Inserted ${u.name}`);
    } else {
      console.log(`Already exists: ${u.name}`);
    }
  }
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

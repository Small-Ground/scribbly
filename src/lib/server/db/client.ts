import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

if (!env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill in your Neon connection string.'
  );
}

// Strip BOM (U+FEFF) and surrounding whitespace defensively. Some shell
// pipes (notably PowerShell's UTF-8 pipe encoding) prepend a BOM when
// passing values into `vercel env add`, which then fails neon() URL parsing.
const url = env.DATABASE_URL.replace(/^﻿/, '').trim();

const sql = neon(url);
export const db = drizzle(sql, { schema });
export { schema };

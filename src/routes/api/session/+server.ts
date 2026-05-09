import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema } from '$lib/server/db/client';
import { eq } from 'drizzle-orm';
import { encodeSession, sessionCookieName, sessionMaxAge } from '$lib/server/auth';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request, cookies }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    error(400, 'Body must be JSON');
  }
  const userId = (body as { userId?: unknown })?.userId;
  if (typeof userId !== 'string' || userId.length === 0) {
    error(400, 'userId is required');
  }

  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (rows.length === 0) error(404, 'Unknown user');

  cookies.set(sessionCookieName, encodeSession(userId), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: !dev,
    maxAge: sessionMaxAge
  });
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
  cookies.delete(sessionCookieName, { path: '/' });
  return json({ ok: true });
};

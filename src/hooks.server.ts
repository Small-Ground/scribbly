import type { Handle } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { decodeSession, sessionCookieName } from '$lib/server/auth';
import { db, schema } from '$lib/server/db/client';

export const handle: Handle = async ({ event, resolve }) => {
  const raw = event.cookies.get(sessionCookieName);
  const userId = decodeSession(raw);

  if (userId) {
    const rows = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        color: schema.users.color
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    event.locals.user = rows[0] ?? null;
    if (!rows[0]) {
      // Session points at a user that no longer exists. Clear it.
      event.cookies.delete(sessionCookieName, { path: '/' });
    }
  } else {
    event.locals.user = null;
  }

  return resolve(event);
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema } from '$lib/server/db/client';
import { asc } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
  const users = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      color: schema.users.color
    })
    .from(schema.users)
    .orderBy(asc(schema.users.name));
  return json({ users });
};

import type { LayoutServerLoad } from './$types';
import { db, schema } from '$lib/server/db/client';
import { asc } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
  // Always expose the seeded user list for the top-right switcher.
  const allUsers = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      color: schema.users.color
    })
    .from(schema.users)
    .orderBy(asc(schema.users.name));

  return {
    user: locals.user,
    allUsers
  };
};

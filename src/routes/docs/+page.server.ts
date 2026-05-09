import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, schema } from '$lib/server/db/client';
import { desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/');
  const me = locals.user.id;

  const owned = await db
    .select({
      id: schema.documents.id,
      title: schema.documents.title,
      updatedAt: schema.documents.updatedAt
    })
    .from(schema.documents)
    .where(eq(schema.documents.ownerId, me))
    .orderBy(desc(schema.documents.updatedAt));

  const shared = await db
    .select({
      id: schema.documents.id,
      title: schema.documents.title,
      updatedAt: schema.documents.updatedAt,
      ownerName: schema.users.name,
      ownerColor: schema.users.color
    })
    .from(schema.shares)
    .innerJoin(schema.documents, eq(schema.shares.documentId, schema.documents.id))
    .innerJoin(schema.users, eq(schema.documents.ownerId, schema.users.id))
    .where(eq(schema.shares.userId, me))
    .orderBy(desc(schema.documents.updatedAt));

  return { owned, shared };
};

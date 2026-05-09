import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema } from '$lib/server/db/client';
import { and, desc, eq } from 'drizzle-orm';
import { sanitizeContentHtml, sanitizeTitle } from '$lib/server/sanitize';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) error(401, 'Not authenticated');
  const me = locals.user.id;

  const owned = await db
    .select({
      id: schema.documents.id,
      title: schema.documents.title,
      updatedAt: schema.documents.updatedAt,
      ownerId: schema.documents.ownerId
    })
    .from(schema.documents)
    .where(eq(schema.documents.ownerId, me))
    .orderBy(desc(schema.documents.updatedAt));

  const sharedRows = await db
    .select({
      id: schema.documents.id,
      title: schema.documents.title,
      updatedAt: schema.documents.updatedAt,
      ownerId: schema.documents.ownerId,
      ownerName: schema.users.name,
      ownerColor: schema.users.color
    })
    .from(schema.shares)
    .innerJoin(schema.documents, eq(schema.shares.documentId, schema.documents.id))
    .innerJoin(schema.users, eq(schema.documents.ownerId, schema.users.id))
    .where(eq(schema.shares.userId, me))
    .orderBy(desc(schema.documents.updatedAt));

  return json({ owned, shared: sharedRows });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) error(401, 'Not authenticated');

  let body: { title?: unknown; contentHtml?: unknown } = {};
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      body = await request.json();
    } catch {
      // empty body is fine; we'll create a blank doc
    }
  }

  const title =
    typeof body.title === 'string' && body.title.length > 0
      ? sanitizeTitle(body.title)
      : 'Untitled document';
  const contentHtml =
    typeof body.contentHtml === 'string' ? sanitizeContentHtml(body.contentHtml) : '<p></p>';

  const [created] = await db
    .insert(schema.documents)
    .values({ ownerId: locals.user.id, title, contentHtml })
    .returning({ id: schema.documents.id });

  return json({ id: created.id }, { status: 201 });
};

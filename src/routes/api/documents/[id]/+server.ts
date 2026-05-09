import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema } from '$lib/server/db/client';
import { eq } from 'drizzle-orm';
import { sanitizeContentHtml, sanitizeTitle } from '$lib/server/sanitize';
import { canDelete, canEdit, canRead } from '$lib/server/permissions';

async function loadDocAndShares(id: string) {
  const docRows = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, id))
    .limit(1);
  if (docRows.length === 0) return null;
  const shareRows = await db
    .select({ documentId: schema.shares.documentId, userId: schema.shares.userId })
    .from(schema.shares)
    .where(eq(schema.shares.documentId, id));
  return { doc: docRows[0], shares: shareRows };
}

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) error(401, 'Not authenticated');
  if (!isUuid(params.id)) error(400, 'Invalid id');

  const found = await loadDocAndShares(params.id);
  if (!found) error(404, 'Document not found');
  if (!canRead(locals.user, found.doc, found.shares)) error(403, 'No access');

  const ownerRows = await db
    .select({ id: schema.users.id, name: schema.users.name, color: schema.users.color })
    .from(schema.users)
    .where(eq(schema.users.id, found.doc.ownerId))
    .limit(1);

  return json({
    document: found.doc,
    owner: ownerRows[0] ?? null,
    shares: found.shares.map((s) => s.userId)
  });
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) error(401, 'Not authenticated');
  if (!isUuid(params.id)) error(400, 'Invalid id');

  const found = await loadDocAndShares(params.id);
  if (!found) error(404, 'Document not found');
  if (!canEdit(locals.user, found.doc, found.shares)) error(403, 'No access');

  let body: { title?: unknown; contentHtml?: unknown; contentJson?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Body must be JSON');
  }

  const updates: Partial<typeof schema.documents.$inferInsert> = {
    updatedAt: new Date()
  };
  if (typeof body.title === 'string') updates.title = sanitizeTitle(body.title);
  if (typeof body.contentHtml === 'string')
    updates.contentHtml = sanitizeContentHtml(body.contentHtml);
  if (body.contentJson !== undefined) {
    if (body.contentJson === null || typeof body.contentJson === 'object') {
      updates.contentJson = body.contentJson as object | null;
    }
  }

  await db.update(schema.documents).set(updates).where(eq(schema.documents.id, params.id));
  return json({ ok: true, updatedAt: updates.updatedAt });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) error(401, 'Not authenticated');
  if (!isUuid(params.id)) error(400, 'Invalid id');

  const found = await loadDocAndShares(params.id);
  if (!found) error(404, 'Document not found');
  if (!canDelete(locals.user, found.doc)) error(403, 'Owner only');

  await db.delete(schema.documents).where(eq(schema.documents.id, params.id));
  return json({ ok: true });
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

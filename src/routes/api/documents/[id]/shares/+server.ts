import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema } from '$lib/server/db/client';
import { and, eq } from 'drizzle-orm';
import { canManageShares } from '$lib/server/permissions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string) => UUID_RE.test(s);

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) error(401, 'Not authenticated');
  if (!isUuid(params.id)) error(400, 'Invalid id');

  const docRows = await db
    .select({ ownerId: schema.documents.ownerId })
    .from(schema.documents)
    .where(eq(schema.documents.id, params.id))
    .limit(1);
  if (docRows.length === 0) error(404, 'Document not found');

  const shares = await db
    .select({
      userId: schema.shares.userId,
      name: schema.users.name,
      email: schema.users.email,
      color: schema.users.color
    })
    .from(schema.shares)
    .innerJoin(schema.users, eq(schema.shares.userId, schema.users.id))
    .where(eq(schema.shares.documentId, params.id));

  return json({ shares });
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) error(401, 'Not authenticated');
  if (!isUuid(params.id)) error(400, 'Invalid id');

  const docRows = await db
    .select({ ownerId: schema.documents.ownerId })
    .from(schema.documents)
    .where(eq(schema.documents.id, params.id))
    .limit(1);
  if (docRows.length === 0) error(404, 'Document not found');
  if (!canManageShares(locals.user, docRows[0])) error(403, 'Owner only');

  let body: { userId?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Body must be JSON');
  }
  const userId = body.userId;
  if (typeof userId !== 'string' || !isUuid(userId)) error(400, 'userId must be a uuid');
  if (userId === locals.user.id) error(400, 'Cannot share with yourself');

  // Confirm target user exists.
  const target = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (target.length === 0) error(404, 'Target user not found');

  // Idempotent: skip if already shared.
  const existing = await db
    .select({ id: schema.shares.id })
    .from(schema.shares)
    .where(and(eq(schema.shares.documentId, params.id), eq(schema.shares.userId, userId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(schema.shares).values({ documentId: params.id, userId });
  }

  return json({ ok: true });
};

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema } from '$lib/server/db/client';
import { and, eq } from 'drizzle-orm';
import { canManageShares } from '$lib/server/permissions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string) => UUID_RE.test(s);

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) error(401, 'Not authenticated');
  if (!isUuid(params.id) || !isUuid(params.userId)) error(400, 'Invalid id');

  const docRows = await db
    .select({ ownerId: schema.documents.ownerId })
    .from(schema.documents)
    .where(eq(schema.documents.id, params.id))
    .limit(1);
  if (docRows.length === 0) error(404, 'Document not found');
  if (!canManageShares(locals.user, docRows[0])) error(403, 'Owner only');

  await db
    .delete(schema.shares)
    .where(
      and(eq(schema.shares.documentId, params.id), eq(schema.shares.userId, params.userId))
    );
  return json({ ok: true });
};

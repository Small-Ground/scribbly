import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, schema } from '$lib/server/db/client';
import { eq } from 'drizzle-orm';
import { canRead } from '$lib/server/permissions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/');
  if (!UUID_RE.test(params.id)) throw error(400, 'Invalid id');

  const docRows = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, params.id))
    .limit(1);
  if (docRows.length === 0) throw error(404, 'Document not found');
  const doc = docRows[0];

  const shareRows = await db
    .select({ documentId: schema.shares.documentId, userId: schema.shares.userId })
    .from(schema.shares)
    .where(eq(schema.shares.documentId, params.id));

  if (!canRead(locals.user, doc, shareRows)) throw error(403, 'You do not have access to this document');

  const ownerRows = await db
    .select({ id: schema.users.id, name: schema.users.name, color: schema.users.color })
    .from(schema.users)
    .where(eq(schema.users.id, doc.ownerId))
    .limit(1);

  return {
    document: {
      id: doc.id,
      title: doc.title,
      contentHtml: doc.contentHtml,
      contentJson: doc.contentJson,
      ownerId: doc.ownerId,
      updatedAt: doc.updatedAt
    },
    owner: ownerRows[0] ?? null,
    isOwner: doc.ownerId === locals.user.id,
    // Single-tier permissions for now: anyone with read access can edit.
    canEdit: true
  };
};

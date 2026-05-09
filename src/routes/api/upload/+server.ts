import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema } from '$lib/server/db/client';
import {
  ImportError,
  MAX_UPLOAD_BYTES,
  SUPPORTED_EXTS,
  importFile
} from '$lib/server/import';

export const config = {
  // Lift the default 1 MB body cap up toward Vercel's hard 4.5 MB limit.
  maxDuration: 30
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) error(401, 'Not authenticated');

  const ctype = request.headers.get('content-type') ?? '';
  if (!ctype.includes('multipart/form-data')) {
    error(415, 'Use multipart/form-data with field name "file"');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    error(400, 'Could not parse form body');
  }

  const file = form.get('file');
  if (!(file instanceof File)) error(400, 'No file uploaded under field "file"');
  if (file.size === 0) error(400, 'Uploaded file is empty');
  if (file.size > MAX_UPLOAD_BYTES) {
    error(413, `File too large. Max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let imported;
  try {
    imported = await importFile({
      filename: file.name || 'upload',
      mime: file.type || 'application/octet-stream',
      buffer
    });
  } catch (err) {
    if (err instanceof ImportError) {
      const status = err.code === 'TOO_LARGE' ? 413 : err.code === 'UNSUPPORTED_EXT' ? 415 : 400;
      error(status, err.message);
    }
    console.error('Import failed:', err);
    error(400, 'Could not parse uploaded file');
  }

  const [created] = await db
    .insert(schema.documents)
    .values({
      ownerId: locals.user.id,
      title: imported.title,
      contentHtml: imported.contentHtml
    })
    .returning({ id: schema.documents.id });

  return json({ id: created.id, supported: SUPPORTED_EXTS }, { status: 201 });
};

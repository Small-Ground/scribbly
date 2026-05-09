import mammoth from 'mammoth';
import { marked } from 'marked';
import { sanitizeContentHtml } from './sanitize';
import { MAX_UPLOAD_BYTES, SUPPORTED_EXTS, type SupportedExt } from '$lib/uploads';

export { MAX_UPLOAD_BYTES, SUPPORTED_EXTS };
export type { SupportedExt };

const EXT_MIME: Record<SupportedExt, readonly string[]> = {
  txt: ['text/plain', 'application/octet-stream'],
  md: ['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/octet-stream'
  ]
};

export function extOf(filename: string): SupportedExt | null {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return null;
  const ext = m[1];
  return (SUPPORTED_EXTS as readonly string[]).includes(ext) ? (ext as SupportedExt) : null;
}

export function titleFromFilename(filename: string): string {
  const trimmed = filename.trim();
  const stripped = trimmed.replace(/\.[a-z0-9]+$/i, '').trim();
  return stripped.length ? stripped : 'Untitled document';
}

export function isAllowedMime(ext: SupportedExt, mime: string): boolean {
  return EXT_MIME[ext].includes(mime);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function txtToHtml(text: string): string {
  if (!text.trim()) return '<p></p>';
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`)
    .join('');
}

export async function mdToHtml(md: string): Promise<string> {
  const html = await marked.parse(md, { async: true, gfm: true });
  return html;
}

export async function docxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

export type ImportResult = {
  title: string;
  contentHtml: string;
};

export async function importFile(opts: {
  filename: string;
  mime: string;
  buffer: Buffer;
}): Promise<ImportResult> {
  const ext = extOf(opts.filename);
  if (!ext) {
    throw new ImportError('UNSUPPORTED_EXT', `Unsupported file type: ${opts.filename}`);
  }
  if (!isAllowedMime(ext, opts.mime)) {
    throw new ImportError(
      'BAD_MIME',
      `File extension .${ext} doesn't match content type ${opts.mime}`
    );
  }
  if (opts.buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImportError('TOO_LARGE', `File exceeds ${MAX_UPLOAD_BYTES} bytes`);
  }

  let raw: string;
  switch (ext) {
    case 'txt':
      raw = txtToHtml(opts.buffer.toString('utf8'));
      break;
    case 'md':
      raw = await mdToHtml(opts.buffer.toString('utf8'));
      break;
    case 'docx':
      raw = await docxToHtml(opts.buffer);
      break;
  }

  return {
    title: titleFromFilename(opts.filename),
    contentHtml: sanitizeContentHtml(raw)
  };
}

export class ImportError extends Error {
  constructor(
    public code: 'UNSUPPORTED_EXT' | 'BAD_MIME' | 'TOO_LARGE' | 'PARSE_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

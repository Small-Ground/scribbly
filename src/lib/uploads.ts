/**
 * Constants shared by the upload UI and server. Lives outside `server/` so the
 * browser bundle can read MAX_UPLOAD_BYTES and the supported-extension list
 * for input validation hints.
 */

export type SupportedExt = 'txt' | 'md' | 'docx';

export const SUPPORTED_EXTS: readonly SupportedExt[] = ['txt', 'md', 'docx'];

// Vercel serverless functions cap request bodies at ~4.5 MB. We hard-cap a bit
// below that to give headroom for multipart envelope overhead.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

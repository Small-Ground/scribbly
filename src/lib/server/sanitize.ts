import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'hr'
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {},
  allowedSchemes: [],
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: true
};

/**
 * Strip all HTML except a small allowlist matching the editor's supported marks/blocks.
 * The output is what we persist and what the browser renders.
 */
export function sanitizeContentHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * For document titles: strip ALL HTML, collapse whitespace, hard-cap length.
 */
export function sanitizeTitle(title: string): string {
  const stripped = sanitizeHtml(title, { allowedTags: [], allowedAttributes: {} });
  const collapsed = stripped.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, 200);
}

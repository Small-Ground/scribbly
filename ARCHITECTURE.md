# Architecture Note

## What this is

Scribbly is a small full-stack document editing app. It demonstrates four
capabilities — rich-text editing, file import, sharing, and persistence —
along with the engineering surface that makes those capabilities credible:
a security boundary, a permission model with tests, a deployable footprint,
and clear setup docs.

The brief explicitly favors **depth in a few areas over shallow coverage**
of every Google-Docs-shaped feature, so the architecture choices below were
made with that lens.

## Stack

- **SvelteKit 2 + Svelte 5 (runes) + TypeScript.** A single repo serving both
  the UI and the API. SvelteKit's `+page.server.ts` loaders + `api/+server.ts`
  endpoints kept the moving parts to a minimum versus a separate frontend +
  backend.
- **Drizzle ORM + Neon Postgres (serverless HTTP driver).** Drizzle gives
  type-safe queries with no codegen step. Neon's HTTP driver is the right
  fit for Vercel serverless: no connection pooling tax, no warm-keepalive
  hacks.
- **TipTap (over ProseMirror)** for the editor. Mature, well-documented,
  ergonomic. Has no first-class Svelte wrapper, so the editor component
  uses `@tiptap/core` directly inside `onMount` / `onDestroy`. This is the
  community-documented pattern and works cleanly with Svelte 5 runes.
- **Vercel + `@sveltejs/adapter-vercel`** (Node 20 runtime) for deployment.
  The whole app runs as a small set of Vercel serverless functions plus
  static assets.

## Component picture

```
                      ┌────────────────────────────┐
                      │ Browser                    │
                      │  • TipTap editor (Svelte 5)│
                      │  • Toolbar (inline)        │
                      │  • ShareDialog             │
                      │  • UserSwitcher            │
                      └────────────┬───────────────┘
                                   │ fetch + cookie
                                   ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ SvelteKit server                                                 │
   │                                                                  │
   │  hooks.server.ts                                                 │
   │     ├─ decode signed session cookie -> locals.user               │
   │     └─ falls back to null if cookie is missing/tampered          │
   │                                                                  │
   │  routes/api/...   routes/+page.server.ts                         │
   │     └─ permission check (permissions.ts)                         │
   │         └─ sanitize-html on every write                          │
   │             └─ Drizzle ORM                                       │
   └──────────────────────────────┬───────────────────────────────────┘
                                  ▼
                      ┌────────────────────────────┐
                      │ Neon Postgres              │
                      │  • users                   │
                      │  • documents               │
                      │  • shares                  │
                      └────────────────────────────┘
```

## Data model

Three tables, all with `uuid` primary keys and timestamped rows. Schema in
[`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts).

- **`users`** — id, name, email (unique), color (avatar tint), `created_at`.
  Seeded with four fixed users so reviewers can immediately demo sharing.
- **`documents`** — id, `owner_id` → users, title, **`content_html`**
  (sanitized HTML, what the browser renders), **`content_json`** (the TipTap
  ProseMirror doc, stored as JSONB), timestamps.
- **`shares`** — id, document_id, user_id, with a `UNIQUE(document_id, user_id)`
  index. ON DELETE CASCADE in both directions, so deleting a document
  cleans up its shares automatically.

### Why store HTML *and* JSON

Storing HTML alone means re-parsing it back into TipTap on every load —
that's lossy (some marks/structures don't survive HTML round-trips
perfectly). Storing the ProseMirror JSON gives a guaranteed-lossless reload
into TipTap. Storing the sanitized HTML alongside means rendering, exporting,
and any future server-side transforms don't need ProseMirror in the loop.
The cost is a couple of KB extra per document — acceptable.

## Security boundary

The single load-bearing rule is: **no HTML enters the database without
passing through `sanitize-html` first.** That happens in exactly three
places:

1. `POST /api/documents` (when creating with optional initial body)
2. `PUT /api/documents/[id]` (every save)
3. `POST /api/upload` (after parsing txt/md/docx into HTML)

The allowlist is intentionally narrow — exactly the tags TipTap can
re-render: `p`, `br`, `strong`, `em`, `u`, `s`, `h1–h3`, `ul`, `ol`, `li`,
`blockquote`, `code`, `pre`, `hr`. No attributes are allowed (no `style=`,
no `href`, no `id`). This deliberately rejects user-supplied images and
links — adding them safely is feature work that wasn't in scope.

`tests/sanitize.test.ts` pins this behavior: `<script>`, inline event
handlers, `javascript:` URIs, `<iframe>`, `<img onerror>`, and `style=` are
all expected to be stripped.

The session cookie is HMAC-signed (SHA-256, 32-byte secret) using `timingSafeEqual`
on verify. `httpOnly`, `sameSite=lax`, `secure` in production. Logic in
[`src/lib/server/auth.ts`](src/lib/server/auth.ts).

## Permission model

Sharing is **single-tier**: a shared user can read and edit. The owner is
the only role that can rename shares or delete the document. Viewer/Editor
splitting is listed in the brief's stretch goals — deferred so the core
flows could land cleanly first.

Permission checks live in
[`src/lib/server/permissions.ts`](src/lib/server/permissions.ts) as **pure
functions** that take plain objects (no DB calls). The API route handlers
fetch the document and shares, then ask these functions for a yes/no. This
keeps the rules cheap to test exhaustively without standing up a database
in the test runner. The full read / edit / manage-shares matrix is verified
in [`tests/permissions.test.ts`](tests/permissions.test.ts).

## Save flow & autosave

Document edits go through a debounced autosave: 800 ms after the last
keystroke, the page sends a `PUT /api/documents/[id]` with the current
title, sanitized HTML, and TipTap JSON. The save state is shown in the
header (`Unsaved changes` → `Saving…` → `Saved`).

A `pagehide` listener fires `navigator.sendBeacon` if there's still a
pending dirty save when the user closes the tab — so quick exits don't lose
the last keystroke. `Ctrl/Cmd+S` short-circuits the debounce and flushes
immediately.

## File import pipeline

`src/lib/server/import.ts` exposes a single `importFile({filename, mime,
buffer})` function. Internals:

- `.txt` → escape + line-wrap into `<p>` blocks (`<br>` for blank lines).
- `.md` → `marked` (sync, GFM mode).
- `.docx` → `mammoth.convertToHtml` (pure JS, no native deps — Vercel-safe).
- All three → `sanitize-html` allowlist → ready for insert.

Validation happens before parsing: extension is allowlisted, MIME must
match a known set for the extension, payload must be ≤ 4 MB (kept safely
under Vercel's 4.5 MB serverless body cap). Errors come back as a typed
`ImportError` with codes the route handler maps to HTTP statuses.

## What I prioritized — and what I deliberately left out

**Prioritized:**
- **Editor UX** that *feels* right — autosave with status, keyboard save,
  beacon flush on tab close, focused toolbar with active-state buttons.
- **Sharing UX** that's instantly readable — sidebar split into "My
  documents" and "Shared with me", an "owned by" label inside the doc when
  you're not the owner, a one-dialog share manager.
- **Sanitization correctness** — strict allowlist, tested explicitly with
  adversarial input.
- **Type safety end-to-end** — Drizzle's inferred types, SvelteKit's
  generated `$types`, strict mode, zero `any` in the server code.
- **Deployable from day one** — adapter-vercel + Neon HTTP driver; no
  cleverness that breaks in serverless cold starts.

**Deliberately left out** (the brief asked for depth, not surface area):
- Real authentication (passwords, magic links, OAuth).
- Real-time collaboration / presence indicators (would need a
  collaborative-cursor protocol like Yjs and a websocket server — out of
  scope).
- Comments / suggestion mode (a feature, not infra).
- Document version history (another feature; lightweight to add by
  snapshotting on save, but not core).
- Image and link support (each would need its own sanitization + storage
  story).
- Two-tier sharing (viewer vs editor).

## Trade-offs called out

- **No first-class TipTap-Svelte wrapper.** Mitigated by using `@tiptap/core`
  directly. The editor component is ~30 lines of glue.
- **Neon free-tier cold starts.** First request after idle is 1–3s. For a
  demo this is fine; documented in README.
- **`vite.config.ts` and `vitest.config.ts` kept separate.** Vitest
  internally bundles its own copy of Vite; sharing one config triggers a
  dual-package-hazard `Plugin<any>` type mismatch. The split is the
  documented workaround and keeps `npm run check` clean.
- **Schema is `db:push`-driven, not migration-files-driven.** For a small
  demo that's the lower-friction path. For a real product, switching to
  `drizzle-kit generate` with versioned SQL files in `drizzle/` is a
  drop-in change.

## What I would add next

In order of value added per hour of work:

1. **Viewer/Editor share roles** (~1 hr). Add a `role` enum to `shares`,
   thread it through `permissions.ts`, surface a Viewer/Editor dropdown in
   the share dialog. The pure-function permission layer was designed with
   this in mind.
2. **Document version history** (~2 hrs). New `document_versions` table,
   snapshot on save (debounced), keep last N. UI affordance to revert.
3. **Real auth via magic-link email** (~3 hrs). Resend or Postmark for
   delivery, swap out the user-picker landing page.
4. **Real-time collaboration** (~1+ days). Yjs + a websocket relay, refactor
   the editor to use `@tiptap/extension-collaboration`. Significant infra
   change — would warrant its own design doc.

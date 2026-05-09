# Scribbly

A small full-stack collaborative document editor: rich-text editing, file
import, and per-user sharing. Built with **SvelteKit + TypeScript**, **Drizzle
ORM** on **Neon Postgres**, and **TipTap** for the editor surface. Deployed on
**Vercel**.

The brief favors **depth in a few areas over shallow coverage**, so this
project leans into:

- A coherent editing experience with autosave and a clean, focused toolbar.
- A permission-aware sharing model with a clear owned-vs-shared distinction.
- A strict server-side sanitization boundary — every write goes through it.
- File import for `.txt`, `.md`, and `.docx` into a brand-new editable
  document.

> **Demo auth note.** This app uses **seeded demo users with no passwords** —
> intentional, to make sharing easy for reviewers to test. Anyone with the URL
> can pick any user. This is documented and is **not** production-grade auth.

---

## Live URL

**https://scribbly-ten.vercel.app**

Hosted on Vercel, backed by a Neon Postgres database.

## Demo accounts

Seeded automatically by `npm run db:seed`. No passwords.

| Name           | Email                   |
| -------------- | ----------------------- |
| Alice Nakamura | alice@scribbly.demo     |
| Bob Olawale    | bob@scribbly.demo       |
| Carol Reyes    | carol@scribbly.demo     |
| Dan Petrov     | dan@scribbly.demo       |

Switch users from the top-right dropdown at any time to demo sharing.

---

## Features

### Document editing
- Create, rename, edit, save, delete documents.
- TipTap-based rich text: **bold**, *italic*, <u>underline</u>, ~~strike~~,
  H1 / H2 / H3, bulleted and numbered lists, blockquote, undo/redo.
- Autosave with a debounced 800 ms write, plus `Ctrl/Cmd+S` to flush
  immediately. A `pagehide` beacon catches in-flight edits if you close the
  tab fast.
- Save-state indicator in the document header (`Unsaved` → `Saving…` → `Saved`).

### File upload
- Supported: **`.txt`**, **`.md`**, **`.docx`**.
- Hard cap: **4 MB** (Vercel serverless body limit is 4.5 MB).
- Each upload is parsed server-side (`marked` for Markdown, `mammoth` for
  docx, line-wrapped HTML for plain text), then put through a strict
  `sanitize-html` allowlist before being persisted as a new document.
- Unsupported file types are rejected with a clear UI error.

### Sharing
- Single permission tier (current scope): a shared user can view **and**
  edit. Only the owner can change shares or delete the document.
- Sidebar separates **My documents** from **Shared with me**, with a
  "Shared by …" label for shared docs.
- Share dialog lists current shares with one-click remove, and the remaining
  pool of seeded users you can add.

### Persistence
- Postgres (Neon) via Drizzle ORM.
- Documents store both **sanitized HTML** (for safe rendering and export)
  and the **TipTap JSON** doc (for lossless reload — preserves marks and
  list nesting without re-parsing HTML).
- Schema is in [`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts).

### Stretch implemented
- **Markdown export** — every document has a `⇩ MD` button in the header
  that downloads the current contents as `.md`.

---

## Local setup

### Prerequisites
- Node.js 20 or later (tested on 24).
- A Neon Postgres database (free tier is fine).
- npm (bundled with Node).

### Steps

```bash
# 1. Install deps
npm install

# 2. Copy env template, fill in DATABASE_URL and SESSION_SECRET
cp .env.example .env
# Generate a SESSION_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Apply the schema migrations
npm run db:migrate

# 4. Seed the four demo users
npm run db:seed

# 5. Start the dev server
npm run dev
# -> http://localhost:5173
```

### Environment variables

| Variable          | Purpose                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`    | Postgres connection string (Neon pooled URL recommended).             |
| `SESSION_SECRET`  | 32+ random bytes used to HMAC-sign the session cookie.                |

---

## Deployment (Vercel + Neon)

This app deploys cleanly on Vercel via `@sveltejs/adapter-vercel` (Node 20
runtime). Hybrid setup the project was built for:

1. **Create a Neon project** — copy the **pooled** connection string.
2. **Create a new Vercel project** importing this repo.
3. **Set environment variables** in the Vercel project:
   - `DATABASE_URL` = your Neon pooled connection string
   - `SESSION_SECRET` = `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. **Apply the schema** locally against the production database:
   ```bash
   DATABASE_URL="<your-neon-url>" npm run db:migrate
   DATABASE_URL="<your-neon-url>" npm run db:seed
   ```
5. **Deploy** — Vercel runs `npm run build`. The adapter emits
   `.vercel/output/`, which Vercel serves automatically.

> Neon free tier auto-suspends after ~5 minutes of idle. The first request
> after a cold start can take 1–3 seconds. This is documented and acceptable
> for the demo scope.

---

## Scripts

| Script                | What it does                                              |
| --------------------- | --------------------------------------------------------- |
| `npm run dev`         | Vite dev server with HMR.                                 |
| `npm run build`       | Production build (Vercel adapter output).                 |
| `npm run preview`     | Preview the production build locally.                     |
| `npm run check`       | `svelte-kit sync` + `svelte-check` (full typecheck).      |
| `npm test`            | Vitest run (35 tests across import / sanitize / perms).   |
| `npm run db:migrate`  | Apply versioned SQL migrations from `drizzle/`.           |
| `npm run db:seed`     | Insert the four demo users (idempotent).                  |
| `npm run db:generate` | Generate a new SQL migration from schema changes.         |
| `npm run db:push`     | (Drizzle's interactive push — prefer `db:migrate`.)       |
| `npm run fixtures:gen`| Rebuild `tests/fixtures/sample.docx` from XML.            |

---

## Architecture quick reference

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the long version. Short version:

```
Browser (TipTap editor + Svelte 5 UI)
   │  fetch + cookie session
   ▼
SvelteKit server (hooks.server.ts → permission checks → sanitize-html → DB)
   ▼
Neon Postgres  (users, documents, shares)
```

Key modules:
- [`src/hooks.server.ts`](src/hooks.server.ts) — reads the signed session
  cookie and attaches `locals.user` to every request.
- [`src/lib/server/sanitize.ts`](src/lib/server/sanitize.ts) — the security
  boundary. Every PUT and every import passes through it.
- [`src/lib/server/permissions.ts`](src/lib/server/permissions.ts) — pure
  permission resolution, exhaustively unit-tested.
- [`src/lib/server/import.ts`](src/lib/server/import.ts) — file parsing
  (txt / md / docx → sanitized HTML).

---

## Tests

```bash
npm test
```

Three Vitest suites covering distinct risks:

- [`tests/sanitize.test.ts`](tests/sanitize.test.ts) — XSS hardening: scripts,
  inline event handlers, `javascript:` URIs, `<iframe>`, `<img onerror>`, and
  `style=` are all stripped.
- [`tests/import.test.ts`](tests/import.test.ts) — file parsing for `.txt`,
  `.md`, `.docx`, plus rejection paths (unsupported ext, oversized payload,
  mismatched MIME).
- [`tests/permissions.test.ts`](tests/permissions.test.ts) — full
  owner/shared/stranger access matrix for read, edit, manage-shares, delete.

35 tests, run in ~16 s.

---

## Project layout

```
src/
  app.html / app.css / app.d.ts
  hooks.server.ts            # reads session cookie -> locals.user
  lib/
    components/              # Editor, Toolbar (inline), ShareDialog, UserSwitcher
    server/
      auth.ts                # HMAC-signed session cookie
      db/{schema,client,seed}.ts
      import.ts              # txt/md/docx -> sanitized HTML
      permissions.ts         # pure functions, fully tested
      sanitize.ts            # the write-time HTML allowlist
    uploads.ts               # client-safe constants (size cap, supported exts)
  routes/
    +layout.{svelte,server.ts}
    +page.{svelte,server.ts} # login (user picker)
    docs/+page.{svelte,server.ts}        # owned + shared list
    docs/[id]/+page.{svelte,server.ts}   # editor
    api/...                  # session, users, documents, shares, upload
tests/
  fixtures/{sample.txt, sample.md, sample.docx}
  {sanitize,import,permissions}.test.ts
scripts/
  build-docx-fixture.ts      # regenerates the .docx fixture from raw XML
```

---

## Known limitations

- **No real auth.** Any visitor can pick any seeded user. Documented loudly.
- **Single permission tier.** Shared = view + edit. Viewer/editor split is a
  natural extension (it's listed in the brief's stretch goals).
- **No screenshots in the repo.** I built this without a way to capture
  browser screenshots from the tooling available. After deploy, drop 2–3 PNGs
  into `docs/screenshots/` if you'd like them.

---

## Submission contents

See [`SUBMISSION.md`](SUBMISSION.md).

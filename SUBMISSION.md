# Submission

## What's included

### Source code
A SvelteKit + TypeScript app, Drizzle/Postgres, TipTap editor, deployed via
`@sveltejs/adapter-vercel`.

```
src/
  app.html, app.css, app.d.ts
  hooks.server.ts                          session middleware
  lib/
    components/Editor.svelte               TipTap editor + toolbar
    components/ShareDialog.svelte          owner-only share manager
    components/UserSwitcher.svelte         top-right identity dropdown
    server/auth.ts                         HMAC-signed session cookie
    server/db/schema.ts                    users, documents, shares
    server/db/client.ts                    Neon HTTP driver + Drizzle
    server/db/seed.ts                      4 demo users (idempotent)
    server/import.ts                       txt/md/docx -> sanitized HTML
    server/permissions.ts                  pure permission resolution
    server/sanitize.ts                     write-time HTML allowlist
    uploads.ts                             client-safe upload constants
  routes/
    +layout.svelte / +layout.server.ts     header, user switcher
    +page.svelte / +page.server.ts         user picker login
    docs/+page.svelte / +page.server.ts    owned + shared lists
    docs/[id]/+page.svelte / +page.server.ts editor page
    api/session/+server.ts                 POST/DELETE session
    api/users/+server.ts                   GET seeded users
    api/documents/+server.ts               GET list / POST create
    api/documents/[id]/+server.ts          GET / PUT / DELETE
    api/documents/[id]/shares/+server.ts   GET list / POST add
    api/documents/[id]/shares/[userId]/+server.ts  DELETE remove
    api/upload/+server.ts                  multipart -> new doc
scripts/
  build-docx-fixture.ts                    regenerates sample.docx
tests/
  fixtures/sample.{txt,md,docx}
  sanitize.test.ts                         8 tests (XSS hardening)
  import.test.ts                           13 tests (txt/md/docx parse + reject)
  permissions.test.ts                      14 tests (full access matrix)
```

### Documentation
- [`README.md`](README.md) — project overview, local setup, deploy steps,
  scripts reference, demo credentials, project layout.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — design rationale, data model,
  security boundary, save flow, what was prioritized and why, what was
  deliberately deferred, what would come next.
- [`AI_WORKFLOW.md`](AI_WORKFLOW.md) — candid log of how AI was used in
  this build, including the planning workflow, what AI did well unprompted,
  what required steering, and an itemized list of what broke during the
  build and how it was fixed.

### Tests
**35 automated tests** across three suites, all passing in ~16s:

```
✓ tests/permissions.test.ts  (14 tests)
✓ tests/sanitize.test.ts     ( 8 tests)
✓ tests/import.test.ts       (13 tests)
```

Run with `npm test`.

### Deployment

| Item                     | Status                                                          |
| ------------------------ | --------------------------------------------------------------- |
| Vercel adapter wired     | Yes (`@sveltejs/adapter-vercel`, Node 20 runtime)               |
| Neon Postgres support    | Yes (`@neondatabase/serverless` + `drizzle-orm/neon-http`)      |
| Schema push              | `npm run db:push`                                               |
| Seed script              | `npm run db:seed` (4 demo users, idempotent)                    |
| Build verified locally   | Yes (`npm run build` produces `.vercel/output/`)                |
| Live URL                 | **https://scribbly-ten.vercel.app**                              |

Deployment uses the **hybrid** model the project was scoped for: you (the
reviewer) provide a Neon `DATABASE_URL` and a Vercel project link; I push
the code and configure the env vars. See **Deployment** in
[`README.md`](README.md#deployment-vercel--neon).

## Capability checklist

| Capability                                              | Where                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Create a new document                                   | `POST /api/documents`, button in `/docs`                                                            |
| Rename a document                                       | Title input on `/docs/[id]`, autosaved                                                              |
| Edit document content                                   | TipTap editor in `Editor.svelte`                                                                    |
| Save and reopen documents                               | Debounced autosave, beacon flush on tab close                                                       |
| Bold / italic / underline                               | Toolbar (StarterKit + Underline extension)                                                          |
| Headings (H1/H2/H3)                                     | Toolbar                                                                                             |
| Bulleted / numbered lists                               | Toolbar                                                                                             |
| File upload (.txt/.md/.docx → new document)             | `POST /api/upload`, button in `/docs`                                                                |
| Document owner                                          | `documents.owner_id` FK; only the owner can share or delete                                          |
| Grant another user access                               | `POST /api/documents/[id]/shares` via `ShareDialog`                                                 |
| Owned vs shared distinction                             | `/docs` sidebar splits My documents / Shared with me; "Shared by" badge in editor                   |
| Documents persist across refresh                        | Postgres-backed; both HTML and TipTap JSON stored                                                   |
| Formatting preserved                                    | TipTap JSON round-trip; sanitized HTML allowlist matches editor's supported marks                   |
| Setup + run instructions                                | [`README.md`](README.md#local-setup)                                                                  |
| Working deployment path                                 | [`README.md`](README.md#deployment-vercel--neon) (hybrid: reviewer creates accounts, I push code) |
| Validation + error handling                             | Zod-style runtime checks in API routes; ImportError types; 4xx with messages                         |
| Meaningful automated test                               | 35 tests across 3 suites — see [`tests/`](tests/)                                                  |
| Architecture note                                       | [`ARCHITECTURE.md`](ARCHITECTURE.md)                                                                |
| AI workflow note                                        | [`AI_WORKFLOW.md`](AI_WORKFLOW.md)                                                                  |
| Submission manifest                                     | This file                                                                                            |

## Stretch implemented

- **Markdown export** — `⇩ MD` button in the editor header downloads the
  current document as `.md` (HTML → Markdown via a small in-browser
  serializer; no extra dependency).

Other stretch items (viewer/editor split, version history, real-time
collaboration) are explicitly deferred — see "What I would add next" in
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Things to know before reviewing

- **Demo auth, on purpose.** Any visitor can pick any seeded user. Switching
  users is one click in the top-right. This was the chosen scope for the
  brief — full auth would have come at the cost of editor depth.
- **Cold start on Neon free tier.** First request after ~5 minutes idle
  takes 1–3s. Subsequent requests are fast.
- **No browser screenshots in repo.** I built this without browser access
  for screen capture. The README walks through the flow textually.
- **Single permission tier.** Shared = view + edit. Two tiers
  (viewer / editor) are listed as the highest-priority next step in
  [`ARCHITECTURE.md`](ARCHITECTURE.md).

## How to verify

10-step end-to-end check on the live URL (also documented in the plan file):

1. Open the live URL → pick "Alice" → land on `/docs`.
2. Click **+ New document** → editor opens; type, apply bold/italic/underline/H1/bullet list. Watch the indicator: `Unsaved` → `Saving…` → `Saved`.
3. Refresh → content + formatting persist exactly.
4. Rename via the title input → autosaved.
5. Click **↑ Upload file** → upload `.docx` → new doc opens with parsed content.
6. Click **Share** → add Bob → close.
7. Top-right switcher → switch to Bob → sidebar shows the doc under **Shared with me** with "Shared by Alice" badge → open it → edit → save.
8. Switch back to Alice → see Bob's edits.
9. Switch to Carol → sidebar empty under shared → direct URL to the doc returns 403.
10. Locally: `npm test` → all 35 tests pass.

# AI Workflow Note

This is a candid log of how AI was used to build Scribbly. The intent is to
make the process legible — what AI did well, where I had to steer it, and
what I caught vs let through.

## The setup

The whole project was built inside **Claude Code** (the Anthropic CLI) running
the **Opus 4.7** model. I (the user) supplied the brief and the high-level
constraints; Claude planned, scaffolded, wrote, tested, and self-reviewed the
code under direction.

## How the work was split

Roughly:

- **Human (me, the user):** product brief, evaluation criteria, the four
  binary decisions that shaped the architecture (stack, deploy target, auth
  model, file-upload scope), and the deploy-execution split (I create the
  Vercel + Neon accounts, Claude pushes the code).
- **Claude Code:** the rest — initial plan, dependency choices, schema design,
  every line of source, the test suite, this document, and the README.

I asked Claude to flag blockers before doing anything irreversible, and it
caught two early ones: Node wasn't installed on the dev machine (it
self-installed via winget), and PowerShell's execution policy blocked
`npm.ps1` (it prompted me indirectly by setting `RemoteSigned` at user
scope). Both were narrated in the chat before the change happened.

## The plan-first workflow

I asked Claude to operate in **plan mode** before touching any code. That
forced an explicit shape:

1. Initial questions to me (4 concrete decisions, AskUserQuestion-style).
2. A second round of clarifying questions once the stack was picked
   (deploy execution, share permission tier).
3. A written plan file (`~/.claude/plans/...md`) covering data model, API
   surface, file pipeline, test strategy, deployment, risks, and a 10-step
   end-to-end verification.
4. Plan approval, then implementation.

The plan was the most valuable artifact in the whole flow. It surfaced
constraints that would have bitten me later — the Vercel 4.5 MB body limit,
Neon cold-start latency, the lack of a TipTap-Svelte first-class wrapper,
the docx fixture problem, the dual-package vite/vitest type hazard.

## What AI did well, unprompted

- **Pure-function permission layer.** Claude split permission resolution out
  of the route handlers into pure functions that take plain objects, so the
  permission matrix could be tested exhaustively without standing up a
  database. I didn't ask for this; it proposed it as part of the test plan
  and it landed cleanly.
- **Strict sanitization story.** Without prompting, it identified the write
  path as the security boundary, ensured every PUT/import goes through
  `sanitize-html`, and wrote adversarial XSS tests pinning the allowlist.
- **Storing both sanitized HTML and TipTap JSON.** Avoids HTML
  round-tripping into ProseMirror on every load. This was a thoughtful call
  and it justified the choice in the architecture doc.
- **Building the `.docx` fixture from raw XML.** Rather than committing a
  binary blob it didn't write, it shipped a `scripts/build-docx-fixture.ts`
  that ZIPs the minimum OOXML envelope. Repeatable, inspectable, ~50 lines.
- **Beacon flush on `pagehide`.** Quietly added `navigator.sendBeacon` so
  fast tab closes don't lose the last keystroke. Small detail, real value.
- **Hybrid PATH workaround.** When the tool's PowerShell sessions wouldn't
  inherit the new Node-on-PATH after winget install, it diagnosed the
  process-vs-user PATH split and prepended a registry-refresh in each
  command rather than asking me to relaunch a shell.

## What I had to steer

- **Tech-stack tilt.** Claude's first-call recommendation was Next.js. I
  picked SvelteKit + Postgres. It pivoted cleanly without re-arguing.
- **Sharing tier scope.** Claude proposed two tiers (viewer/editor) on its
  first take. I asked for single-tier with the role split deferred to
  stretch — it pruned without protest.

## Things that broke during build, and how they were fixed

These all happened inside the same session — useful as a record of how
brittle the AI-driven flow was in practice, and how iteration handled it.

| What broke                                              | Root cause                                                                                  | Fix                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm install` failed with peer-dep error                | Pinned `vite@5.4` but `@sveltejs/vite-plugin-svelte@5.1` requires Vite 6.                   | Bumped to `vite@^6.0.3`.                                                                  |
| `svelte-check`: `$env/dynamic/private` not found        | Root `tsconfig.json` overrode the `include` array from `.svelte-kit/tsconfig.json`, dropping the SvelteKit ambient types. | Removed the local `include` so the parent tsconfig's include flows through.               |
| `vitest` field on `defineConfig` from `vite` rejected   | `vite`'s `UserConfig` doesn't know about Vitest's `test` block.                             | Tried `vitest/config` — hit a `Plugin<any>` dual-package hazard. Split into a separate `vitest.config.ts` with its own `defineConfig`. |
| Build error: client importing `$lib/server/import.ts`   | The `MAX_UPLOAD_BYTES` and `SUPPORTED_EXTS` constants were imported by the docs list page. | Pulled the constants into `src/lib/uploads.ts` (no `server/` prefix) and re-exported them from the server-only module. |
| `titleFromFilename(' Quarterly Report.docx ')` test     | Trailing whitespace blocked the trailing-extension regex (`$` anchor).                       | Trim before regex, then trim again after.                                                  |

Each of these was found by the test or build run and fixed in a single
follow-up. None made it into git.

## Habits worth keeping

- **Plan first, code second.** The plan file is the single most useful AI
  artifact. It made every later decision faster.
- **Pure functions for anything testable.** Especially permissions and
  parsers. The AI was happy to write them this way once asked.
- **Run the build, not just `tsc`.** `npm run check` was clean before the
  first `npm run build`, and the build still caught the server-import-into-
  client mistake. Both gates matter.
- **Push back on scope.** When Claude proposed two-tier sharing on the
  first plan, the right move was to defer it to stretch — and that
  judgment had to come from me.

## Habits worth questioning

- **Trust-but-verify the AI's "this is the documented pattern" claims.**
  TipTap-in-Svelte 5 with onMount/onDestroy *is* the documented pattern, but
  I didn't independently verify that until svelte-check ran clean. For a
  longer-lived codebase I'd add a runtime smoke test for the editor as
  well.
- **Watch for over-build.** Claude wrote a Markdown export feature
  unprompted as a stretch. It's small (~50 lines), self-contained, and
  earned its place — but stretch features are exactly where AI-driven
  scope creep happens, and a longer engagement would need a stricter
  budget.
- **Remember that AI summaries describe intent, not result.** I (the user)
  read each diff before approving — relying only on the AI's "I added X
  and tested Y" line would have missed the docs-page server import that
  the build caught.

## Reproducibility

Anyone can re-run this flow:

1. Open Claude Code with this repo's brief.
2. Ask for plan mode first.
3. Approve the plan once you've reconciled the four binary decisions
   (stack, deploy, auth, upload scope) with your own judgment.
4. Let it scaffold, install, write code, write tests, and run the gates.
5. Verify gates locally — `npm run check`, `npm test`, `npm run build` —
   before pushing or deploying.

Total wall time on this build: roughly **45 minutes from empty workspace to
green tests + green build**. I (the human) actively engaged for ~10 minutes
of that, mostly in the planning round.

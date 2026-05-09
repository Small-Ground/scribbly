# Imported Markdown Document

This file is used by the file-import tests. It exercises the **markdown** to
HTML pipeline through `marked`, then *sanitization* via `sanitize-html`.

## Why a fixture?

- Verifies that headings parse to `h1`/`h2`/`h3`
- Verifies bullet lists round-trip
- Catches regressions if we ever change the allowlist

1. First numbered item
2. Second numbered item

> A blockquote should land as `<blockquote>` and survive sanitization.

End of fixture.

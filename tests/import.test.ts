import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  ImportError,
  extOf,
  importFile,
  isAllowedMime,
  titleFromFilename,
  txtToHtml
} from '../src/lib/server/import';

const FIX = (name: string) => resolve(__dirname, 'fixtures', name);

describe('extOf', () => {
  it('detects supported extensions case-insensitively', () => {
    expect(extOf('a.txt')).toBe('txt');
    expect(extOf('a.MD')).toBe('md');
    expect(extOf('Quarterly Report.docx')).toBe('docx');
  });

  it('returns null for unsupported types', () => {
    expect(extOf('image.png')).toBeNull();
    expect(extOf('archive.zip')).toBeNull();
    expect(extOf('no-extension')).toBeNull();
  });
});

describe('titleFromFilename', () => {
  it('strips the extension and trims whitespace', () => {
    expect(titleFromFilename('My Notes.md')).toBe('My Notes');
    expect(titleFromFilename('  Quarterly Report.docx  ')).toBe('Quarterly Report');
  });
  it('falls back to a placeholder for empty names', () => {
    expect(titleFromFilename('.txt')).toBe('Untitled document');
  });
});

describe('txtToHtml', () => {
  it('escapes HTML special chars', () => {
    const out = txtToHtml('<script>alert(1)</script>');
    expect(out).not.toMatch(/<script>/);
    expect(out).toContain('&lt;script&gt;');
  });

  it('wraps each line in a <p>, with <br> for blank lines', () => {
    const out = txtToHtml('one\n\ntwo');
    expect(out).toContain('<p>one</p>');
    expect(out).toContain('<p><br></p>');
    expect(out).toContain('<p>two</p>');
  });
});

describe('importFile (.txt)', () => {
  it('parses a plain text file and sanitizes the result', async () => {
    const buf = await readFile(FIX('sample.txt'));
    const out = await importFile({
      filename: 'sample.txt',
      mime: 'text/plain',
      buffer: buf
    });
    expect(out.title).toBe('sample');
    expect(out.contentHtml).toContain('<p>Plain text fixture</p>');
    // The "<unsafe>" string in the fixture must be escaped, not an actual tag.
    expect(out.contentHtml).not.toMatch(/<unsafe>/);
    expect(out.contentHtml).toContain('&lt;unsafe&gt;');
  });
});

describe('importFile (.md)', () => {
  it('parses markdown into the allowlist of HTML and preserves structure', async () => {
    const buf = await readFile(FIX('sample.md'));
    const out = await importFile({
      filename: 'sample.md',
      mime: 'text/markdown',
      buffer: buf
    });
    expect(out.title).toBe('sample');
    expect(out.contentHtml).toContain('<h1>Imported Markdown Document</h1>');
    expect(out.contentHtml).toContain('<h2>Why a fixture?</h2>');
    expect(out.contentHtml).toMatch(/<ul>[\s\S]*<li>/);
    expect(out.contentHtml).toMatch(/<ol>[\s\S]*<li>/);
    expect(out.contentHtml).toContain('<blockquote>');
    expect(out.contentHtml).toContain('<strong>markdown</strong>');
    expect(out.contentHtml).toContain('<em>sanitization</em>');
  });
});

describe('importFile (.docx)', () => {
  it('parses a docx via mammoth and yields sanitized HTML', async () => {
    const buf = await readFile(FIX('sample.docx'));
    const out = await importFile({
      filename: 'Quarterly Report.docx',
      mime:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: buf
    });
    expect(out.title).toBe('Quarterly Report');
    expect(out.contentHtml).toContain('Quarterly Report');
    expect(out.contentHtml).toMatch(/<strong>bold<\/strong>/);
    expect(out.contentHtml).toMatch(/<em>italic<\/em>/);
    expect(out.contentHtml).toContain('First bullet');
    expect(out.contentHtml).toContain('Second bullet');
  });
});

describe('importFile rejection paths', () => {
  it('rejects unsupported file types', async () => {
    await expect(
      importFile({ filename: 'pic.png', mime: 'image/png', buffer: Buffer.from('') })
    ).rejects.toMatchObject({ name: 'ImportError', code: 'UNSUPPORTED_EXT' });
  });

  it('rejects payloads exceeding the size limit', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024); // 5 MB > 4 MB cap
    await expect(
      importFile({ filename: 'big.txt', mime: 'text/plain', buffer: big })
    ).rejects.toMatchObject({ name: 'ImportError', code: 'TOO_LARGE' });
  });

  it('rejects mismatched MIME for known extension', () => {
    expect(isAllowedMime('docx', 'text/plain')).toBe(false);
    expect(isAllowedMime('md', 'image/png')).toBe(false);
    expect(isAllowedMime('md', 'text/markdown')).toBe(true);
  });

  it('exposes ImportError with .code for handlers', async () => {
    let caught: unknown;
    try {
      await importFile({ filename: 'x.bin', mime: '', buffer: Buffer.from('') });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ImportError);
  });
});

import { describe, expect, it } from 'vitest';
import { sanitizeContentHtml, sanitizeTitle } from '../src/lib/server/sanitize';

describe('sanitizeContentHtml', () => {
  it('strips <script> tags entirely', () => {
    const dirty = '<p>hi</p><script>alert("xss")</script>';
    const clean = sanitizeContentHtml(dirty);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/alert/i);
  });

  it('removes inline event handlers and javascript: URLs', () => {
    const dirty = `<p onclick="alert('x')">click</p><p><a href="javascript:alert(1)">go</a></p>`;
    const clean = sanitizeContentHtml(dirty);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/javascript:/i);
    // Anchor tag itself should be discarded since 'a' isn't on the allowlist.
    expect(clean).not.toMatch(/<a/i);
  });

  it('discards style attributes and disallowed tags like <iframe>', () => {
    const dirty =
      '<p style="color: red">styled</p><iframe src="https://evil.example.com"></iframe><img src="x" onerror="alert(1)">';
    const clean = sanitizeContentHtml(dirty);
    expect(clean).not.toMatch(/style=/i);
    expect(clean).not.toMatch(/<iframe/i);
    expect(clean).not.toMatch(/<img/i);
    expect(clean).not.toMatch(/onerror/i);
  });

  it('preserves the editor-supported allowlist (b, i, u, h1-h3, ul, ol, li, blockquote, p)', () => {
    const dirty =
      '<h1>Title</h1><h2>Sub</h2><h3>Sub2</h3>' +
      '<p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>strike</s></p>' +
      '<ul><li>one</li><li>two</li></ul>' +
      '<ol><li>first</li><li>second</li></ol>' +
      '<blockquote>quoted</blockquote>';
    const clean = sanitizeContentHtml(dirty);
    expect(clean).toContain('<h1>Title</h1>');
    expect(clean).toContain('<h2>Sub</h2>');
    expect(clean).toContain('<h3>Sub2</h3>');
    expect(clean).toContain('<strong>bold</strong>');
    expect(clean).toContain('<em>italic</em>');
    expect(clean).toContain('<u>underline</u>');
    expect(clean).toContain('<s>strike</s>');
    expect(clean).toContain('<ul>');
    expect(clean).toContain('<ol>');
    expect(clean).toContain('<li>one</li>');
    expect(clean).toContain('<blockquote>quoted</blockquote>');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeContentHtml('')).toBe('');
  });
});

describe('sanitizeTitle', () => {
  it('strips all HTML', () => {
    expect(sanitizeTitle('<b>Hello</b> <script>x()</script>world')).toBe('Hello world');
  });

  it('collapses whitespace', () => {
    expect(sanitizeTitle('  multiple\n\n   spaces\there  ')).toBe('multiple spaces here');
  });

  it('caps title length at 200 characters', () => {
    const long = 'a'.repeat(500);
    expect(sanitizeTitle(long).length).toBe(200);
  });
});

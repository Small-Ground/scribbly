<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import EditorComponent from '$lib/components/Editor.svelte';
  import ShareDialog from '$lib/components/ShareDialog.svelte';
  import type { PageData } from './$types';

  type Props = { data: PageData };
  let { data }: Props = $props();

  // These reflect what the user sees and is editing. They start from the
  // server-loaded document and diverge as the user types. We intentionally
  // don't track future `data` changes — a fresh load remounts this page.
  // svelte-ignore state_referenced_locally
  let title = $state(data.document.title);
  // svelte-ignore state_referenced_locally
  let contentHtml = $state(data.document.contentHtml);
  // svelte-ignore state_referenced_locally
  let contentJson = $state<unknown>(data.document.contentJson ?? null);

  type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  let saveState = $state<SaveState>('idle');
  let saveError = $state<string | null>(null);

  let titleTimer: ReturnType<typeof setTimeout> | null = null;
  let contentTimer: ReturnType<typeof setTimeout> | null = null;

  // Single in-flight guard. If a save is in flight and another change comes in,
  // we mark dirty again and re-fire after the current save completes.
  let inFlight = false;
  let pendingAfterFlight = false;

  async function flush() {
    if (inFlight) {
      pendingAfterFlight = true;
      return;
    }
    inFlight = true;
    saveState = 'saving';
    saveError = null;
    try {
      const res = await fetch(`/api/documents/${data.document.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, contentHtml, contentJson })
      });
      if (!res.ok) {
        saveError = await res.text();
        saveState = 'error';
        return;
      }
      saveState = 'saved';
      setTimeout(() => {
        if (saveState === 'saved') saveState = 'idle';
      }, 1500);
    } catch (e) {
      saveError = String(e);
      saveState = 'error';
    } finally {
      inFlight = false;
      if (pendingAfterFlight) {
        pendingAfterFlight = false;
        scheduleSave(0);
      }
    }
  }

  function scheduleSave(delay = 800) {
    if (!data.canEdit) return;
    saveState = 'dirty';
    if (contentTimer) clearTimeout(contentTimer);
    contentTimer = setTimeout(flush, delay);
  }

  function onEditorChange(html: string, json: unknown) {
    contentHtml = html;
    contentJson = json;
    scheduleSave(800);
  }

  function onTitleInput(e: Event) {
    const t = (e.target as HTMLInputElement).value;
    title = t;
    if (titleTimer) clearTimeout(titleTimer);
    titleTimer = setTimeout(() => scheduleSave(0), 600);
  }

  function onTitleBlur() {
    if (titleTimer) {
      clearTimeout(titleTimer);
      titleTimer = null;
      scheduleSave(0);
    }
  }

  // Keyboard save (Ctrl/Cmd+S) forces immediate flush.
  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (contentTimer) clearTimeout(contentTimer);
      flush();
    }
  }

  // Flush on page hide so a quick close doesn't lose the latest edits.
  $effect(() => {
    if (!browser) return;
    const handler = () => {
      if (saveState === 'dirty') {
        navigator.sendBeacon?.(
          `/api/documents/${data.document.id}`,
          new Blob(
            [JSON.stringify({ title, contentHtml, contentJson })],
            { type: 'application/json' }
          )
        );
      }
    };
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  });

  let showShare = $state(false);

  async function deleteDoc() {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/documents/${data.document.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    await goto('/docs');
  }

  function exportMarkdown() {
    // Lightweight HTML -> Markdown conversion for the export-as-MD stretch goal.
    // Keeps things dependency-free.
    const md = htmlToMarkdown(contentHtml);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function htmlToMarkdown(html: string): string {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    return nodesToMd(tpl.content.childNodes).trim() + '\n';
  }
  function nodesToMd(nodes: NodeListOf<ChildNode> | ChildNode[]): string {
    let out = '';
    nodes.forEach((n) => {
      out += nodeToMd(n);
    });
    return out;
  }
  function nodeToMd(n: ChildNode): string {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? '';
    if (!(n instanceof HTMLElement)) return '';
    const inner = nodesToMd(n.childNodes);
    switch (n.tagName) {
      case 'P':
        return inner.trim() + '\n\n';
      case 'BR':
        return '\n';
      case 'STRONG':
      case 'B':
        return `**${inner}**`;
      case 'EM':
      case 'I':
        return `*${inner}*`;
      case 'U':
        return `_${inner}_`;
      case 'S':
      case 'STRIKE':
        return `~~${inner}~~`;
      case 'H1':
        return `# ${inner.trim()}\n\n`;
      case 'H2':
        return `## ${inner.trim()}\n\n`;
      case 'H3':
        return `### ${inner.trim()}\n\n`;
      case 'UL':
        return [...n.children]
          .map((li) => `- ${nodesToMd(li.childNodes).trim()}`)
          .join('\n') + '\n\n';
      case 'OL':
        return [...n.children]
          .map((li, i) => `${i + 1}. ${nodesToMd(li.childNodes).trim()}`)
          .join('\n') + '\n\n';
      case 'BLOCKQUOTE':
        return inner.trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n';
      case 'CODE':
        return '`' + inner + '`';
      case 'PRE':
        return '```\n' + inner + '\n```\n\n';
      default:
        return inner;
    }
  }

  function statusLabel(s: SaveState): string {
    switch (s) {
      case 'idle':
        return 'All changes saved';
      case 'dirty':
        return 'Unsaved changes';
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return saveError ? `Save failed: ${saveError}` : 'Save failed';
    }
  }
</script>

<svelte:head>
  <title>{title || 'Untitled'} — Scribbly</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<div class="doc-page">
  <div class="doc-head">
    <input
      class="title-input"
      value={title}
      oninput={onTitleInput}
      onblur={onTitleBlur}
      placeholder="Untitled document"
      aria-label="Document title"
      readonly={!data.canEdit}
    />
    <div class="head-meta">
      {#if !data.isOwner && data.owner}
        <span class="owner-badge" title={`Owned by ${data.owner.name}`}>
          <span class="avatar small" style:background={data.owner.color}>
            {data.owner.name
              .split(/\s+/)
              .map((p) => p[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
          Shared by {data.owner.name}
        </span>
      {/if}
      <span class="status" data-state={saveState}>{statusLabel(saveState)}</span>
    </div>
    <div class="head-actions">
      <button class="btn ghost" onclick={exportMarkdown} title="Export as Markdown">⇩ MD</button>
      {#if data.isOwner}
        <button class="btn" onclick={() => (showShare = true)}>Share</button>
        <button class="btn ghost danger" onclick={deleteDoc} title="Delete document">Delete</button>
      {/if}
    </div>
  </div>

  <EditorComponent
    initialHtml={data.document.contentHtml || '<p></p>'}
    initialJson={data.document.contentJson}
    editable={data.canEdit}
    onChange={onEditorChange}
  />
</div>

{#if showShare && data.isOwner && data.user}
  <ShareDialog
    docId={data.document.id}
    ownerId={data.document.ownerId}
    currentUserId={data.user.id}
    allUsers={data.allUsers}
    onClose={() => (showShare = false)}
  />
{/if}

<style>
  .doc-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .doc-head {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 16px;
    padding: 14px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elevated);
    position: sticky;
    top: 0;
    z-index: 30;
  }
  .title-input {
    border: none;
    outline: none;
    background: transparent;
    font-size: 18px;
    font-weight: 600;
    padding: 4px 6px;
    border-radius: 6px;
  }
  .title-input:focus {
    background: #f1f5f9;
  }
  .head-meta {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }
  .owner-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
  }
  .avatar.small {
    width: 18px;
    height: 18px;
    font-size: 10px;
  }
  .status {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    transition: color 0.2s;
  }
  .status[data-state='saving'] {
    color: var(--warn);
  }
  .status[data-state='dirty'] {
    color: var(--warn);
  }
  .status[data-state='saved'] {
    color: var(--success);
  }
  .status[data-state='error'] {
    color: var(--danger);
  }
  .head-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>

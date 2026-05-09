<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  import { MAX_UPLOAD_BYTES, SUPPORTED_EXTS } from '$lib/uploads';

  type Props = { data: PageData };
  let { data }: Props = $props();

  let creating = $state(false);
  let uploading = $state(false);
  let uploadError = $state<string | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();

  async function newDoc() {
    creating = true;
    try {
      const res = await fetch('/api/documents', { method: 'POST' });
      if (!res.ok) {
        alert(`Could not create: ${await res.text()}`);
        return;
      }
      const { id } = await res.json();
      await goto(`/docs/${id}`);
    } finally {
      creating = false;
    }
  }

  async function handleUpload(e: Event) {
    uploadError = null;
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      uploadError = `File too large. Max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`;
      input.value = '';
      return;
    }
    uploading = true;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        uploadError = await res.text();
        return;
      }
      const { id } = await res.json();
      await goto(`/docs/${id}`);
    } catch (err) {
      uploadError = String(err);
    } finally {
      uploading = false;
      if (input) input.value = '';
    }
  }

  async function deleteDoc(id: string, title: string, e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert(`Delete failed: ${await res.text()}`);
      return;
    }
    await invalidateAll();
  }

  function relativeTime(iso: string | Date): string {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    const diff = Date.now() - d.getTime();
    const m = Math.round(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.round(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  function initials(name: string): string {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  const acceptList = SUPPORTED_EXTS.map((e) => `.${e}`).join(',');
</script>

<svelte:head>
  <title>Scribbly — My Documents</title>
</svelte:head>

<div class="docs-page">
  <div class="docs-header">
    <div>
      <h1>Documents</h1>
      <p class="muted">Welcome, {data.user?.name}.</p>
    </div>
    <div class="actions">
      <button class="btn primary" onclick={newDoc} disabled={creating}>
        {creating ? 'Creating...' : '+ New document'}
      </button>
      <label class="btn">
        <input
          bind:this={fileInput}
          type="file"
          accept={acceptList}
          onchange={handleUpload}
          disabled={uploading}
          hidden
        />
        {uploading ? 'Uploading...' : '↑ Upload file'}
      </label>
    </div>
  </div>

  <p class="hint muted">
    Supported uploads: <strong>{acceptList}</strong>. Max
    {(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)} MB.
  </p>

  {#if uploadError}
    <div class="error" role="alert">{uploadError}</div>
  {/if}

  <section>
    <h2>My documents <span class="count">({data.owned.length})</span></h2>
    {#if data.owned.length === 0}
      <p class="empty muted">No documents yet. Click "New document" to start writing.</p>
    {:else}
      <ul class="doc-list">
        {#each data.owned as d (d.id)}
          <li>
            <a href={`/docs/${d.id}`} class="doc-card">
              <span class="doc-title">{d.title}</span>
              <span class="doc-meta muted">Updated {relativeTime(d.updatedAt)}</span>
              <button
                class="btn ghost danger trash"
                aria-label={`Delete ${d.title}`}
                onclick={(e) => deleteDoc(d.id, d.title, e)}
              >
                ✕
              </button>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section>
    <h2>Shared with me <span class="count">({data.shared.length})</span></h2>
    {#if data.shared.length === 0}
      <p class="empty muted">Nothing shared with you yet.</p>
    {:else}
      <ul class="doc-list">
        {#each data.shared as d (d.id)}
          <li>
            <a href={`/docs/${d.id}`} class="doc-card">
              <span class="doc-title">{d.title}</span>
              <span class="doc-meta muted">
                Updated {relativeTime(d.updatedAt)}
                <span class="dot">·</span>
                <span class="avatar small" style:background={d.ownerColor}
                  >{initials(d.ownerName)}</span
                >
                Shared by {d.ownerName}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .docs-page {
    max-width: 920px;
    margin: 0 auto;
    padding: 28px 18px 64px;
  }
  .docs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }
  h1 {
    margin: 0;
    font-size: 24px;
  }
  h2 {
    margin: 28px 0 10px;
    font-size: 14px;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }
  .count {
    color: var(--text-muted);
    font-weight: 400;
    text-transform: none;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .hint {
    font-size: 12px;
    margin: 8px 0 0;
  }
  .error {
    margin: 12px 0;
    padding: 10px 14px;
    border: 1px solid #fca5a5;
    background: #fef2f2;
    color: #7f1d1d;
    border-radius: var(--radius);
  }
  .doc-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px;
  }
  .doc-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 14px 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    text-decoration: none;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  .doc-card:hover {
    border-color: var(--accent);
    box-shadow: var(--shadow-sm);
  }
  .doc-title {
    font-weight: 500;
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doc-meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .dot {
    margin: 0 2px;
  }
  .avatar.small {
    width: 16px;
    height: 16px;
    font-size: 9px;
  }
  .trash {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 2px 7px;
    font-size: 13px;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .doc-card:hover .trash {
    opacity: 1;
  }
  .empty {
    padding: 14px;
    border: 1px dashed var(--border);
    border-radius: var(--radius);
  }
</style>

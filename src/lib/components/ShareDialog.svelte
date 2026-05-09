<script lang="ts">
  type User = { id: string; name: string; email: string; color: string };
  type ShareEntry = { userId: string; name: string; email: string; color: string };

  type Props = {
    docId: string;
    ownerId: string;
    currentUserId: string;
    allUsers: User[];
    onClose: () => void;
  };
  let { docId, ownerId, currentUserId, allUsers, onClose }: Props = $props();

  let shares = $state<ShareEntry[]>([]);
  let loading = $state(true);
  let busyUserId = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`/api/documents/${docId}/shares`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      shares = data.shares;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  async function add(userId: string) {
    busyUserId = userId;
    error = null;
    try {
      const res = await fetch(`/api/documents/${docId}/shares`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      error = String(e);
    } finally {
      busyUserId = null;
    }
  }

  async function remove(userId: string) {
    busyUserId = userId;
    error = null;
    try {
      const res = await fetch(`/api/documents/${docId}/shares/${userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      error = String(e);
    } finally {
      busyUserId = null;
    }
  }

  function initials(name: string): string {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  // Pool of users available to add: everyone except owner and already-shared.
  let available = $derived.by(() => {
    const sharedSet = new Set(shares.map((s) => s.userId));
    return allUsers.filter((u) => u.id !== ownerId && !sharedSet.has(u.id));
  });

  $effect(() => {
    void docId;
    load();
  });

  function backdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-labelledby="share-title"
  onclick={backdropClick}
  onkeydown={(e) => e.key === 'Escape' && onClose()}
  tabindex="-1"
>
  <div class="dialog">
    <div class="dlg-head">
      <h2 id="share-title">Share document</h2>
      <button class="btn ghost" onclick={onClose} aria-label="Close">✕</button>
    </div>
    <p class="muted">
      Anyone you share with can view and edit. Only you (the owner) can change sharing.
    </p>

    {#if error}
      <div class="error" role="alert">{error}</div>
    {/if}

    <div class="section-label">People with access ({shares.length + 1})</div>
    <ul class="people">
      <li class="person">
        <span class="avatar" style:background={'#4f46e5'}>{initials('You')}</span>
        <span class="who">
          <span class="name">You</span>
          <span class="email muted">Owner</span>
        </span>
      </li>
      {#if loading}
        <li class="person muted">Loading...</li>
      {:else}
        {#each shares as s (s.userId)}
          <li class="person">
            <span class="avatar" style:background={s.color}>{initials(s.name)}</span>
            <span class="who">
              <span class="name">{s.name}</span>
              <span class="email muted">{s.email}</span>
            </span>
            <button
              class="btn ghost danger"
              onclick={() => remove(s.userId)}
              disabled={busyUserId === s.userId}
            >
              {busyUserId === s.userId ? '...' : 'Remove'}
            </button>
          </li>
        {/each}
      {/if}
    </ul>

    <div class="section-label">Add people</div>
    {#if available.length === 0}
      <p class="empty muted">Everyone has access already.</p>
    {:else}
      <ul class="people">
        {#each available as u (u.id)}
          <li class="person">
            <span class="avatar" style:background={u.color}>{initials(u.name)}</span>
            <span class="who">
              <span class="name">{u.name}</span>
              <span class="email muted">{u.email}</span>
            </span>
            <button
              class="btn primary"
              onclick={() => add(u.id)}
              disabled={busyUserId === u.id}
            >
              {busyUserId === u.id ? '...' : 'Add'}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="dlg-foot">
      <button class="btn" onclick={onClose}>Done</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(15 23 42 / 0.42);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .dialog {
    width: 100%;
    max-width: 480px;
    max-height: 84vh;
    overflow: auto;
    background: var(--bg-elevated);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 22px;
  }
  .dlg-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  .section-label {
    margin: 18px 0 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .people {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .person {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px;
    border-radius: var(--radius);
  }
  .person:hover {
    background: #f8fafc;
  }
  .who {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-weight: 500;
  }
  .email {
    font-size: 12px;
  }
  .empty {
    padding: 8px;
    font-size: 13px;
  }
  .dlg-foot {
    display: flex;
    justify-content: flex-end;
    margin-top: 18px;
  }
  .error {
    margin: 8px 0;
    padding: 8px 10px;
    border: 1px solid #fca5a5;
    background: #fef2f2;
    color: #7f1d1d;
    border-radius: var(--radius);
    font-size: 13px;
  }
</style>

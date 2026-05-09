<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  type User = { id: string; name: string; email: string; color: string };

  type Props = {
    users: User[];
    current: User | null;
  };
  let { users, current }: Props = $props();

  let open = $state(false);
  let busy = $state(false);

  async function pick(id: string) {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: id })
      });
      if (!res.ok) {
        const text = await res.text();
        alert(`Login failed: ${text}`);
        return;
      }
      open = false;
      await invalidateAll();
      // A reload guarantees server-rendered routes pick up the new identity.
      location.reload();
    } finally {
      busy = false;
    }
  }

  async function signOut() {
    busy = true;
    try {
      await fetch('/api/session', { method: 'DELETE' });
      location.assign('/');
    } finally {
      busy = false;
    }
  }

  function toggle() {
    open = !open;
  }

  function close(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;
    if (!e.target.closest('.user-switcher')) open = false;
  }
  $effect(() => {
    if (open) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  });

  function initials(name: string): string {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
</script>

<div class="user-switcher">
  {#if current}
    <button class="trigger" onclick={toggle} aria-haspopup="listbox" aria-expanded={open}>
      <span class="avatar" style:background={current.color}>{initials(current.name)}</span>
      <span class="name">{current.name}</span>
      <span class="caret">▾</span>
    </button>
  {:else}
    <span class="muted">Not signed in</span>
  {/if}

  {#if open}
    <div class="menu" role="listbox">
      <div class="menu-label">Switch user</div>
      {#each users as u (u.id)}
        <button
          class="menu-item"
          class:current={current?.id === u.id}
          onclick={() => pick(u.id)}
          disabled={busy}
        >
          <span class="avatar" style:background={u.color}>{initials(u.name)}</span>
          <span class="who">
            <span class="who-name">{u.name}</span>
            <span class="who-email">{u.email}</span>
          </span>
          {#if current?.id === u.id}<span class="check">✓</span>{/if}
        </button>
      {/each}
      <div class="menu-sep"></div>
      <button class="menu-item danger" onclick={signOut} disabled={busy}>Sign out</button>
    </div>
  {/if}
</div>

<style>
  .user-switcher {
    position: relative;
  }
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px 5px 5px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg-elevated);
  }
  .trigger:hover {
    background: #f1f5f9;
  }
  .name {
    font-weight: 500;
  }
  .caret {
    font-size: 11px;
    color: var(--text-muted);
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    min-width: 280px;
    padding: 6px;
    z-index: 50;
  }
  .menu-label {
    padding: 6px 10px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: none;
    background: transparent;
    border-radius: 6px;
    text-align: left;
  }
  .menu-item:hover {
    background: #f1f5f9;
  }
  .menu-item.current {
    background: var(--accent-soft);
  }
  .menu-item.danger {
    color: var(--danger);
  }
  .who {
    flex: 1;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
  }
  .who-name {
    font-weight: 500;
  }
  .who-email {
    font-size: 12px;
    color: var(--text-muted);
  }
  .check {
    color: var(--accent);
  }
  .menu-sep {
    height: 1px;
    background: var(--border);
    margin: 6px 0;
  }
</style>

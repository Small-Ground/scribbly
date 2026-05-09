<script lang="ts">
  import type { PageData } from './$types';

  type Props = { data: PageData };
  let { data }: Props = $props();
  // data is loaded via parent +layout.server.ts; we read allUsers off page store
  import { page } from '$app/stores';
  let busy = $state<string | null>(null);

  async function pick(id: string) {
    busy = id;
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: id })
      });
      if (!res.ok) {
        alert(await res.text());
        busy = null;
        return;
      }
      location.assign('/docs');
    } catch (e) {
      busy = null;
      alert(`Login failed: ${e}`);
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
</script>

<svelte:head>
  <title>Scribbly — Sign in</title>
</svelte:head>

<div class="login-wrap">
  <div class="card">
    <h1>Scribbly</h1>
    <p class="muted">A small collaborative document app — pick a demo user to get started.</p>
    {#if $page.data.allUsers?.length}
      <ul class="users">
        {#each $page.data.allUsers as u (u.id)}
          <li>
            <button class="user-row" onclick={() => pick(u.id)} disabled={busy === u.id}>
              <span class="avatar" style:background={u.color}>{initials(u.name)}</span>
              <span class="who">
                <span class="who-name">{u.name}</span>
                <span class="who-email">{u.email}</span>
              </span>
              <span class="cta">{busy === u.id ? '...' : 'Continue'}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="empty">
        <strong>No demo users found.</strong>
        <p class="muted">
          Run <code>npm run db:push &amp;&amp; npm run db:seed</code> to populate the database.
        </p>
      </div>
    {/if}
    <p class="footnote muted">
      Demo accounts: no passwords, anyone with the URL can pick any user. See README for details.
    </p>
  </div>
</div>

<style>
  .login-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
  }
  .card {
    width: 100%;
    max-width: 460px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 28px;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 24px;
  }
  .users {
    list-style: none;
    margin: 18px 0 12px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .user-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    text-align: left;
  }
  .user-row:hover {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .who {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .who-name {
    font-weight: 500;
  }
  .who-email {
    font-size: 12px;
    color: var(--text-muted);
  }
  .cta {
    font-size: 13px;
    color: var(--accent);
    font-weight: 500;
  }
  .footnote {
    margin-top: 18px;
    font-size: 12px;
  }
  .empty {
    padding: 16px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
    background: #fff7ed;
    color: #7c2d12;
  }
  .empty code {
    background: #fed7aa;
    padding: 1px 5px;
    border-radius: 4px;
  }
</style>

<script lang="ts">
  import '../app.css';
  import UserSwitcher from '$lib/components/UserSwitcher.svelte';
  import type { LayoutData } from './$types';
  import { page } from '$app/stores';

  type Props = { data: LayoutData; children: import('svelte').Snippet };
  let { data, children }: Props = $props();
</script>

<div class="app-shell">
  <header class="topbar">
    <a href={data.user ? '/docs' : '/'} class="brand" aria-label="Scribbly home">
      <span class="brand-mark">S</span>
      <span class="brand-name">Scribbly</span>
    </a>
    <div class="spacer"></div>
    <UserSwitcher users={data.allUsers} current={data.user} />
  </header>

  <main>
    {@render children()}
  </main>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elevated);
    height: 56px;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    color: var(--text);
    text-decoration: none;
  }
  .brand-mark {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: var(--accent);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  .brand-name {
    font-size: 16px;
  }
  .spacer {
    flex: 1;
  }
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>

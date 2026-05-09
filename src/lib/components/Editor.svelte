<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';

  type Props = {
    initialHtml?: string;
    initialJson?: unknown;
    editable?: boolean;
    onChange?: (html: string, json: unknown) => void;
  };
  let { initialHtml = '<p></p>', initialJson, editable = true, onChange }: Props = $props();

  let host: HTMLDivElement | undefined = $state();
  let editor: Editor | undefined = $state();
  // Bumped on every transaction so toolbar active-state recomputes.
  let tick = $state(0);

  onMount(() => {
    if (!host) return;
    editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          codeBlock: false
        }),
        Underline
      ],
      content: initialJson ?? initialHtml,
      editable,
      editorProps: {
        attributes: {
          class: 'prose-area',
          spellcheck: 'true'
        }
      },
      onUpdate: ({ editor }) => {
        onChange?.(editor.getHTML(), editor.getJSON());
      },
      onTransaction: () => {
        tick++;
      }
    });
  });

  onDestroy(() => {
    editor?.destroy();
  });

  // Public-ish helper used by the toolbar buttons. Reading `tick` keeps these reactive.
  function isActive(name: string, attrs?: Record<string, unknown>) {
    void tick;
    return editor?.isActive(name, attrs) ?? false;
  }
  function can(fn: (chain: ReturnType<NonNullable<typeof editor>['can']>) => boolean) {
    void tick;
    if (!editor) return false;
    try {
      return fn(editor.can());
    } catch {
      return false;
    }
  }

  function exec(fn: (e: Editor) => unknown) {
    if (!editor) return;
    fn(editor);
    editor.commands.focus();
  }
</script>

{#if editor}
  <div class="toolbar" role="toolbar" aria-label="Formatting">
    <button
      type="button"
      class="tb-btn"
      class:active={isActive('bold')}
      onclick={() => exec((e) => e.chain().focus().toggleBold().run())}
      aria-pressed={isActive('bold')}
      title="Bold (Ctrl+B)"
    >
      <strong>B</strong>
    </button>
    <button
      type="button"
      class="tb-btn"
      class:active={isActive('italic')}
      onclick={() => exec((e) => e.chain().focus().toggleItalic().run())}
      aria-pressed={isActive('italic')}
      title="Italic (Ctrl+I)"
    >
      <em>I</em>
    </button>
    <button
      type="button"
      class="tb-btn"
      class:active={isActive('underline')}
      onclick={() => exec((e) => e.chain().focus().toggleUnderline().run())}
      aria-pressed={isActive('underline')}
      title="Underline (Ctrl+U)"
    >
      <span style="text-decoration: underline">U</span>
    </button>
    <span class="tb-sep" aria-hidden="true"></span>
    <button
      type="button"
      class="tb-btn"
      class:active={isActive('heading', { level: 1 })}
      onclick={() => exec((e) => e.chain().focus().toggleHeading({ level: 1 }).run())}
      aria-pressed={isActive('heading', { level: 1 })}
      title="Heading 1"
    >
      H1
    </button>
    <button
      type="button"
      class="tb-btn"
      class:active={isActive('heading', { level: 2 })}
      onclick={() => exec((e) => e.chain().focus().toggleHeading({ level: 2 }).run())}
      aria-pressed={isActive('heading', { level: 2 })}
      title="Heading 2"
    >
      H2
    </button>
    <button
      type="button"
      class="tb-btn"
      class:active={isActive('heading', { level: 3 })}
      onclick={() => exec((e) => e.chain().focus().toggleHeading({ level: 3 }).run())}
      aria-pressed={isActive('heading', { level: 3 })}
      title="Heading 3"
    >
      H3
    </button>
    <span class="tb-sep" aria-hidden="true"></span>
    <button
      type="button"
      class="tb-btn"
      class:active={isActive('bulletList')}
      onclick={() => exec((e) => e.chain().focus().toggleBulletList().run())}
      aria-pressed={isActive('bulletList')}
      title="Bulleted list"
    >
      • List
    </button>
    <button
      type="button"
      class="tb-btn"
      class:active={isActive('orderedList')}
      onclick={() => exec((e) => e.chain().focus().toggleOrderedList().run())}
      aria-pressed={isActive('orderedList')}
      title="Numbered list"
    >
      1. List
    </button>
    <span class="tb-sep" aria-hidden="true"></span>
    <button
      type="button"
      class="tb-btn"
      class:active={isActive('blockquote')}
      onclick={() => exec((e) => e.chain().focus().toggleBlockquote().run())}
      aria-pressed={isActive('blockquote')}
      title="Blockquote"
    >
      ❝
    </button>
    <span class="tb-spacer"></span>
    <button
      type="button"
      class="tb-btn"
      onclick={() => exec((e) => e.chain().focus().undo().run())}
      disabled={!can((c) => c.undo())}
      title="Undo (Ctrl+Z)"
    >
      ↶
    </button>
    <button
      type="button"
      class="tb-btn"
      onclick={() => exec((e) => e.chain().focus().redo().run())}
      disabled={!can((c) => c.redo())}
      title="Redo (Ctrl+Shift+Z)"
    >
      ↷
    </button>
  </div>
{/if}

<div class="editor-host" bind:this={host}></div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-wrap: wrap;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elevated);
    position: sticky;
    top: 56px;
    z-index: 20;
  }
  .tb-btn {
    min-width: 32px;
    height: 30px;
    padding: 0 8px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text);
    font-size: 13px;
  }
  .tb-btn:hover:not(:disabled) {
    background: #f1f5f9;
  }
  .tb-btn.active {
    background: var(--accent-soft);
    color: var(--accent);
    border-color: #c7d2fe;
  }
  .tb-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .tb-sep {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 4px;
  }
  .tb-spacer {
    flex: 1;
  }
  .editor-host {
    flex: 1;
    overflow: auto;
    padding: 36px 24px 80px;
  }
  .editor-host :global(.prose-area) {
    max-width: 760px;
    margin: 0 auto;
    min-height: calc(100vh - 220px);
    outline: none;
    font-family: var(--font-serif);
    font-size: 17px;
    line-height: 1.65;
    color: var(--text);
  }
  .editor-host :global(.prose-area p) {
    margin: 0 0 0.9em;
  }
  .editor-host :global(.prose-area h1) {
    font-size: 1.9em;
    margin: 1em 0 0.4em;
    font-weight: 700;
  }
  .editor-host :global(.prose-area h2) {
    font-size: 1.5em;
    margin: 1em 0 0.4em;
    font-weight: 700;
  }
  .editor-host :global(.prose-area h3) {
    font-size: 1.2em;
    margin: 1em 0 0.4em;
    font-weight: 700;
  }
  .editor-host :global(.prose-area ul),
  .editor-host :global(.prose-area ol) {
    padding-left: 1.5em;
    margin: 0 0 0.9em;
  }
  .editor-host :global(.prose-area blockquote) {
    margin: 0 0 0.9em;
    padding-left: 1em;
    border-left: 3px solid var(--accent-soft);
    color: var(--text-muted);
    font-style: italic;
  }
  .editor-host :global(.prose-area:focus) {
    outline: none;
  }
</style>

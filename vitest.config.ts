import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Vitest config kept separate from vite.config.ts so the SvelteKit + Vite
// pipeline doesn't share a Plugin<any> type with Vitest's bundled Vite,
// which previously triggered a dual-package-hazard type error.
export default defineConfig({
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false
  }
});

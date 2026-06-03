import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // @duckdb/node-api is a native addon: keep it external to the SSR bundle
  ssr: { external: ['@duckdb/node-api'] }
});

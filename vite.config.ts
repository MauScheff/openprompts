import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, UserConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  // Serve the dev server on port 5001 to match Tauri's devUrl
  server: {
    port: 5001,
  },
} as UserConfig);

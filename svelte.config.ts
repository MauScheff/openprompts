import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import type { Config } from 'vite';

const config: Config = {
  preprocess: vitePreprocess(),
};

export default config;
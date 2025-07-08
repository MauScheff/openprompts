// This file provides TypeScript declarations for Svelte components
declare module '*.svelte' {
  import { SvelteComponentTyped } from 'svelte';
  /**
   * Generic Svelte component typed with props, events, and slots.
   */
  export default class SvelteComponent<
    Props extends Record<string, any> = Record<string, any>,
    Events extends Record<string, any> = Record<string, any>,
    Slots extends Record<string, any> = Record<string, any>
  > extends SvelteComponentTyped<Props, Events, Slots> {}
}
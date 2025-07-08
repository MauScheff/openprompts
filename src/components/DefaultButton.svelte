<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  interface Props {
    disabled?: boolean;
    type?: string;
    children?: import('svelte').Snippet;
  }

  let { disabled = false, type = 'button', children }: Props = $props();
  const dispatch = createEventDispatcher();
  function handleClick(event: MouseEvent) {
    dispatch('click', event);
  }
</script>

<button type={type} disabled={disabled} class="default-button" on:click={handleClick}>
  {@render children?.()}
</button>

<style>
.default-button {
  width: 100%;
  margin-bottom: 14px;
  padding: 8px 10px;
  border: 1px solid var(--text-secondary);
  border-radius: var(--border-radius);
  font-size: 0.95em;
  font-family: inherit;
  background: var(--surface);
  box-sizing: border-box;
  cursor: pointer;
  transition: border-color var(--transition-duration) ease, background-color var(--transition-duration) ease;
}
.default-button:focus {
  outline: none;
  border-color: var(--primary);
}
.default-button:hover:not(:disabled) {
  background-color: var(--primary);
  border-color: var(--primary-dark);
  color: #fff;
}
.default-button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
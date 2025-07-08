<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
    monospace?: boolean;
    readonly?: boolean;
  }

  let {
    value = $bindable(""),
    placeholder = "",
    disabled = false,
    rows = 3,
    monospace = false,
    readonly = false,
  }: Props = $props();
</script>

<textarea
  bind:value
  {placeholder}
  {disabled}
  {rows}
  class="text-area"
  class:mono={monospace}
  on:input
></textarea>

<style>
  .text-area {
    width: 100%;
    margin-bottom: 14px;
    padding: 8px 10px;
    border: 1px solid var(--text-secondary);
    border-radius: var(--border-radius);
    font-size: 0.95em;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color var(--transition-duration) ease;
    resize: vertical;
  }
  .text-area:focus {
    outline: none;
    border-color: var(--primary);
  }
  .text-area.mono {
    background: #1e1e1e;
    color: #f8f8f2;
    font-family: Consolas, "Liberation Mono", Menlo, Courier, monospace;
    font-size: 0.9em;
    line-height: 1.4;
    white-space: pre-wrap;
    overflow: auto;
  }
</style>

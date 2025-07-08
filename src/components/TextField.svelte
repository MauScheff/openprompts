<script lang="ts">
  
  interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    // Reference to the underlying input element
    el?: HTMLInputElement | null;
  }

  let {
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    el = $bindable(null)
  }: Props = $props();
</script>

<input
  bind:this={el}
  type="text"
  bind:value
  placeholder={placeholder}
  disabled={disabled}
  class="text-field"
/>

<style>
.text-field {
  width: 100%;
  margin-bottom: 14px;
  padding: 8px 10px;
  border: 1px solid var(--text-secondary);
  border-radius: var(--border-radius);
  font-size: 0.95em;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color var(--transition-duration) ease;
}
.text-field:focus {
  outline: none;
  border-color: var(--primary);
}
</style>
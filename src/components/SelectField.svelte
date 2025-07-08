<script lang="ts">
  interface Props {
    value: string;
    options?: Array<{ value: string; label: string }>;
    disabled?: boolean;
  }

  let { value = $bindable(), options = [], disabled = false }: Props = $props();
</script>

<select bind:value {disabled} class="select-field">
  {#each options as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>

<style>
.select-field {
  width: 100%;
  margin-bottom: 14px;
  padding: 8px 10px;
  border: 1px solid var(--text-secondary);
  border-radius: var(--border-radius);
  font-size: 0.95em;
  font-family: inherit;
  background: var(--surface);
  box-sizing: border-box;
  transition: border-color var(--transition-duration) ease;
}
.select-field:focus {
  outline: none;
  border-color: var(--primary);
}
</style>
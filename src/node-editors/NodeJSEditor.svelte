<script lang="ts">
  import TextField from "../components/TextField.svelte";
  import TextAreaField from "../components/TextAreaField.svelte";

  interface Props {
    node: any;
    isRunning: boolean;
  }

  let { node = $bindable(), isRunning }: Props = $props();
  // initialize default fields to avoid undefined binding in TextField/TextAreaField
  // svelte-ignore ownership_invalid_mutation
  if (node.name === undefined) node.name = '';
  // svelte-ignore ownership_invalid_mutation
  if (node.code === undefined) node.code = '';
  // svelte-ignore ownership_invalid_mutation
  if (node.outputText === undefined) node.outputText = '';
  async function copyOutput(): Promise<void> {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(node.outputText || '');
  }
</script>
<div>
  <h3>NodeJS</h3>
  <label>Name:</label>
  <TextField bind:value={node.name} disabled={isRunning} />
  <label>Code:</label>
  <TextAreaField rows={10} bind:value={node.code} disabled={isRunning} monospace />
  <label>Output:</label>
  <button class="copy-button" onclick={copyOutput}>Copy</button>
  <TextAreaField rows={20} bind:value={node.outputText} readonly monospace />
</div>
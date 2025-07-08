<script lang="ts">
  import TextField from "../components/TextField.svelte";

  interface Props {
    node: any;
    isRunning: boolean;
  }

  let { node = $bindable(), isRunning }: Props = $props();
</script>
<div>
  <h3>New Node</h3>
  <label>Name:</label>
  <TextField bind:value={node.name} disabled={isRunning} />
  <p>Select a type to configure this node.</p>
</div>
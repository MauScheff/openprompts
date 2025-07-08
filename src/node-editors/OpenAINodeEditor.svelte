<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import DefaultButton from "../components/DefaultButton.svelte";
  import SelectField from "../components/SelectField.svelte";
  import TextAreaField from "../components/TextAreaField.svelte";
  import TextField from "../components/TextField.svelte";

  interface Props {
    node: any;
    isRunning: boolean;
  }

  let { node = $bindable(), isRunning }: Props = $props();
  const dispatch = createEventDispatcher<{ scenechange: void }>();
  // initialize default fields to avoid undefined binding
  // svelte-ignore ownership_invalid_mutation
  if (node.name === undefined) node.name = '';
  // svelte-ignore ownership_invalid_mutation
  if (node.apiKey === undefined) node.apiKey = '';
  // svelte-ignore ownership_invalid_mutation
  if (node.model === undefined) node.model = '';
  // svelte-ignore ownership_invalid_mutation
  if (node.outputText === undefined) node.outputText = '';
  // svelte-ignore ownership_invalid_mutation
  if (!node.messages) node.messages = [];
  function addMessage(): void {
    node.messages.push({ id: `msg_${Date.now()}`, role: "user", content: "" });
    dispatch("scenechange");
  }
  function removeMessage(index: number): void {
    node.messages.splice(index, 1);
    dispatch("scenechange");
  }
  async function copyOutput(): Promise<void> {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(node.outputText || "");
  }
</script>

<div>
  <h3>OpenAI API</h3>
  <label>Name:</label>
  <TextField bind:value={node.name} disabled={isRunning} />
  <label>API Key:</label>
  <TextField bind:value={node.apiKey} disabled={isRunning} placeholder="sk-..." />
  <label>Model:</label>
  <TextField bind:value={node.model} disabled={isRunning} placeholder="e.g. gpt-4.1-mini" />
  <h4>Messages</h4>
  {#each node.messages as msg, idx}
    <div class="message-row">
      <div class="message-header">
        <SelectField
          bind:value={msg.role}
          options={[
            { value: 'system', label: 'system' },
            { value: 'user', label: 'user' },
            { value: 'assistant', label: 'assistant' }
          ]}
          disabled={isRunning}
        />
        <DefaultButton type="button" disabled={isRunning} on:click={() => removeMessage(idx)}>Remove</DefaultButton>
      </div>
      <TextAreaField rows={3} bind:value={msg.content} disabled={isRunning} />
    </div>
  {/each}
  <DefaultButton on:click={addMessage} disabled={isRunning}>Add Message</DefaultButton>
  <label>Output:</label>
  <button class="copy-button" onclick={copyOutput}>Copy</button>
  <TextAreaField rows={20} bind:value={node.outputText} readonly monospace />
</div>

<script lang="ts">
  import type { CircleNode, SceneShape } from "../../lib/scene";
  import BashNodeEditor from "../../node-editors/BashNodeEditor.svelte";
  import NewNodeEditor from "../../node-editors/NewNodeEditor.svelte";
  import NodeJSEditor from "../../node-editors/NodeJSEditor.svelte";
  import OpenAINodeEditor from "../../node-editors/OpenAINodeEditor.svelte";
  import SelectField from "../SelectField.svelte";
  import TextAreaField from "../TextAreaField.svelte";
  import TextField from "../TextField.svelte";

  let {
    inspectorNode = $bindable(null),
    isRunning = false,
    scene = $bindable([]),
    sceneName = $bindable(""),
    sceneDescription = $bindable(""),
    sceneInstructions = $bindable(""),
    sceneRequirements = $bindable(""),
    sceneCompatibility = $bindable(""),
    sceneNameInputEl = $bindable(null),
    editingScene = $bindable(false),
    typeOptions = [],
    availableVariables = [],
    handleVarHover = () => {},
    handleVarClick = () => {},
    copyOutput = () => {},
  } :
  {
    inspectorNode?: CircleNode | null;
    isRunning?: boolean;
    scene?: SceneShape[];
    sceneName?: string;
    sceneDescription?: string;
    sceneInstructions?: string;
    sceneRequirements?: string;
    sceneCompatibility?: string;
    sceneNameInputEl?: HTMLInputElement | null;
    editingScene?: boolean;
    typeOptions?: Array<{ value: string; label: string }>;
    availableVariables?: string[];
    handleVarHover?: (name: string, active: boolean) => void;
    handleVarClick?: (name: string) => void;
    copyOutput?: () => void;
  } = $props();


  const nodeAdapters = {
    newNode: { component: NewNodeEditor, label: "New Node" },
    bash: { component: BashNodeEditor, label: "Bash Shell" },
    OpenAI: { component: OpenAINodeEditor, label: "OpenAI API" },
    nodeJS: { component: NodeJSEditor, label: "NodeJS" },
  };


  // Panel resize state
  let panelWidth = $state(350);
  let isResizing = false;
  let panelResizeStartX = 0;
  let panelResizeStartWidth = 0;
  function handlePanelResizeMouseDown(e: MouseEvent) {
    isResizing = true;
    panelResizeStartX = e.clientX;
    panelResizeStartWidth = panelWidth;
    window.addEventListener("mousemove", handlePanelResizeMouseMove);
    window.addEventListener("mouseup", handlePanelResizeMouseUp);
    e.preventDefault();
  }
  function handlePanelResizeMouseMove(e: MouseEvent) {
    if (!isResizing) return;
    const delta = panelResizeStartX - e.clientX;
    const minWidth = 200;
    const maxWidth = window.innerWidth - 100;
    panelWidth = Math.max(
      minWidth,
      Math.min(maxWidth, panelResizeStartWidth + delta),
    );
  }
  function handlePanelResizeMouseUp() {
    if (isResizing) {
      isResizing = false;
      window.removeEventListener("mousemove", handlePanelResizeMouseMove);
      window.removeEventListener("mouseup", handlePanelResizeMouseUp);
    }
  }
</script>

<div class="panel-wrap">
  <div class="info-panel" style="width: {panelWidth}px;">
    {#if editingScene}
      <h3>Scene</h3>
      <label for="scene-title-input">Title:</label>
      <TextField
        bind:value={sceneName}
        bind:el={sceneNameInputEl}
        disabled={isRunning}
      />
      <label for="scene-description">Description:</label>
      <TextAreaField
        rows={5}
        bind:value={sceneDescription}
        disabled={isRunning}
      />
      <label for="scene-instructions">Instructions:</label>
      <TextAreaField
        rows={3}
        bind:value={sceneInstructions}
        disabled={isRunning}
      />
      <label for="scene-requirements">Requirements:</label>
      <TextAreaField
        rows={3}
        bind:value={sceneRequirements}
        disabled={isRunning}
      />
      <label for="scene-compatibility">Compatibility:</label>
      <TextAreaField
        rows={3}
        bind:value={sceneCompatibility}
        disabled={isRunning}
      />
    {:else if inspectorNode}
      {#if inspectorNode.role === "input"}
        <h3>Input</h3>
        <span>Name: {inspectorNode.name}</span>
        <label for="inspector-input">Input:</label>
        <TextAreaField
          rows={5}
          bind:value={inspectorNode.inputText}
          disabled={isRunning}
        />
        <label>Variables:</label>
        {#each inspectorNode.envVars as env, idx (idx)}
          <div class="env-row">
            <div class="env-key-row">
              <TextField
                placeholder="Key"
                bind:value={env.key}
                disabled={isRunning}
              />
              <button
                class="copy-button"
                onclick={() => {
                  inspectorNode.envVars.splice(idx, 1);
                  scene = [...scene];
                }}
                disabled={isRunning}>Remove</button
              >
            </div>
            <TextAreaField
              placeholder="Value"
              rows={3}
              bind:value={env.value}
              on:input={(_) => (scene = [...scene])}
              disabled={isRunning}
            />
          </div>
        {/each}
        <button
          class="copy-button"
          onclick={() => {
            inspectorNode.envVars = inspectorNode.envVars || [];
            inspectorNode.envVars.push({ key: "", value: "" });
            scene = [...scene];
          }}
          disabled={isRunning}>Add Variable</button
        >
      {:else if inspectorNode.role === "output"}
        <h3>Output</h3>
        <span>Name: {inspectorNode.name}</span>
        <label for="inspector-output">Output:</label>
        <button class="copy-button" onclick={copyOutput}>Copy</button>
        <TextAreaField rows={20} bind:value={inspectorNode.outputText} />
      {:else}
        <label for="node-type">Type:</label>
        <SelectField
          bind:value={inspectorNode.nodeType}
          options={typeOptions}
          disabled={isRunning}
        />
        <span>Available Variables:</span>
        {#if availableVariables && availableVariables.length > 0}
          <div class="available-variables">
            {#each availableVariables as varName}
              <button
                class="variable-chip"
                onmouseenter={() => handleVarHover(varName, true)}
                onmouseleave={() => handleVarHover(varName, false)}
                onclick={() => handleVarClick(varName)}
              >
                &#123;&#123;&#123;{varName}&#125;&#125;&#125;
              </button>
            {/each}
          </div>
        {:else}
          <p class="hint">No variables available</p>
        {/if}
        {#if nodeAdapters[inspectorNode.nodeType]}
          {@const SvelteComponent =
            nodeAdapters[inspectorNode.nodeType].component}
          <SvelteComponent
            node={inspectorNode}
            {isRunning}
            on:scenechange={() => (scene = [...scene])}
          />
        {:else}
          <p>No editor available for type "{inspectorNode.nodeType}"</p>
        {/if}
      {/if}
    {:else}
      <h3>Scene</h3>
      <span>Title:</span>
      <div class="scene-static" style="margin-bottom: 12px;">{sceneName}</div>
      <span>Description:</span>
      <div class="scene-static" style="white-space: pre-wrap;">
        {sceneDescription}
      </div>
      <span>Instructions:</span>
      <div class="scene-static" style="white-space: pre-wrap;">
        {sceneInstructions}
      </div>
      <span>Requirements:</span>
      <div class="scene-static" style="white-space: pre-wrap;">
        {sceneRequirements}
      </div>
      <span>Compatibility:</span>
      <div class="scene-static" style="white-space: pre-wrap;">
        {sceneCompatibility}
      </div>
    {/if}
  </div>
  <div
    class="resizer"
    onmousedown={handlePanelResizeMouseDown}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize info panel"
    tabindex="0"
  ></div>
</div>

<style>
  .panel-wrap {
    display: flex;
    height: 100%;
  }
  .info-panel {
    position: relative;
    z-index: 3;
    width: 350px;
    height: 100%;
    background: var(--surface);
    padding: 16px;
    box-shadow: var(--shadow-elevation);
    overflow-y: auto;
    font-family: "Inter", system-ui, sans-serif;
  }
  .info-panel h3 {
    margin: 0 0 12px;
    font-size: 1.3em;
    color: var(--primary-dark);
  }
  .info-panel label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    font-size: 0.95em;
    color: var(--text-secondary);
  }
  .info-panel .hint {
    font-size: 0.85em;
    color: var(--text-secondary);
    font-style: italic;
    margin-bottom: 10px;
  }
  .info-panel .message-row {
    display: flex;
    flex-direction: column;
    margin-bottom: 16px;
  }
  .info-panel .message-row .message-header {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
  .info-panel textarea[readonly] {
    background: #1e1e1e;
    color: #f8f8f2;
    font-family: Consolas, "Liberation Mono", Menlo, Courier, monospace;
    font-size: 0.9em;
    line-height: 1.4;
    min-height: 350px;
    white-space: pre-wrap;
    overflow: auto;
  }
  .info-panel textarea.command-input {
    background: #1e1e1e;
    color: #f8f8f2;
    font-family: Consolas, "Liberation Mono", Menlo, Courier, monospace;
    font-size: 0.9em;
    line-height: 1.4;
    min-height: 80px;
    white-space: pre-wrap;
    overflow: auto;
  }
  .info-panel button.copy-button {
    background-color: var(--primary);
    color: #fff;
    border: none;
    border-radius: var(--border-radius);
    padding: 6px 12px;
    font-size: 0.9em;
    cursor: pointer;
    margin-bottom: 8px;
    transition: background-color var(--transition-duration) ease;
  }
  .info-panel button.copy-button:hover {
    background-color: var(--primary-dark);
  }
  .resizer {
    width: 8px;
    cursor: col-resize;
    height: 100%;
    background-color: transparent;
  }
  .resizer:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
  .info-panel .env-row {
    margin-bottom: 16px;
  }
  .info-panel .env-row:not(:last-child) {
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    padding-bottom: 12px;
  }
  .info-panel .env-row .env-key-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .info-panel .env-row .env-key-row input {
    flex: 1;
  }
  .info-panel .env-row textarea {
    width: 100%;
    margin-top: 4px;
    margin-bottom: 0;
    resize: vertical;
  }
  .info-panel .available-variables {
    list-style: none;
    padding: 0;
    margin: 0 0 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .variable-chip {
    background: #e0e0e0;
    padding: 6px 12px;
    border: none;
    border-radius: var(--border-radius);
    font-size: 0.85em;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .variable-chip:hover {
    background: #d5d5d5;
  }
</style>

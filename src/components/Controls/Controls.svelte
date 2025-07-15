<script lang="ts">
  export let playPipeline: () => void = () => {};
  export let stopPipeline: () => void = () => {};
  export let newScene: () => void = () => {};
  export let importScene: () => void = () => {};
  export let exportScene: () => void = () => {};
  export let isRunning = false;
  export let hasPath = false;
</script>
<div class="controls">
  <button on:click={playPipeline} disabled={isRunning || !hasPath}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
    Play
  </button>
  <button on:click={stopPipeline} disabled={!isRunning}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 6h12v12H6z" />
    </svg>
    Stop
  </button>
  <div class="vertical-separator"></div>
  <button class="secondary" on:click={newScene}>New</button>
  <button class="secondary" on:click={importScene}>Import</button>
  <button class="secondary" on:click={exportScene}>Export</button>
</div>

<style>
  .controls {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    display: flex;
    gap: 12px;
    background: var(--surface);
    padding: 12px;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-elevation);
    transition: background var(--transition-duration) ease;
  }
  .controls button {
    background-color: var(--primary);
    color: #fff;
    border: none;
    border-radius: var(--border-radius);
    padding: 8px 16px;
    font-size: 0.95em;
    font-weight: 500;
    cursor: pointer;
    transition: background-color var(--transition-duration) ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .controls button:hover:not(:disabled) {
    background-color: var(--primary-dark);
  }
  .controls button:disabled {
    background-color: #e0e0e0;
    color: #999;
    cursor: default;
  }
  .controls button.secondary {
    background-color: #000;
    color: #fff;
  }
  .controls button.secondary:hover:not(:disabled) {
    background-color: #222;
  }
  .vertical-separator {
    width: 1px;
    height: 24px;
    background-color: rgba(0, 0, 0, 0.12);
    align-self: center;
  }
</style>

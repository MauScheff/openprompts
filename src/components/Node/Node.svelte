<script lang="ts">
    import type { CircleNode } from "../../lib/scene";

    export let node: CircleNode;
    export let viewScale: number;
    export let viewOffset: [number, number];
    export let canvas: HTMLCanvasElement;

    // This is for the label
    let labelStyle = "";
    $: {
        if (canvas && node) {
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            const xN = node.center[0] * viewScale + viewOffset[0];
            const yN = node.center[1] * viewScale + viewOffset[1];
            const xPx = ((xN + 1) / 2) * w;
            const pixelRadius = node.radius * viewScale * (h / 2);
            const margin = 4;
            const yPx = ((1 - yN) / 2) * h + pixelRadius + margin;
            labelStyle = `left: ${xPx}px; top: ${yPx}px;`;
        }
    }
</script>

{#if node && node.name}
    <div class="node-label" style={labelStyle}>
        {node.name}
    </div>
{/if}

<style>
    .node-label {
        position: absolute;
        transform: translateX(-50%);
        background: var(--surface);
        color: var(--text-primary);
        padding: 6px 12px;
        border: 1px solid var(--text-secondary);
        border-radius: var(--border-radius);
        font-size: 1em;
        font-weight: 600;
        box-shadow: var(--shadow-elevation);
        white-space: nowrap;
        pointer-events: none;
        z-index: 1;
        transition: transform var(--transition-duration) ease;
    }
</style>

<script>
    import reglLib from "regl";
    import { onMount } from "svelte";

    let canvas;
    let scene = [
        {
            type: "circle",
            role: "input",
            center: [-0.9, 0],
            radius: 0.1,
            color: [0, 1, 0, 1],
            selected: false,
            inputText: "",
            name: "Input",
            highlight: false,
        },
        {
            type: "circle",
            role: "output",
            center: [0.9, 0],
            radius: 0.1,
            color: [1, 0, 0, 1],
            selected: false,
            outputText: "",
            name: "Output",
            highlight: false,
        },
    ];
    // View transform for positioning and zoom
    let viewScale = 1;
    let viewOffset = [0, 0];
    // Screen-space labels below each node
    let labels = [];

    function addCircle() {
        scene.push({
            type: "circle",
            role: "default",
            name: "",
            command: "",
            center: [Math.random() * 1.8 - 0.9, Math.random() * 1.8 - 0.9],
            radius: 0.1,
            color: [Math.random(), Math.random(), Math.random(), 1.0],
            selected: false,
            highlight: false,
            outputText: "",
        });
        // Trigger reactivity for scene change
        scene = [...scene];
    }

    onMount(() => {
        // Set canvas size and pixel ratio for crisp rendering
        const resizeCanvas = () => {
            canvas.width = window.innerWidth * window.devicePixelRatio;
            canvas.height = window.innerHeight * window.devicePixelRatio;
            canvas.style.width = window.innerWidth + "px";
            canvas.style.height = window.innerHeight + "px";
        };
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        const regl = reglLib({
            canvas,
            pixelRatio: window.devicePixelRatio,
        });
        // Pan and zoom state uses component-level viewScale & viewOffset
        // Smooth zoom target values
        let viewScaleTarget = viewScale;
        let viewOffsetTarget = [...viewOffset];
        // Zoom smoothing and sensitivity
        const SMOOTHING = 0.2; // increased for snappier transitions
        const ZOOM_BASE = 1.005; // zoom sensitivity base per wheel delta
        let isPanning = false;
        let panStart = [0, 0];
        let offsetStart = [0, 0];
        // Quad covering unit circle area for fragment discarding
        const quadPositions = [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, -1],
            [1, 1],
            [-1, 1],
        ];
        const quadBuffer = regl.buffer(quadPositions);
        const drawCircle = regl({
            frag: `
            precision mediump float;
            varying vec4 fragColor;
            varying vec2 vPosition;
            void main() {
                if (dot(vPosition, vPosition) > 1.0) discard;
                gl_FragColor = fragColor;
            }`,
            vert: `
            precision mediump float;
            attribute vec2 position;
            uniform vec2 center;
            uniform float radius;
            uniform float aspect;
            uniform vec4 color;
            uniform float viewScale;
            uniform vec2 viewOffset;
            varying vec4 fragColor;
            varying vec2 vPosition;
            void main() {
                vPosition = position;
                vec2 pos = center + position * vec2(radius * aspect, radius);
                // Apply view transform
                vec2 transformed = pos * viewScale + viewOffset;
                gl_Position = vec4(transformed, 0, 1);
                fragColor = color;
            }`,
            attributes: { position: quadBuffer },
            uniforms: {
                aspect: (ctx) => ctx.viewportHeight / ctx.viewportWidth,
                center: regl.prop("center"),
                radius: regl.prop("radius"),
                color: regl.prop("color"),
                viewScale: () => viewScale,
                viewOffset: () => viewOffset,
            },
            count: 6,
            primitive: "triangles",
        });
        // Edge drawing commands
        const drawLine = regl({
            frag: `
            precision mediump float;
            uniform vec4 color;
            void main() {
                gl_FragColor = color;
            }`,
            vert: `
            precision mediump float;
            attribute vec2 position;
            uniform float viewScale;
            uniform vec2 viewOffset;
            void main() {
                vec2 pos = position * viewScale + viewOffset;
                gl_Position = vec4(pos, 0, 1);
            }`,
            attributes: { position: regl.prop("positions") },
            uniforms: {
                color: regl.prop("color"),
                viewScale: () => viewScale,
                viewOffset: () => viewOffset,
            },
            // number of vertices for each line segment (2 points)
            count: 2,
            primitive: "lines",
        });
        const drawTriangle = regl({
            frag: `
            precision mediump float;
            uniform vec4 color;
            void main() {
                gl_FragColor = color;
            }`,
            vert: `
            precision mediump float;
            attribute vec2 position;
            uniform float viewScale;
            uniform vec2 viewOffset;
            void main() {
                vec2 pos = position * viewScale + viewOffset;
                gl_Position = vec4(pos, 0, 1);
            }`,
            attributes: { position: regl.prop("positions") },
            uniforms: {
                color: regl.prop("color"),
                viewScale: () => viewScale,
                viewOffset: () => viewOffset,
            },
            // number of vertices for each triangle (3 points)
            count: 3,
            primitive: "triangles",
        });
        // Drag and drop support for circles
        let dragging = null;
        let dragOffset = [0, 0];
        canvas.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            // Clear any pipeline highlight when manually selecting
            scene.forEach((s) => (s.highlight = false));
            // Trigger reactive update to clear highlight in UI
            scene = [...scene];
            const rect = canvas.getBoundingClientRect();
            // Pointer in NDC
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = 1 - ((e.clientY - rect.top) / rect.height) * 2;
            // Convert to world coordinates
            const worldX = (ndcX - viewOffset[0]) / viewScale;
            const worldY = (ndcY - viewOffset[1]) / viewScale;
            let hitShape = null;
            let hitDx = 0,
                hitDy = 0;
            for (let i = scene.length - 1; i >= 0; i--) {
                const shape = scene[i];
                if (shape.type !== "circle") continue;
                const dx = worldX - shape.center[0];
                const dy = worldY - shape.center[1];
                if (Math.sqrt(dx * dx + dy * dy) <= shape.radius) {
                    hitShape = shape;
                    hitDx = dx;
                    hitDy = dy;
                    break;
                }
            }
            if (hitShape) {
                // Clear any edge selections when selecting a circle
                scene.forEach((s) => {
                    if (s.type === "edge") s.selected = false;
                });
                const prevSelected = scene.find(
                    (s) => s.type === "circle" && s.selected,
                );
                if (
                    prevSelected &&
                    prevSelected !== hitShape &&
                    prevSelected.role !== "output"
                ) {
                    // Remove any existing edge between these two circles
                    for (let i = scene.length - 1; i >= 0; i--) {
                        const s = scene[i];
                        if (
                            s.type === "edge" &&
                            ((s.from === prevSelected && s.to === hitShape) ||
                                (s.from === hitShape && s.to === prevSelected))
                        ) {
                            scene.splice(i, 1);
                        }
                    }
                    // Connect the previously selected circle to the clicked circle
                    scene.push({
                        type: "edge",
                        from: prevSelected,
                        to: hitShape,
                        color: [1, 1, 1, 1],
                        selected: false,
                    });
                    // Unselect all circles
                    scene.forEach((s) => {
                        if (s.type === "circle") s.selected = false;
                    });
                    // Cancel any dragging state
                    dragging = null;
                    // Trigger reactivity for scene changes
                    scene = [...scene];
                    return;
                }
                // No connection: begin dragging/selecting the clicked circle
                dragging = hitShape;
                dragOffset = [hitDx, hitDy];
                // Select only this circle
                scene.forEach((s) => {
                    if (s.type === "circle") s.selected = false;
                });
                dragging.selected = true;
                // Trigger reactivity for selection change
                scene = [...scene];
            } else {
                // Try selecting an edge if clicked near it
                const EDGE_TOLERANCE = 0.03;
                let hitEdge = null;
                for (let i = scene.length - 1; i >= 0; i--) {
                    const s = scene[i];
                    if (s.type !== "edge") continue;
                    const x1 = s.from.center[0],
                        y1 = s.from.center[1];
                    const x2 = s.to.center[0],
                        y2 = s.to.center[1];
                    const dx = x2 - x1,
                        dy = y2 - y1;
                    const len2 = dx * dx + dy * dy;
                    let t = ((worldX - x1) * dx + (worldY - y1) * dy) / len2;
                    t = Math.max(0, Math.min(1, t));
                    const projX = x1 + t * dx,
                        projY = y1 + t * dy;
                    const dist2 =
                        (worldX - projX) * (worldX - projX) +
                        (worldY - projY) * (worldY - projY);
                    if (dist2 <= EDGE_TOLERANCE * EDGE_TOLERANCE) {
                        hitEdge = s;
                        break;
                    }
                }
                if (hitEdge) {
                    // Deselect all circles and edges
                    scene.forEach((s) => {
                        if (s.type === "circle" || s.type === "edge")
                            s.selected = false;
                    });
                    hitEdge.selected = true;
                    // Cancel dragging or panning
                    dragging = null;
                    isPanning = false;
                    // Trigger reactivity for edge selection
                    scene = [...scene];
                    return;
                }
                // No shape hit: deselect everything and start panning
                scene.forEach((s) => {
                    if (s.type === "circle" || s.type === "edge")
                        s.selected = false;
                });
                // Trigger reactivity for deselection
                scene = [...scene];
                isPanning = true;
                panStart = [e.clientX, e.clientY];
                viewOffsetTarget = [...viewOffset];
                offsetStart = [...viewOffsetTarget];
            }
        });
        window.addEventListener("mousemove", (e) => {
            if (dragging) {
                const rect = canvas.getBoundingClientRect();
                // Pointer in NDC
                const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const ndcY = 1 - ((e.clientY - rect.top) / rect.height) * 2;
                // Convert to world coordinates
                const x = (ndcX - viewOffset[0]) / viewScale;
                const y = (ndcY - viewOffset[1]) / viewScale;
                dragging.center[0] = x - dragOffset[0];
                dragging.center[1] = y - dragOffset[1];
            }
        });
        window.addEventListener("mouseup", () => {
            dragging = null;
        });
        // Pan and zoom event handlers
        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
        canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const py = 1 - ((e.clientY - rect.top) / rect.height) * 2;
            const factor = Math.pow(ZOOM_BASE, -e.deltaY);
            viewScaleTarget *= factor;
            viewOffsetTarget[0] = px - (px - viewOffsetTarget[0]) * factor;
            viewOffsetTarget[1] = py - (py - viewOffsetTarget[1]) * factor;
        });
        canvas.addEventListener("mousedown", (e) => {
            if (e.button === 2) {
                isPanning = true;
                panStart = [e.clientX, e.clientY];
                viewOffsetTarget = [...viewOffset];
                offsetStart = [...viewOffsetTarget];
            }
        });
        window.addEventListener("mousemove", (e) => {
            if (isPanning) {
                const rect = canvas.getBoundingClientRect();
                const dx = e.clientX - panStart[0];
                const dy = e.clientY - panStart[1];
                const ndcX = (dx / rect.width) * 2;
                const ndcY = (-dy / rect.height) * 2;
                viewOffsetTarget[0] = offsetStart[0] + ndcX;
                viewOffsetTarget[1] = offsetStart[1] + ndcY;
                viewOffset[0] = viewOffsetTarget[0];
                viewOffset[1] = viewOffsetTarget[1];
            }
        });
        window.addEventListener("mouseup", (e) => {
            // End panning on right or left mouse release
            if (e.button === 2 || e.button === 0) {
                isPanning = false;
            }
        });
        // Delete selected circles or edges on Backspace when not editing text
        window.addEventListener("keydown", (e) => {
            if (e.key !== "Backspace") {
                return;
            }
            const target = e.target;
            // Ignore backspace if focus is on an input or textarea
            if (
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.isContentEditable)
            ) {
                return;
            }
            // Prevent default browser back navigation or deletion behavior
            e.preventDefault();
            // Delete selected circle if any
            const circleIdx = scene.findIndex(
                (s) => s.type === "circle" && s.selected,
            );
            if (circleIdx !== -1) {
                const circle = scene[circleIdx];
                // Prevent deletion of input/output nodes
                if (circle.role === "input" || circle.role === "output") {
                    return;
                }
                // Remove the circle
                scene.splice(circleIdx, 1);
                // Remove any edges connected to this circle
                for (let i = scene.length - 1; i >= 0; i--) {
                    const s = scene[i];
                    if (
                        s.type === "edge" &&
                        (s.from === circle || s.to === circle)
                    ) {
                        scene.splice(i, 1);
                    }
                }
                return;
            }
            // Delete selected edge if no circle deletion
            const edgeIdx = scene.findIndex(
                (s) => s.type === "edge" && s.selected,
            );
            if (edgeIdx !== -1) {
                scene.splice(edgeIdx, 1);
            }
        });
        regl.frame(() => {
            viewScale += (viewScaleTarget - viewScale) * SMOOTHING;
            viewOffset[0] += (viewOffsetTarget[0] - viewOffset[0]) * SMOOTHING;
            viewOffset[1] += (viewOffsetTarget[1] - viewOffset[1]) * SMOOTHING;

            regl.clear({ color: [0, 0, 0, 1], depth: 1 });
            // Draw edges with arrow heads
            scene.forEach((shape) => {
                if (shape.type === "edge") {
                    const p1 = shape.from.center;
                    const p2 = shape.to.center;
                    // Highlight if selected
                    const edgeColor = shape.selected
                        ? [1, 1, 0, 1]
                        : shape.highlight
                          ? [0, 1, 1, 1]
                          : shape.color;
                    // Compute direction and clip line to circle perimeters
                    const dx = p2[0] - p1[0];
                    const dy = p2[1] - p1[1];
                    const len = Math.sqrt(dx * dx + dy * dy);
                    if (len > 0) {
                        const ux = dx / len;
                        const uy = dy / len;
                        const aspect = canvas.clientHeight / canvas.clientWidth;
                        // Source circle boundary
                        const r1 = shape.from.radius;
                        const rX1 = r1 * aspect;
                        const rY1 = r1;
                        const t0 = (rX1 * rY1) / Math.sqrt(ux*ux * rY1*rY1 + uy*uy * rX1*rX1);
                        const start = [p1[0] + ux * t0, p1[1] + uy * t0];
                        // Target circle boundary
                        const r2 = shape.to.radius;
                        const rX2 = r2 * aspect;
                        const rY2 = r2;
                        const t1 = (rX2 * rY2) / Math.sqrt(ux*ux * rY2*rY2 + uy*uy * rX2*rX2);
                        const end = [p2[0] - ux * t1, p2[1] - uy * t1];
                        // Draw clipped line
                        drawLine({ positions: [start, end], color: edgeColor });
                        // Draw arrow head at the perimeter
                        const arrowLen = r2 * 0.4;
                        const arrowWid = r2 * 0.15;
                        const baseX = end[0] - ux * arrowLen;
                        const baseY = end[1] - uy * arrowLen;
                        const px = -uy;
                        const py = ux;
                        const left = [baseX + px * arrowWid, baseY + py * arrowWid];
                        const right = [baseX - px * arrowWid, baseY - py * arrowWid];
                        drawTriangle({
                            positions: [[end[0], end[1]], left, right],
                            color: edgeColor,
                        });
                    }
                }
            });
            // Draw circles on top of edges
            scene.forEach((shape) => {
                if (shape.type === "circle") {
                    const circleColor = shape.selected
                        ? [1, 1, 0, 1]
                        : shape.highlight
                          ? [0, 1, 1, 1]
                          : shape.color;
                    drawCircle({
                        center: shape.center,
                        radius: shape.radius,
                        color: circleColor,
                    });
                }
            });
        });
    });

    let selectedShape =
        scene.find((s) => s.type === "circle" && (s.highlight || s.selected)) ||
        scene.find((s) => s.type === "circle" && s.role === "input");
    // Update screen-space labels below each node whenever relevant state changes
    $: if (canvas) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        labels = scene
            .filter((s) => s.type === "circle")
            .map((s) => {
                const xN = s.center[0] * viewScale + viewOffset[0];
                const yN = s.center[1] * viewScale + viewOffset[1];
                const xPx = ((xN + 1) / 2) * w;
                // Compute pixel radius in Y to place label just below the circle
                const pixelRadius = s.radius * viewScale * (h / 2);
                const margin = 4; // extra spacing below circle
                const yPx = ((1 - yN) / 2) * h + pixelRadius + margin;
                return { x: xPx, y: yPx, name: s.name };
            });
        // Active shape: prefer highlighted (during play), otherwise selected by user; fallback to input node
        selectedShape =
            scene.find(
                (s) => s.type === "circle" && (s.highlight || s.selected),
            ) || scene.find((s) => s.type === "circle" && s.role === "input");
    }

    let isRunning = false;
    let abort = false;

    function getPipelineNodes() {
        const inputNode = scene.find((s) => s.role === "input");
        const outputNode = scene.find((s) => s.role === "output");
        if (!inputNode || !outputNode) return [];
        const nodes = [inputNode];
        let cur = inputNode;
        const seen = new Set([inputNode]);
        while (cur !== outputNode) {
            const edge = scene.find((e) => e.type === "edge" && e.from === cur);
            if (!edge) break;
            const nxt = edge.to;
            if (seen.has(nxt)) break;
            nodes.push(nxt);
            seen.add(nxt);
            cur = nxt;
        }
        return cur === outputNode ? nodes : [];
    }

    async function runCommand(cmd, input) {
        // If no command provided, do not forward input by default
        if (!cmd) return "";
        // Replace template variable {input} with actual data
        const expanded = cmd.replace(/{input}/g, input);
        const parts = expanded.trim().split(" ");
        const name = parts[0].toLowerCase();
        if (name === "curl" && parts[1]) {
            try {
                const res = await fetch(parts[1]);
                return await res.text();
            } catch (e) {
                return `Error fetching ${parts[1]}: ${e.message}`;
            }
        } else if (name === "uppercase") {
            return input.toUpperCase();
        } else if (name === "lowercase") {
            return input.toLowerCase();
        } else if (name === "echo") {
            // Prototype basic shell 'echo': return concatenated arguments
            return parts.slice(1).join(" ");
        }
        // Fallback: return the expanded command string
        return "";
    }

    async function playPipeline() {
        if (isRunning) return;
        const nodes = getPipelineNodes();
        if (nodes.length === 0) {
            alert("No path from input to output");
            return;
        }
        isRunning = true;
        abort = false;
        let data = scene.find((s) => s.role === "input").inputText;
        for (let i = 0; i < nodes.length && !abort; i++) {
            // Clear previous highlights and selections so info follows the play
            scene.forEach((s) => {
                s.highlight = false;
                s.selected = false;
            });
            const node = nodes[i];
            node.highlight = true;
            // Trigger reactive update so info panel shows current node
            scene = [...scene];
            if (i > 0) {
                const prev = nodes[i - 1];
                const edge = scene.find(
                    (e) =>
                        e.type === "edge" && e.from === prev && e.to === node,
                );
                if (edge) edge.highlight = true;
            }
            if (node.role === "default") {
                data = await runCommand(node.command, data);
                // Store and show intermediate output
                node.outputText = data;
                scene = [...scene];
            } else if (node.role === "output") {
                node.outputText = data;
                // Ensure final output stays shown
                scene = [...scene];
            }
            // Delay after output update so user can perceive changes
            await new Promise((r) => setTimeout(r, 500));
        }
        isRunning = false;
    }

    function stopPipeline() {
        abort = true;
        isRunning = false;
    }
</script>

<canvas bind:this={canvas}></canvas>
{#each labels as label, i (i)}
    {#if label.name}
        <div class="node-label" style="left: {label.x}px; top: {label.y}px;">
            {label.name}
        </div>
    {/if}
{/each}
<div class="controls">
    <button on:click={addCircle}>Add Circle</button>
    <button on:click={playPipeline} disabled={isRunning}>Play</button>
    <button on:click={stopPipeline} disabled={!isRunning}>Stop</button>
</div>
<div class="info-panel">
    {#if selectedShape}
        {#if selectedShape.role === "input"}
            <h3>Input</h3>
            <label>Name: {selectedShape.name}</label>
            <label>Input:</label>
            <textarea rows="5" bind:value={selectedShape.inputText}></textarea>
        {:else if selectedShape.role === "output"}
            <h3>Output</h3>
            <label>Name: {selectedShape.name}</label>
            <label>Output:</label>
            <textarea rows="5" readonly bind:value={selectedShape.outputText}
            ></textarea>
        {:else}
            <h3>Node</h3>
            <label>Name: <input bind:value={selectedShape.name} /></label>
            <label>Command: <input bind:value={selectedShape.command} /></label>
            <label class="hint"
                >Use &#123;input&#125; to reference the previous node's output</label
            >
            <label>Output:</label>
            <textarea rows="5" readonly bind:value={selectedShape.outputText}
            ></textarea>
        {/if}
    {/if}
</div>

<style>
    html,
    body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        font-family: Arial, sans-serif;
        color: #333;
        background: #f5f5f5;
    }
    canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
    }
    .controls {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 2;
        display: flex;
        gap: 8px;
        background: rgba(255, 255, 255, 0.85);
        padding: 8px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .controls button {
        background-color: #6200ee;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 0.95em;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }
    .controls button:hover:not(:disabled) {
        background-color: #3700b3;
    }
    .controls button:disabled {
        background-color: #ccc;
        color: #666;
        cursor: default;
    }
    .info-panel {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 300px;
        background: #fff;
        padding: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        max-height: calc(100% - 20px);
        overflow-y: auto;
        font-family: Arial, sans-serif;
        z-index: 3;
    }
    .info-panel h3 {
        margin: 0 0 8px;
        font-size: 1.2em;
    }
    .info-panel label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
        font-size: 0.95em;
    }
    .info-panel .hint {
        font-size: 0.85em;
        color: #666;
        font-style: italic;
        margin-bottom: 8px;
    }
    .info-panel input,
    .info-panel textarea {
        width: 100%;
        margin-bottom: 12px;
        padding: 6px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 0.95em;
        font-family: inherit;
        box-sizing: border-box;
    }
    .node-label {
        position: absolute;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.95);
        color: #222;
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 1em;
        font-weight: 600;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        white-space: nowrap;
        pointer-events: none;
        z-index: 1;
    }
</style>

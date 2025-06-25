<script>
    import { invoke } from "@tauri-apps/api/core";

    import reglLib from "regl";
    import { onMount } from "svelte";
// File save dialog (Tauri)
    import { open, save } from "@tauri-apps/plugin-dialog";
    import { parseFromYaml, parseToYaml } from "./yaml.js";
// import { readFile } from "@tauri-apps/plugin-fs";
    // import * as path from "@tauri-apps/api/path";
    import { create, readTextFile } from "@tauri-apps/plugin-fs";

    let canvas;
    // Define consistent node colors: same for input/output, same for inner nodes
    // Node color palette for high contrast against dark background
    // Input/output nodes: amber (#FFB74D)
    const ioColor = [1, 0.718, 0.302, 1];
    // Prompt nodes: cyan (#4DD0E1)
    const defaultNodeColor = [0.302, 0.816, 0.882, 1];
    // Selected nodes and edges: pink (#E91E63)
    const selectedColor = [0.91, 0.12, 0.39, 1];
    // Highlight during pipeline execution: yellow (#FFEB3B)
    const highlightColor = [1, 0.92, 0.23, 1];
    let scene;
    let sceneName;

    if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("scene");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object' && parsed.hasOwnProperty('scene')) {
                    sceneName = parsed.name || "Untitled Scene";
                    const sceneData = parsed.scene || [];
                    
                    const circles = sceneData.filter((s) => s.type === "circle");
                    circles.forEach((s) => {
                        if (s.role === "input" && s.envVars == null) {
                            s.envVars = [];
                        }
                    });

                    const edgesRaw = sceneData.filter((s) => s.type === "edge");
                    const newScene = [...circles];
                    edgesRaw.forEach((e) => {
                        const fromNode = newScene.find(
                            (s) => s.type === "circle" && s.name === e.from.name,
                        );
                        const toNode = newScene.find(
                            (s) => s.type === "circle" && s.name === e.to.name,
                        );
                        if (fromNode && toNode) {
                            newScene.push({
                                type: "edge",
                                from: fromNode,
                                to: toNode,
                                color: e.color,
                                selected: e.selected,
                                highlight: e.highlight || false,
                            });
                        }
                    });
                    scene = newScene;
                } else {
                    // Old format or corrupted, initialize a new scene
                    scene = [];
                    sceneName = "Untitled Scene";
                }
            } catch (err) {
                console.error("Failed to load scene from localStorage:", err);
                scene = [];
                sceneName = "Untitled Scene";
            }
        } else {
            // No saved data, initialize a new scene
            scene = [];
            sceneName = "Untitled Scene";
        }
    } else {
        // SSR
        scene = [];
        sceneName = "Untitled Scene";
    }
    // View transform for positioning and zoom
    let viewScale = 1;
    let viewOffset = [0, 0];
    // Screen-space labels below each node
    let labels = [];
    // Resizable info panel width
    let panelWidth = 350;
    let isResizing = false;
    let panelResizeStartX = 0;
    let panelResizeStartWidth = 0;

    // Resize handlers for the info panel
    function handlePanelResizeMouseDown(e) {
        isResizing = true;
        panelResizeStartX = e.clientX;
        panelResizeStartWidth = panelWidth;
        window.addEventListener("mousemove", handlePanelResizeMouseMove);
        window.addEventListener("mouseup", handlePanelResizeMouseUp);
        e.preventDefault();
    }

    function handlePanelResizeMouseMove(e) {
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

    function addCircle(x, y) {
        const prevSelected = scene.find((s) => s.type === "circle" && s.selected);
        const newNode = {
            type: "circle",
            role: "default",
            name: `Prompt ${scene.filter((s) => s.type === "circle").length - 1}`,
            command: "echo {input}",
            center: [x, y],
            radius: 0.1,
            color: defaultNodeColor,
            selected: true,
            highlight: false,
            outputText: "",
        };
        if (prevSelected) {
            prevSelected.selected = false;
        }
        scene.push(newNode);
        if (prevSelected) {
            scene.push({
                type: "edge",
                from: prevSelected,
                to: newNode,
                color: [1, 1, 1, 1],
                selected: false,
            });
        }
        scene = [...scene];
    }

    onMount(() => {
        // Set canvas size and pixel ratio for crisp rendering
        const resizeCanvas = () => {
            // Size canvas to its display container (excluding info panel)
            const width = canvas.clientWidth * window.devicePixelRatio;
            const height = canvas.clientHeight * window.devicePixelRatio;
            canvas.width = width;
            canvas.height = height;
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
        canvas.addEventListener("dblclick", (e) => {
            const rect = canvas.getBoundingClientRect();
            // Pointer in NDC
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = 1 - ((e.clientY - rect.top) / rect.height) * 2;
            // Convert to world coordinates
            const worldX = (ndcX - viewOffset[0]) / viewScale;
            const worldY = (ndcY - viewOffset[1]) / viewScale;
            addCircle(worldX, worldY);
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
                // Remove the circle and any connected edges
                scene.splice(circleIdx, 1);
                for (let i = scene.length - 1; i >= 0; i--) {
                    const s = scene[i];
                    if (
                        s.type === "edge" &&
                        (s.from === circle || s.to === circle)
                    ) {
                        scene.splice(i, 1);
                    }
                }
                // Trigger reactivity
                scene = [...scene];
                return;
            }
            // Delete selected edge if no circle deletion
            const edgeIdx = scene.findIndex(
                (s) => s.type === "edge" && s.selected,
            );
            if (edgeIdx !== -1) {
                scene.splice(edgeIdx, 1);
                // Trigger reactivity
                scene = [...scene];
            }
        });
        regl.frame(() => {
            viewScale += (viewScaleTarget - viewScale) * SMOOTHING;
            viewOffset[0] += (viewOffsetTarget[0] - viewOffset[0]) * SMOOTHING;
            viewOffset[1] += (viewOffsetTarget[1] - viewOffset[1]) * SMOOTHING;

            // Warm dark grey background
            regl.clear({ color: [0.18, 0.18, 0.18, 1], depth: 1 });
            // Draw edges with arrow heads
            scene.forEach((shape) => {
                if (shape.type === "edge") {
                    const p1 = shape.from.center;
                    const p2 = shape.to.center;
                    // Highlight if selected
                    const edgeColor = shape.selected
                        ? selectedColor
                        : shape.highlight
                          ? highlightColor
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
                        const t0 =
                            (rX1 * rY1) /
                            Math.sqrt(
                                ux * ux * rY1 * rY1 + uy * uy * rX1 * rX1,
                            );
                        const start = [p1[0] + ux * t0, p1[1] + uy * t0];
                        // Target circle boundary
                        const r2 = shape.to.radius;
                        const rX2 = r2 * aspect;
                        const rY2 = r2;
                        const t1 =
                            (rX2 * rY2) /
                            Math.sqrt(
                                ux * ux * rY2 * rY2 + uy * uy * rX2 * rX2,
                            );
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
                        const left = [
                            baseX + px * arrowWid,
                            baseY + py * arrowWid,
                        ];
                        const right = [
                            baseX - px * arrowWid,
                            baseY - py * arrowWid,
                        ];
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
                    if (shape.selected) {
                        // Selected: draw an outline ring then fill
                        const outlineFactor = 1.2;
                        drawCircle({
                            center: shape.center,
                            radius: shape.radius * outlineFactor,
                            color: selectedColor,
                        });
                        drawCircle({
                            center: shape.center,
                            radius: shape.radius,
                            color: shape.color,
                        });
                    } else if (shape.highlight) {
                        // Highlighted during play: fill with highlight color
                        drawCircle({
                            center: shape.center,
                            radius: shape.radius,
                            color: highlightColor,
                        });
                    } else {
                        // Normal node
                        drawCircle({
                            center: shape.center,
                            radius: shape.radius,
                            color: shape.color,
                        });
                    }
                }
            });
        });
    });

    let selectedShape =
        scene.find((s) => s.type === "circle" && (s.highlight || s.selected));
    // Update screen-space labels below each node whenever relevant state changes
    $: if (canvas) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        // Update canvas resolution to match CSS size
        canvas.width = w * window.devicePixelRatio;
        canvas.height = h * window.devicePixelRatio;
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
        // Active shape: prefer highlighted (during play), otherwise selected by user
        selectedShape =
            scene.find(
                (s) => s.type === "circle" && (s.highlight || s.selected),
            );
    }

    let isRunning = false;
    let abort = false;

    function getPipelineNodes() {
        const inputNode = scene.find((s) => s.role === "input");
        const outputNode = scene.find((s) => s.role === "output");
        if (!inputNode || !outputNode) return [];

        const nodes = scene.filter((s) => s.type === "circle");
        const edges = scene.filter((s) => s.type === "edge");
        const adj = new Map(nodes.map((n) => [n, []]));
        for (const edge of edges) {
            if (adj.has(edge.from)) {
                adj.get(edge.from).push(edge.to);
            }
        }

        const queue = [inputNode];
        const seen = new Set([inputNode]);
        while (queue.length > 0) {
            const curr = queue.shift();
            if (curr === outputNode) {
                return [inputNode, outputNode]; // Found a path, return non-empty array
            }
            const successors = adj.get(curr) || [];
            for (const successor of successors) {
                if (!seen.has(successor)) {
                    seen.add(successor);
                    queue.push(successor);
                }
            }
        }

        return []; // No path found
    }

    // Reactive flag: whether there is a valid path from input to output
    let hasPath = false;
    $: hasPath = (() => {
        // Reference scene to ensure reactivity
        scene;
        return getPipelineNodes().length > 0;
    })();

    async function runCommand(stdin, cmd) {
        let result = "";
        try {
            result = await invoke("run_command", { stdin: stdin, cmd: cmd });
            console.log(`Command executed: ${cmd} with result:`, result);
        } catch (error) {
            result = `Error here: ${error}`;
        }
        return result;
    }

    // async function runCommand(cmd, input) {
    //     // If no command provided, do not forward input by default
    //     if (!cmd) return "";
    //     // Replace template variable {input} with actual data
    //     const expanded = cmd.replace(/{input}/g, input);
    //     // Helper to invoke Tauri backend if available
    //     async function invokeTauri(command) {
    //         try {
    //             const { invoke: tauriInvoke } = await import(
    //                 "@tauri-apps/api/tauri"
    //             );
    //             return await tauriInvoke("run_command", { cmd: command });
    //         } catch (e) {
    //             return `Error executing command: ${e}`;
    //         }
    //     }
    //     // If the command uses shell features (e.g. multiple commands), delegate to backend shell

    //     // Fallback: run command via backend shell
    //     try {
    //         const { invoke: tauriInvoke } = await import(
    //             "@tauri-apps/api/tauri"
    //         );
    //         return await tauriInvoke("run_command", { cmd: expanded });
    //     } catch (e) {
    //         console.error("Error invoking Tauri command:", e);
    //     }

    //     return "Simulating: " + expanded;
    // }

    async function playPipeline() {
        if (isRunning) return;

        const nodes = scene.filter((s) => s.type === "circle");
        const edges = scene.filter((s) => s.type === "edge");
        const inputNode = nodes.find((n) => n.role === "input");
        const outputNode = nodes.find((n) => n.role === "output");

        if (!inputNode || !outputNode) {
            alert("Input and Output nodes must be defined.");
            return;
        }

        // Build graph and in-degrees
        const adj = new Map(nodes.map((n) => [n, []]));
        const inDegree = new Map(nodes.map((n) => [n, 0]));
        edges.forEach((edge) => {
            if (adj.has(edge.from)) {
                adj.get(edge.from).push(edge.to);
            }
            if (inDegree.has(edge.to)) {
                inDegree.set(edge.to, inDegree.get(edge.to) + 1);
            }
        });

        isRunning = true;
        abort = false;

        const nodeOutputs = new Map();
        const executedNodes = new Set();
        let queue = [];

        // Start with nodes that have no incoming edges (usually just the input node)
        for (const [node, degree] of inDegree.entries()) {
            if (degree === 0) {
                queue.push(node);
            }
        }

        // Set initial input
        if (inputNode) {
            nodeOutputs.set(inputNode, inputNode.inputText);
        }

        // Prepare environment variables from input node
        const envVars = (inputNode.envVars || []).filter(
            (e) => e.key && e.value,
        );
        const envPrefix =
            envVars.length > 0
                ? envVars.map((e) => `${e.key}='${e.value}'`).join("; ") + "; "
                : "";

        while (queue.length > 0 && !abort) {
            const currentBatch = queue;
            queue = [];

            // Highlight all nodes in the current batch
            scene.forEach((s) => (s.highlight = false));
            currentBatch.forEach((node) => (node.highlight = true));
            scene = [...scene];

            const promises = currentBatch.map(async (node) => {
                if (abort) return;

                // Gather inputs from parent nodes
                const parentEdges = edges.filter((e) => e.to === node);
                let inputData;

                if (node.role === "input") {
                    inputData = node.inputText;
                } else {
                    const parentOutputs = parentEdges.map((e) => {
                        if (!nodeOutputs.has(e.from)) {
                            console.error(
                                `Output not found for parent ${e.from.name} of ${node.name}`,
                            );
                            return "";
                        }
                        return nodeOutputs.get(e.from);
                    });
                    inputData = parentOutputs.join("\n");
                }

                let outputData = inputData;
                if (node.role === "default") {
                    const rawCmd = node.command
                        .trim()
                        .replace(/{input}/g, inputData);
                    const cmd = envPrefix ? `${envPrefix}${rawCmd}` : rawCmd;
                    console.log(`Running command on node ${node.name}: ${cmd}`);
                    outputData = await runCommand(inputData, cmd);
                    node.outputText = outputData;
                } else if (node.role === "output") {
                    node.outputText = inputData;
                }

                nodeOutputs.set(node, outputData);
                executedNodes.add(node);

                // Add successors to the next batch if all their parents are done
                const successors = adj.get(node) || [];
                for (const successor of successors) {
                    const parentsOfSuccessor = edges
                        .filter((e) => e.to === successor)
                        .map((e) => e.from);
                    const allParentsDone = parentsOfSuccessor.every((p) =>
                        executedNodes.has(p),
                    );
                    if (allParentsDone) {
                        queue.push(successor);
                    }
                }
                scene = [...scene];
            });

            await Promise.all(promises);
            if (!abort) {
                await new Promise((r) => setTimeout(r, 650));
            }
        }

        isRunning = false;
        // Clear highlights
        scene.forEach((s) => (s.highlight = false));
        scene = [...scene];
    }

    function stopPipeline() {
        abort = true;
        isRunning = false;
    }

    function newScene() {
        scene = [
            {
                type: "circle",
                role: "input",
                center: [-0.9, 0],
                radius: 0.1,
                color: ioColor,
                selected: false,
                inputText: "",
                envVars: [],
                name: "Input",
                highlight: false,
            },
            {
                type: "circle",
                role: "output",
                center: [0.9, 0],
                radius: 0.1,
                color: ioColor,
                selected: false,
                outputText: "",
                name: "Output",
                highlight: false,
            },
        ];
        sceneName = "Untitled Scene";
    }

    async function copyOutput() {
        if (!selectedShape || !selectedShape.outputText) {
            return;
        }
        try {
            await navigator.clipboard.writeText(selectedShape.outputText);
        } catch (err) {
            console.error("Failed to copy output:", err);
        }
    }

    async function importScene() {
        const file = await open({
            multiple: false,
            directory: false,
            filters: [
                {
                    name: "My Filter",
                    extensions: ["yaml"],
                },
            ],
        });
        const sceneYaml = await readTextFile(file);
        const s = await parseFromYaml(sceneYaml);
        // Validate scene structure
        if (typeof s !== 'object' || s === null || !s.scene || !Array.isArray(s.scene)) {
            alert("Invalid scene format. Please check the YAML file.");
            return;
        }
        sceneName = s.name || "Untitled Scene";
        const sceneData = s.scene;

        const circles = sceneData.filter((item) => item.type === "circle");
        // Ensure input node has envVars property
        circles.forEach((item) => {
            if (item.role === "input" && item.envVars == null) {
                item.envVars = [];
            }
        });

        const edgesRaw = sceneData.filter((item) => item.type === "edge");
        const newScene = [...circles];
        edgesRaw.forEach((e) => {
            const fromNode = newScene.find(
                (item) => item.type === "circle" && item.name === e.from.name,
            );
            const toNode = newScene.find(
                (item) => item.type === "circle" && item.name === e.to.name,
            );
            if (fromNode && toNode) {
                newScene.push({
                    type: "edge",
                    from: fromNode,
                    to: toNode,
                    color: e.color,
                    selected: e.selected,
                    highlight: e.highlight || false,
                });
            }
        });
        scene = newScene;
    }

    // Prompt user to choose file path for exporting scene (dialog only)
    async function exportScene() {
        // Example filters: adjust name and extensions as needed
        const path = await save({
            filters: [
                {
                    name: "My Filter",
                    extensions: ["yaml"],
                },
            ],
        });

        // Path is null if dialog was cancelled
        if (path) {
            console.log("Selected export path:", path);
        } else {
            console.log("Save dialog was cancelled");
        }

        const yaml = parseToYaml({ name: sceneName, scene: scene });
        const file = await create(path, {
            overwrite: true,
        });
        await file.write(new TextEncoder().encode(yaml));
        await file.close();
    }

    $: if (typeof window !== "undefined") {
        window.localStorage.setItem(
            "scene",
            JSON.stringify({ name: sceneName, scene: scene }),
        );
    }
</script>

<div class="app-wrap">
    <h1
        class="scene-title"
        contenteditable="true"
        on:blur={(e) => (sceneName = e.target.innerText)}
    >
        {sceneName}
    </h1>
    <div class="info-panel" style="width: {panelWidth}px;">
        {#if selectedShape}
            {#if selectedShape.role === "input"}
                <h3>Input</h3>
                <label>Name: {selectedShape.name}</label>
                <label>Input:</label>
                <textarea rows="5" bind:value={selectedShape.inputText}
                ></textarea>
                <label>Environment Variables:</label>
                {#each selectedShape.envVars as env, idx (idx)}
                    <div class="env-row">
                        <div class="env-key-row">
                            <input
                                placeholder="Key"
                                bind:value={env.key}
                                on:input={() => (scene = [...scene])}
                            />
                            <button
                                class="copy-button"
                                on:click={() => {
                                    selectedShape.envVars.splice(idx, 1);
                                    scene = [...scene];
                                }}
                            >
                                Remove
                            </button>
                        </div>
                        <textarea
                            placeholder="Value"
                            rows="3"
                            bind:value={env.value}
                            on:input={() => (scene = [...scene])}
                        ></textarea>
                    </div>
                {/each}
                <button
                    class="copy-button"
                    on:click={() => {
                        selectedShape.envVars = selectedShape.envVars || [];
                        selectedShape.envVars.push({ key: "", value: "" });
                        scene = [...scene];
                    }}
                >
                    Add Variable
                </button>
            {:else if selectedShape.role === "output"}
                <h3>Output</h3>
                <label>Name: {selectedShape.name}</label>
                <label>Output:</label>
                <button class="copy-button" on:click={copyOutput}>Copy</button>
                <textarea
                    rows="20"
                    readonly
                    bind:value={selectedShape.outputText}
                ></textarea>
            {:else}
                <h3>Prompt</h3>
                <label>Name: <input bind:value={selectedShape.name} /></label>
                <label>Command:</label>
                <textarea
                    rows="10"
                    class="command-input"
                    bind:value={selectedShape.command}
                ></textarea>
                <label class="hint">Define variables in the input node.</label>
                <label>Output:</label>
                <button class="copy-button" on:click={copyOutput}>Copy</button>
                <textarea
                    rows="20"
                    readonly
                    bind:value={selectedShape.outputText}
                ></textarea>
            {/if}
        {/if}
    </div>
    <!-- Resizer between info panel and canvas -->
    <div class="resizer" on:mousedown={handlePanelResizeMouseDown}></div>

    <div class="canvas-container">
        <canvas bind:this={canvas}></canvas>
        {#each labels as label, i (i)}
            {#if label.name}
                <div
                    class="node-label"
                    style="left: {label.x}px; top: {label.y}px;"
                >
                    {label.name}
                </div>
            {/if}
        {/each}
    </div>

    <div class="controls">
        <button on:click={playPipeline} disabled={isRunning || !hasPath}>
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
            >
                <path d="M8 5v14l11-7z" />
            </svg>
            Play
        </button>
        <button on:click={stopPipeline} disabled={!isRunning}>
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
            >
                <path d="M6 6h12v12H6z" />
            </svg>
            Stop
        </button>
        <div class="vertical-separator"></div>
        <button on:click={newScene}>New</button>
        <button on:click={importScene}>Import</button>
        <button on:click={exportScene}>Export</button>
    </div>
</div>

<style>
    /* Import professional font */
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");
    /* Design system variables */
    :root {
        --primary: #6200ee;
        --primary-dark: #3700b3;
        --secondary: #61afef;
        /* Warm dark grey background (like Figma) */
        --bg-light: #2e2e2e;
        --surface: #ffffff;
        --text-primary: #333333;
        --text-secondary: #666666;
        --border-radius: 8px;
        --shadow-elevation: 0 4px 12px rgba(0, 0, 0, 0.1);
        --transition-duration: 0.3s;
    }
    :global(html, body) {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
    }
    :global(body) {
        font-family: "Inter", system-ui, sans-serif;
        color: var(--text-primary);
        background: var(--bg-light);
    }
    .app-wrap {
        display: flex;
        flex-direction: row-reverse;
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
    }
    .canvas-container {
        flex: 1;
        position: relative;
    }
    /* Full-screen canvas */
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
    /* Subtle vertical separator between control groups */
    .vertical-separator {
        width: 1px;
        height: 24px;
        background-color: rgba(0, 0, 0, 0.12);
        align-self: center;
    }
    .info-panel {
        /* Static right panel, full height */
        position: relative;
        z-index: 3;
        width: 350px;
        height: 100%;
        background: var(--surface);
        padding: 16px;
        box-shadow: var(--shadow-elevation);
        /* border-radius: var(--border-radius); */
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
    .info-panel input,
    .info-panel textarea {
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
    .info-panel input:focus,
    .info-panel textarea:focus {
        outline: none;
        border-color: var(--primary);
    }
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
    /* Enhanced styling for output areas to improve readability */
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
    /* Terminal-like styling for prompt command input */
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
    /* Copy button in info panel */
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
    /* Resizer handle */
    .resizer {
        width: 8px;
        cursor: col-resize;
        height: 100%;
        background-color: transparent;
    }
    .resizer:hover {
        background-color: rgba(0, 0, 0, 0.1);
    }
    /* Layout, spacing, and separators for environment variable rows */
    .info-panel .env-row {
        margin-bottom: 16px;
    }
    /* Separator line between each variable (not after last) */
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
    .scene-title {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        z-index: 2;
        font-size: 1.5em;
        font-weight: 600;
        background: none;
        border: none;
        outline: none;
        text-align: center;
    }
</style>

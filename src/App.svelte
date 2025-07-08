<script lang="ts">
    import {
        type CircleNode,
        type Edge,
        type SceneShape,
        ensureInputOutputNodes,
        generateId,
        getDefaultScene,
        ioColor,
        parseSavedScene,
        serializeScene
    } from './lib/scene';

    import { run } from "svelte/legacy";

    import { invoke } from "@tauri-apps/api/core";

    import { open, save } from "@tauri-apps/plugin-dialog";
    import reglLib from "regl";
    import { onMount, tick } from "svelte";
    import { parseFromYaml, parseToYaml } from "./yaml";
// import { readFile } from "@tauri-apps/plugin-fs";
    // import * as path from "@tauri-apps/api/path";
    import { create, readTextFile } from "@tauri-apps/plugin-fs";

    import BashNodeEditor from "./node-editors/BashNodeEditor.svelte";
    import NewNodeEditor from "./node-editors/NewNodeEditor.svelte";
    import NodeJSEditor from "./node-editors/NodeJSEditor.svelte";
    import OpenAINodeEditor from "./node-editors/OpenAINodeEditor.svelte";
// Shared inspector input components
    import SelectField from "./components/SelectField.svelte";
    import TextAreaField from "./components/TextAreaField.svelte";
    import TextField from "./components/TextField.svelte";
    // Registry mapping nodeType to adapter component and label
    const nodeAdapters = {
        newNode: { component: NewNodeEditor, label: "New Node" },
        bash: { component: BashNodeEditor, label: "Bash Shell" },
        OpenAI: { component: OpenAINodeEditor, label: "OpenAI API" },
        nodeJS: { component: NodeJSEditor, label: "NodeJS" },
    };
    // Options for node type selector
    let typeOptions = $derived(
        Object.entries(nodeAdapters).map(([value, { label }]) => ({
            value,
            label,
        })),
    );

    import { executors } from "./node-executors";

    // Direct reference to the canvas element for WebGL rendering
    // Use reactive state so that effects depending on canvas run after it is bound
    let canvas = $state<HTMLCanvasElement | null>(null);
    // Last focused input/textarea for variable insertion
    let lastFocusedEl: HTMLInputElement | HTMLTextAreaElement | null = null;
    let scene = $state<SceneShape[]>([]);
    let sceneName = $state<string>("");
    let sceneDescription = $state<string>("");
    let sceneInstructions = $state<string>("");
    let sceneRequirements = $state<string>("");
    let sceneCompatibility = $state<string>("");
    let editingScene = $state<boolean>(false);
    let sceneNameInputEl = $state<HTMLInputElement | null>(null);

    // Fix focus typing
    async function handleSceneTitleClick() {
        editingScene = true;
        await tick();
        if (sceneNameInputEl) (sceneNameInputEl as HTMLInputElement).focus();
    }

    // Load persisted scene or initialize default
    if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("scene");
        if (saved) {
            try {
                const parsedRaw = JSON.parse(saved);
                const { meta, scene: loaded } = parseSavedScene(parsedRaw);
                sceneName = meta.name;
                sceneDescription = meta.description;
                sceneInstructions = meta.instructions;
                sceneRequirements = meta.requirements;
                sceneCompatibility = meta.compatibility;
                scene = loaded;
            } catch (err) {
                console.error("Failed to load scene from localStorage:", err);
                sceneName = "Untitled Flow";
                sceneDescription = "";
                sceneInstructions = "";
                sceneRequirements = "";
                sceneCompatibility = "";
                scene = getDefaultScene();
            }
        } else {
            sceneName = "Untitled Flow";
            sceneDescription = "";
            sceneInstructions = "";
            sceneRequirements = "";
            sceneCompatibility = "";
            scene = getDefaultScene();
        }
    } else {
        // SSR
        sceneName = "Untitled Flow";
        sceneDescription = "";
        sceneInstructions = "";
        sceneRequirements = "";
        sceneCompatibility = "";
        scene = getDefaultScene();
    }
    // Ensure there is always an input and output node
    scene = ensureInputOutputNodes(scene);
    // Define color constants for nodes
    const defaultNodeColor = [0.85, 0.85, 0.85, 1]; // light gray for default nodes
    const selectedColor = [0.38, 0.93, 0.67, 1]; // green for selected
    const highlightColor = [1, 0.85, 0.38, 1]; // yellow for highlight
    // View transform for positioning and zoom
    let viewScale = $state(1);
    let viewOffset = $state([0, 0]);
    // Screen-space labels below each node
    let labels = $state([]);
    // Resizable info panel width
    let panelWidth = $state(350);
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
        const prevSelected = scene.find(
            (s): s is CircleNode => s.type === "circle" && s.selected,
        );
        const newNode: CircleNode = {
            id: generateId(),
            type: "circle",
            role: "default",
            nodeType: "newNode",
            name: `Node ${scene.filter((s): s is CircleNode => s.type === "circle").length - 1}`,
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
            const newEdge: Edge = {
                type: "edge",
                from: prevSelected,
                to: newNode,
                color: [1, 1, 1, 1],
                selected: false,
            };
            scene.push(newEdge);
        }
        scene = [...scene];
    }

    onMount(() => {
        // Set canvas size and pixel ratio for crisp rendering
        const resizeCanvas = () => {
            if (!canvas) return;
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
                center: regl.prop<{ center: [number, number] }, any>("center"),
                radius: regl.prop<{ radius: number }, any>("radius"),
                color: regl.prop<{ color: number[] }, any>("color"),
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
            attributes: {
                position: regl.prop<{ positions: [number, number][] }, any>(
                    "positions",
                ),
            },
            uniforms: {
                color: regl.prop<{ color: number[] }, any>("color"),
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
            attributes: {
                position: regl.prop<{ positions: [number, number][] }, any>(
                    "positions",
                ),
            },
            uniforms: {
                color: regl.prop<{ color: number[] }, any>("color"),
                viewScale: () => viewScale,
                viewOffset: () => viewOffset,
            },
            // number of vertices for each triangle (3 points)
            count: 3,
            primitive: "triangles",
        });
        // Drag and drop support for circles
        let dragging: CircleNode | null = null;
        let dragOffset = [0, 0];
        canvas.addEventListener("mousedown", (e) => {
            editingScene = false;
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
                    prevSelected.type === "circle" &&
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
                // Trigger reactivity: update scene to reflect moved circle and attached edges
                scene = [...scene];
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
            editingScene = false;
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
                ((target as HTMLElement).tagName === "INPUT" ||
                    (target as HTMLElement).tagName === "TEXTAREA" ||
                    (target as HTMLElement).isContentEditable)
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
                if (
                    circle.type === "circle" &&
                    (circle.role === "input" || circle.role === "output")
                ) {
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
            if (!canvas) return;
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

    // Fix $state usage for input/output node check
    let selectedShape = $derived<CircleNode | undefined>(
        scene.find(
            (s) => s.type === "circle" && (s.highlight || s.selected),
        ) as CircleNode | undefined,
    );

    // Fix canvas property access
    run(() => {
        if (canvas) {
            const w = (canvas as HTMLCanvasElement).clientWidth;
            const h = (canvas as HTMLCanvasElement).clientHeight;
            (canvas as HTMLCanvasElement).width = w * window.devicePixelRatio;
            (canvas as HTMLCanvasElement).height = h * window.devicePixelRatio;
            labels = scene
                .filter((s) => s.type === "circle")
                .map((s) => {
                    const xN = s.center[0] * viewScale + viewOffset[0];
                    const yN = s.center[1] * viewScale + viewOffset[1];
                    const xPx = ((xN + 1) / 2) * w;
                    // Compute pixel radius in Y to place label just below the circle
                    const pixelRadius = s.radius * viewScale * (h / 2);
                    const margin = 4;
                    const yPx = ((1 - yN) / 2) * h + pixelRadius + margin;
                    return { x: xPx, y: yPx, name: s.name };
                });
            selectedShape = scene.find(
                (s) => s.type === "circle" && (s.highlight || s.selected),
            ) as CircleNode | undefined;
        }
    });

    let isRunning = $state(false);
    let abort = false;
    let currentNode = $state(null);
    let inspectorNode = $derived(isRunning ? currentNode : selectedShape);
    run(() => {
        if (inspectorNode) {
            editingScene = false;
        }
    });
    // Compute available variables: single-input 'input' or multi-inputs 'inputs.i', plus env-vars
    let availableVariables = $derived(
        (() => {
            if (
                !inspectorNode ||
                inspectorNode.role === "input" ||
                inspectorNode.role === "output"
            ) {
                return [];
            }
            // Find incoming edges to current node
            const inEdges = scene.filter(
                (s) => s.type === "edge" && s.to === inspectorNode,
            );
            let vars = [];
            if (inEdges.length === 1) {
                vars.push("input");
            } else if (inEdges.length > 1) {
                for (let i = 0; i < inEdges.length; i++) {
                    vars.push(`inputs.${i}`);
                }
            }
            // Environment variable keys from input node(s)
            const envVars = scene
                .filter(
                    (s): s is CircleNode =>
                        s.type === "circle" && s.role === "input",
                )
                .map((s) => (s.envVars || []).map((e) => e.key))
                .reduce((acc, val) => acc.concat(val), [])
                .filter((k) => k);
            return [...vars, ...envVars];
        })(),
    );
    // Highlight incoming edges when hovering variable chips
    function handleVarHover(varName, active) {
        if (!inspectorNode) return;
        // Clear highlights on incoming edges
        const inEdges = scene.filter(
            (s) => s.type === "edge" && s.to === inspectorNode,
        );
        inEdges.forEach((e) => (e.highlight = false));
        // Highlight based on variable
        if (varName === "input") {
            inEdges.forEach((e) => (e.highlight = active));
        } else if (varName.startsWith("inputs.")) {
            const idx = parseInt(varName.split(".")[1], 10);
            if (!isNaN(idx) && inEdges[idx]) {
                inEdges[idx].highlight = active;
            }
        }
        scene = [...scene];
    }
    // Insert variable into focused input or textarea when chip is clicked
    function handleVarClick(varName) {
        // Determine target element: current focus or last focused input/textarea
        let activeEl = document.activeElement;
        if (
            !(
                activeEl &&
                (activeEl.tagName === "TEXTAREA" ||
                    activeEl.tagName === "INPUT")
            )
        ) {
            activeEl = lastFocusedEl;
        }
        if (
            activeEl &&
            (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT")
        ) {
            const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
            const start = inputEl.selectionStart ?? 0;
            const end = inputEl.selectionEnd ?? 0;
            const value = inputEl.value;
            const insertion = "{{{" + varName + "}}}";
            inputEl.value =
                value.slice(0, start) + insertion + value.slice(end);
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            const newPos = start + insertion.length;
            inputEl.selectionStart = inputEl.selectionEnd = newPos;
            inputEl.focus();
        }
    }

    function getPipelineNodes() {
        const inputNode = scene.find(
            (s): s is CircleNode => s.type === "circle" && s.role === "input",
        );
        const outputNode = scene.find(
            (s): s is CircleNode => s.type === "circle" && s.role === "output",
        );
        if (!inputNode || !outputNode) return [];

        const nodes = scene.filter((s): s is CircleNode => s.type === "circle");
        const edges = scene.filter((s): s is Edge => s.type === "edge");
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
    let hasPath = $state(false);
    // Derive hasPath from scene changes
    $effect(() => {
        hasPath = getPipelineNodes().length > 0;
    });

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
        let outputNode = nodes.find((n) => n.role === "output");

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
        // Utility to shell-escape variable values (handles single quotes)
        const shellEscape = (value) => {
            return "'" + value.replace(/'/g, "'\\''") + "'";
        };
        // Build prefix script to export variables for the pipeline
        const envPrefix =
            envVars.length > 0
                ? envVars
                      .map((e) => `export ${e.key}=${shellEscape(e.value)}`)
                      .join("; ") + "; "
                : "";
        // Build variables object for executors
        const variables = envVars.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
        }, {});

        while (queue.length > 0 && !abort) {
            const currentBatch = queue;
            queue = [];

            // Highlight all nodes in the current batch
            scene.forEach((s) => (s.highlight = false));
            currentBatch.forEach((node) => (node.highlight = true));
            scene = [...scene];

            const promises = currentBatch.map(async (node) => {
                if (abort) return;
                currentNode = node;

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
                // Execute node based on its type via registered executor
                if (node.role === "input") {
                    node.outputText = inputData;
                } else if (node.role === "output") {
                    node.outputText = inputData;
                } else {
                    const exec = executors[node.nodeType];
                    if (exec) {
                        // Build per-node variable context: include env vars, inputs array, and input alias
                        const varsForNode = { ...variables } as {
                            [key: string]: any;
                            inputs?: string[];
                            input?: string;
                        };
                        const incoming = edges.filter((e) => e.to === node);
                        // Always populate inputs array
                        varsForNode.inputs = incoming.map(
                            (e) => nodeOutputs.get(e.from) || "",
                        );
                        // Alias the first input for convenience
                        varsForNode.input = varsForNode.inputs[0] || "";
                        console.log(
                            `Executing ${node.nodeType} node "${node.name}"`,
                            varsForNode,
                        );
                        try {
                            outputData = await exec(node, inputData, {
                                envPrefix,
                                variables: varsForNode,
                                apiKey: node.apiKey
                            });
                        } catch (err) {
                            console.error(
                                `Error executing ${node.nodeType} node "${node.name}":`,
                                err
                            );
                            outputData = err instanceof Error ? err.message : String(err);
                        }
                        node.outputText = outputData;
                    } else {
                        console.warn(
                            `No executor found for nodeType "${node.nodeType}"`,
                        );
                        node.outputText = inputData;
                    }
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
        currentNode = null;
        // Clear highlights
        scene.forEach((s) => (s.highlight = false));
        // Select the output node to show the final result
        outputNode = scene.find(
            (s): s is CircleNode => s.type === "circle" && s.role === "output",
        );
        if (outputNode) {
            scene.forEach((s) => (s.selected = false));
            outputNode.selected = true;
        }
        scene = [...scene];
    }

    function stopPipeline() {
        abort = true;
        isRunning = false;
    }

    function newScene() {
        scene = [
            // Default input node
            {
                id: generateId(),
                type: "circle",
                role: "input",
                nodeType: "input",
                center: [-0.9, 0],
                radius: 0.1,
                color: ioColor,
                selected: false,
                inputText: "",
                envVars: [],
                name: "Input",
                highlight: false,
            },
            // Default output node
            {
                id: generateId(),
                type: "circle",
                role: "output",
                nodeType: "output",
                center: [0.9, 0],
                radius: 0.1,
                color: ioColor,
                selected: false,
                outputText: "",
                name: "Output",
                highlight: false,
            },
        ];
        sceneName = "Untitled Flow";
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
        // Prompt for a YAML file to import
        const file = await open({
            multiple: false,
            directory: false,
            filters: [{ name: "Flow Scene", extensions: ["yaml", "yml"] }],
        });
        if (!file) {
            return;
        }
        // Parse YAML content
        const sceneYaml = await readTextFile(file);
        const raw = parseFromYaml(sceneYaml);
        if (!raw || typeof raw !== "object" || raw.scene == null) {
            alert("Invalid scene format. Please check the YAML file.");
            return;
        }
        // Deserialize using built-in parser
        const { meta, scene: loaded } = parseSavedScene(raw);
        // Apply metadata fields
        sceneName = meta.name;
        sceneDescription = meta.description;
        sceneInstructions = meta.instructions;
        sceneRequirements = meta.requirements;
        sceneCompatibility = meta.compatibility;
        // Ensure required I/O nodes and trigger reactivity
        scene = ensureInputOutputNodes(loaded);
        scene = [...scene];
        // Recompute playability
        hasPath = getPipelineNodes().length > 0;
        // Show the imported scene
        editingScene = true;
    }

    // Prompt user to choose file path for exporting scene (dialog only)
    async function exportScene() {
        // Prompt user to choose file path for exporting scene
        const path = await save({
            filters: [{ name: "Flow Scene", extensions: ["yaml", "yml"] }],
        });

        // Path is null if dialog was cancelled
        if (path) {
            console.log("Selected export path:", path);
        } else {
            console.log("Save dialog was cancelled");
            return;
        }

        // Serialize current scene and dump to YAML
        const serialized = serializeScene(scene, {
            name: sceneName,
            description: sceneDescription,
            instructions: sceneInstructions,
            requirements: sceneRequirements,
            compatibility: sceneCompatibility,
        });
        const yaml = parseToYaml(serialized);
        if (!yaml) {
            alert("Failed to serialize scene.");
            return;
        }
        const fileHandle = await create(path);
        await fileHandle.write(new TextEncoder().encode(yaml));
        await fileHandle.close();
    }

    run(() => {
        if (typeof window !== "undefined") {
            const savedObj = serializeScene(scene, {
                name: sceneName,
                description: sceneDescription,
                instructions: sceneInstructions,
                requirements: sceneRequirements,
                compatibility: sceneCompatibility,
            });
            window.localStorage.setItem("scene", JSON.stringify(savedObj));
        }
    });

    function handleSceneTitleKeydown(e) {
        if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault();
            e.target.blur();
        }
    }

    function handleSceneTitleBlur(e) {
        if (e.target.innerText.trim() === "") {
            sceneName = "Untitled Flow";
            e.target.innerText = "Untitled Flow";
        } else {
            sceneName = e.target.innerText;
        }
    }
</script>

<div class="app-wrap">
    <button
        class="scene-title"
        class:editing={editingScene}
        onclick={handleSceneTitleClick}
        onkeydown={handleSceneTitleKeydown}
        aria-label="Edit scene title"
        type="button"
    >
        {sceneName}
    </button>
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
                                disabled={isRunning}
                            >
                                Remove
                            </button>
                        </div>
                        <TextAreaField
                            placeholder="Value"
                            rows={3}
                            bind:value={env.value}
                            on:input={(_event) => (scene = [...scene])}
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
                    disabled={isRunning}
                >
                    Add Variable
                </button>
            {:else if inspectorNode.role === "output"}
                <h3>Output</h3>
                <span>Name: {inspectorNode.name}</span>
                <label for="inspector-output">Output:</label>
                <button class="copy-button" onclick={copyOutput}>Copy</button>
                <TextAreaField
                    rows={20}
                    bind:value={inspectorNode.outputText}
                />
            {:else}
                <!-- Dynamic custom node editor based on nodeType -->
                <label for="node-type">Type:</label>
                <SelectField
                    bind:value={inspectorNode.nodeType}
                    options={typeOptions}
                    disabled={isRunning}
                />
                <!-- Available variables: previous node output ('input') and input env vars -->
                <span>Available Variables:</span>
                {#if availableVariables && availableVariables.length > 0}
                    <div class="available-variables">
                        {#each availableVariables as varName}
                            <button
                                class="variable-chip"
                                onmouseenter={() =>
                                    handleVarHover(varName, true)}
                                onmouseleave={() =>
                                    handleVarHover(varName, false)}
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
                    <!-- Fallback editor for unknown nodeType -->
                    <p>
                        No editor available for type "{inspectorNode.nodeType}"
                    </p>
                {/if}
            {/if}
        {:else}
            <!-- Scene view when nothing selected -->
            <h3>Scene</h3>
            <span>Title:</span>
            <div class="scene-static" style="margin-bottom: 12px;">
                {sceneName}
            </div>
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
    <!-- Resizer between info panel and canvas -->
    <div
        class="resizer"
        onmousedown={handlePanelResizeMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize info panel"
        tabindex="0"
    ></div>

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
        <button onclick={playPipeline} disabled={isRunning || !hasPath}>
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
        <button onclick={stopPipeline} disabled={!isRunning}>
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
        <button class="secondary" onclick={newScene}>New</button>
        <button class="secondary" onclick={importScene}>Import</button>
        <button class="secondary" onclick={exportScene}>Export</button>
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
    /* Less salient buttons for new/import/export */
    .controls button.secondary {
        background-color: #000;
        color: #fff;
    }
    .controls button.secondary:hover:not(:disabled) {
        background-color: #222;
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
    /* Layout for message rows */
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
    .scene-title.editing {
        outline: 2px solid var(--primary);
        border-radius: var(--border-radius);
    }
    /* Available variables list styling */
    .info-panel .available-variables {
        list-style: none;
        padding: 0;
        margin: 0 0 14px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .info-panel .available-variables li {
        background: #e0e0e0;
        padding: 6px 12px;
        transition: background-color 0.2s;
        border-radius: var(--border-radius);
        font-size: 0.85em;
    }
    .info-panel .available-variables li:hover {
        background: #d5d5d5;
        cursor: pointer;
    }
    /* Button styling for variable chips */
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

<script>
    import reglLib from "regl";
    import { onMount } from "svelte";

    let canvas;
    let scene = [];

    function addCircle() {
        scene.push({
            type: "circle",
            center: [Math.random() * 1.8 - 0.9, Math.random() * 1.8 - 0.9],
            radius: 0.1,
            color: [Math.random(), Math.random(), Math.random(), 1.0],
            selected: false
        });
    }

    onMount(() => {
        // Set canvas size and pixel ratio for crisp rendering
        const resizeCanvas = () => {
            canvas.width = window.innerWidth * window.devicePixelRatio;
            canvas.height = window.innerHeight * window.devicePixelRatio;
            canvas.style.width = window.innerWidth + 'px';
            canvas.style.height = window.innerHeight + 'px';
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const regl = reglLib({
            canvas,
            pixelRatio: window.devicePixelRatio
        });
        // Pan and zoom state
        let viewScale = 1;
        let viewOffset = [0, 0];
        // Smooth zoom target values
        let viewScaleTarget = viewScale;
        let viewOffsetTarget = [...viewOffset];
        // Zoom smoothing and sensitivity
        const SMOOTHING = 0.2;            // increased for snappier transitions
        const ZOOM_BASE = 1.005;          // zoom sensitivity base per wheel delta
        let isPanning = false;
        let panStart = [0, 0];
        let offsetStart = [0, 0];
        // Quad covering unit circle area for fragment discarding
        const quadPositions = [
            [-1, -1], [1, -1], [1, 1],
            [-1, -1], [1, 1], [-1, 1]
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
                aspect: ctx => ctx.viewportHeight / ctx.viewportWidth,
                center: regl.prop('center'),
                radius: regl.prop('radius'),
                color: regl.prop('color')
                ,viewScale: () => viewScale
                ,viewOffset: () => viewOffset
            },
            count: 6,
            primitive: 'triangles'
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
            attributes: { position: regl.prop('positions') },
            uniforms: {
                color: regl.prop('color'),
                viewScale: () => viewScale,
                viewOffset: () => viewOffset
            },
            // number of vertices for each line segment (2 points)
            count: 2,
            primitive: 'lines'
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
            attributes: { position: regl.prop('positions') },
            uniforms: {
                color: regl.prop('color'),
                viewScale: () => viewScale,
                viewOffset: () => viewOffset
            },
            // number of vertices for each triangle (3 points)
            count: 3,
            primitive: 'triangles'
        });
        // Drag and drop support for circles
        let dragging = null;
        let dragOffset = [0, 0];
        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const rect = canvas.getBoundingClientRect();
            // Pointer in NDC
            const ndcX = (e.clientX - rect.left) / rect.width * 2 - 1;
            const ndcY = 1 - (e.clientY - rect.top) / rect.height * 2;
            // Convert to world coordinates
            const worldX = (ndcX - viewOffset[0]) / viewScale;
            const worldY = (ndcY - viewOffset[1]) / viewScale;
            let hitShape = null;
            let hitDx = 0, hitDy = 0;
            for (let i = scene.length - 1; i >= 0; i--) {
                const shape = scene[i];
                if (shape.type !== 'circle') continue;
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
                scene.forEach(s => { if (s.type === 'edge') s.selected = false; });
                const prevSelected = scene.find(s => s.type === 'circle' && s.selected);
                if (prevSelected && prevSelected !== hitShape) {
                    // Remove any existing edge between these two circles
                    for (let i = scene.length - 1; i >= 0; i--) {
                        const s = scene[i];
                        if (s.type === 'edge' &&
                            ((s.from === prevSelected && s.to === hitShape) || (s.from === hitShape && s.to === prevSelected))) {
                            scene.splice(i, 1);
                        }
                    }
                    // Connect the previously selected circle to the clicked circle
                    scene.push({
                        type: 'edge',
                        from: prevSelected,
                        to: hitShape,
                        color: [1, 1, 1, 1],
                        selected: false
                    });
                    // Unselect all circles
                    scene.forEach(s => {
                        if (s.type === 'circle') s.selected = false;
                    });
                    // Cancel any dragging state
                    dragging = null;
                    return;
                }
                // No connection: begin dragging/selecting the clicked circle
                dragging = hitShape;
                dragOffset = [hitDx, hitDy];
                // Select only this circle
                scene.forEach(s => {
                    if (s.type === 'circle') s.selected = false;
                });
                dragging.selected = true;
            } else {
                // Try selecting an edge if clicked near it
                const EDGE_TOLERANCE = 0.03;
                let hitEdge = null;
                for (let i = scene.length - 1; i >= 0; i--) {
                    const s = scene[i];
                    if (s.type !== 'edge') continue;
                    const x1 = s.from.center[0], y1 = s.from.center[1];
                    const x2 = s.to.center[0],   y2 = s.to.center[1];
                    const dx = x2 - x1, dy = y2 - y1;
                    const len2 = dx * dx + dy * dy;
                    let t = ((worldX - x1) * dx + (worldY - y1) * dy) / len2;
                    t = Math.max(0, Math.min(1, t));
                    const projX = x1 + t * dx, projY = y1 + t * dy;
                    const dist2 = (worldX - projX) * (worldX - projX) + (worldY - projY) * (worldY - projY);
                    if (dist2 <= EDGE_TOLERANCE * EDGE_TOLERANCE) {
                        hitEdge = s;
                        break;
                    }
                }
                if (hitEdge) {
                    // Deselect all circles and edges
                    scene.forEach(s => { if (s.type === 'circle' || s.type === 'edge') s.selected = false; });
                    hitEdge.selected = true;
                    // Cancel dragging or panning
                    dragging = null;
                    isPanning = false;
                    return;
                }
                // No shape hit: deselect everything and start panning
                scene.forEach(s => { if (s.type === 'circle' || s.type === 'edge') s.selected = false; });
                isPanning = true;
                panStart = [e.clientX, e.clientY];
                viewOffsetTarget = [...viewOffset];
                offsetStart = [...viewOffsetTarget];
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (dragging) {
                const rect = canvas.getBoundingClientRect();
                // Pointer in NDC
                const ndcX = (e.clientX - rect.left) / rect.width * 2 - 1;
                const ndcY = 1 - (e.clientY - rect.top) / rect.height * 2;
                // Convert to world coordinates
                const x = (ndcX - viewOffset[0]) / viewScale;
                const y = (ndcY - viewOffset[1]) / viewScale;
                dragging.center[0] = x - dragOffset[0];
                dragging.center[1] = y - dragOffset[1];
            }
        });
        window.addEventListener('mouseup', () => {
            dragging = null;
        });
        // Pan and zoom event handlers
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width * 2 - 1;
            const py = 1 - (e.clientY - rect.top) / rect.height * 2;
            const factor = Math.pow(ZOOM_BASE, -e.deltaY);
            viewScaleTarget *= factor;
            viewOffsetTarget[0] = px - (px - viewOffsetTarget[0]) * factor;
            viewOffsetTarget[1] = py - (py - viewOffsetTarget[1]) * factor;
        });
        canvas.addEventListener('mousedown', e => {
            if (e.button === 2) {
                isPanning = true;
                panStart = [e.clientX, e.clientY];
                viewOffsetTarget = [...viewOffset];
                offsetStart = [...viewOffsetTarget];
            }
        });
        window.addEventListener('mousemove', e => {
            if (isPanning) {
                const rect = canvas.getBoundingClientRect();
                const dx = e.clientX - panStart[0];
                const dy = e.clientY - panStart[1];
                const ndcX = dx / rect.width * 2;
                const ndcY = -dy / rect.height * 2;
                viewOffsetTarget[0] = offsetStart[0] + ndcX;
                viewOffsetTarget[1] = offsetStart[1] + ndcY;
                viewOffset[0] = viewOffsetTarget[0];
                viewOffset[1] = viewOffsetTarget[1];
            }
        });
        window.addEventListener('mouseup', e => {
            // End panning on right or left mouse release
            if (e.button === 2 || e.button === 0) {
                isPanning = false;
            }
        });
        // Delete selected edge on Backspace
        window.addEventListener('keydown', e => {
            if (e.key === 'Backspace') {
                e.preventDefault();
                const idx = scene.findIndex(s => s.type === 'edge' && s.selected);
                if (idx !== -1) {
                    scene.splice(idx, 1);
                }
            }
        });
        regl.frame(() => {
            viewScale += (viewScaleTarget - viewScale) * SMOOTHING;
            viewOffset[0] += (viewOffsetTarget[0] - viewOffset[0]) * SMOOTHING;
            viewOffset[1] += (viewOffsetTarget[1] - viewOffset[1]) * SMOOTHING;

            regl.clear({ color: [0, 0, 0, 1], depth: 1 });
            // Draw edges with arrow heads
            scene.forEach((shape) => {
                if (shape.type === 'edge') {
                    const p1 = shape.from.center;
                    const p2 = shape.to.center;
                    // Highlight if selected
                    const edgeColor = shape.selected ? [1, 1, 0, 1] : shape.color;
                    // Draw line between circle centers
                    drawLine({ positions: [p1, p2], color: edgeColor });
                    // Draw arrow head at end
                    const dx = p2[0] - p1[0];
                    const dy = p2[1] - p1[1];
                    const len = Math.sqrt(dx * dx + dy * dy);
                    if (len > 0) {
                        const ux = dx / len;
                        const uy = dy / len;
                        const arrowLength = 0.05;
                        const arrowWidth = 0.02;
                        const baseX = p2[0] - ux * arrowLength;
                        const baseY = p2[1] - uy * arrowLength;
                        const px = -uy;
                        const py = ux;
                        const leftX = baseX + px * arrowWidth;
                        const leftY = baseY + py * arrowWidth;
                        const rightX = baseX - px * arrowWidth;
                        const rightY = baseY - py * arrowWidth;
                        drawTriangle({
                            positions: [[p2[0], p2[1]], [leftX, leftY], [rightX, rightY]],
                            color: edgeColor
                        });
                    }
                }
            });
            // Draw circles on top of edges
            scene.forEach((shape) => {
                if (shape.type === 'circle') {
                    drawCircle({
                        center: shape.center,
                        radius: shape.radius,
                        color: shape.selected ? [1, 1, 0, 1] : shape.color
                    });
                }
            });
        });
    });
</script>

<canvas bind:this={canvas}></canvas>
<button on:click={addCircle}>Add Circle</button>

<style>
    html,
    body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
    }
    canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
    button {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 1;
    }
</style>

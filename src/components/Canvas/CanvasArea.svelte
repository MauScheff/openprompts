<script lang="ts">
  import reglLib from "regl";
  import { onMount } from "svelte";
  import type { CircleNode, SceneShape } from "../../lib/scene";
  import { addEdge, drawEdges, makeEdgeCommands } from "../Edge/Edge";
  import { addCircle, makeDrawCircle } from "../Node/Node";
  import Node from "../Node/Node.svelte";
  export let scene: SceneShape[] = [];
  export let viewOffset: [number, number] = [0, 0];
  export let editingScene: boolean = false;
  export let canvas: HTMLCanvasElement | null = null;
  export let viewScale: number = 1;

  const defaultNodeColor = [0.85, 0.85, 0.85, 1];
  const selectedColor = [0.38, 0.93, 0.67, 1];
  const highlightColor = [1, 0.85, 0.38, 1];

  let drawCircle: any = null;

  onMount(() => {
    const resizeCanvas = () => {
      if (!canvas) return;
      const width = canvas.clientWidth * window.devicePixelRatio;
      const height = canvas.clientHeight * window.devicePixelRatio;
      canvas.width = width;
      canvas.height = height;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const regl = reglLib({ canvas, pixelRatio: window.devicePixelRatio });
    let viewScaleTarget = viewScale;
    let viewOffsetTarget = [...viewOffset];
    const SMOOTHING = 0.2;
    const ZOOM_BASE = 1.005;
    let isPanning = false;
    let panStart = [0, 0];
    let offsetStart = [0, 0];

    const { drawLine, drawTriangle } = makeEdgeCommands(
      regl,
      () => viewScale,
      () => [viewOffset[0], viewOffset[1]],
    );
    drawCircle = makeDrawCircle(
      regl,
      () => viewScale,
      () => [viewOffset[0], viewOffset[1]],
    );

    let dragging: CircleNode | null = null;
    let dragOffset = [0, 0];
    canvas.addEventListener("mousedown", (e) => {
      editingScene = false;
      if (e.button !== 0) return;
      scene.forEach((s) => (s.highlight = false));
      scene = [...scene];
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = 1 - ((e.clientY - rect.top) / rect.height) * 2;
      const worldX = (ndcX - viewOffset[0]) / viewScale;
      const worldY = (ndcY - viewOffset[1]) / viewScale;
      let hitShape: CircleNode | null = null;
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
        scene.forEach((s) => {
          if (s.type === "edge") s.selected = false;
        });
        const prevSelected = scene.find(
          (s) => s.type === "circle" && s.selected,
        ) as CircleNode | undefined;
        if (
          prevSelected &&
          prevSelected !== hitShape &&
          prevSelected.role !== "output"
        ) {
          scene = addEdge(scene, prevSelected, hitShape);
          scene.forEach((s) => {
            if (s.type === "circle") s.selected = false;
          });
          dragging = null;
          return;
        }
        dragging = hitShape;
        dragOffset = [hitDx, hitDy];
        scene.forEach((s) => {
          if (s.type === "circle") s.selected = false;
        });
        dragging.selected = true;
        scene = [...scene];
      } else {
        const EDGE_TOLERANCE = 0.03;
        let hitEdge: any = null;
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
          scene.forEach((s) => {
            if (s.type === "circle" || s.type === "edge") s.selected = false;
          });
          hitEdge.selected = true;
          dragging = null;
          isPanning = false;
          scene = [...scene];
          return;
        }
        scene.forEach((s) => {
          if (s.type === "circle" || s.type === "edge") s.selected = false;
        });
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
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = 1 - ((e.clientY - rect.top) / rect.height) * 2;
        const x = (ndcX - viewOffset[0]) / viewScale;
        const y = (ndcY - viewOffset[1]) / viewScale;
        dragging.center[0] = x - dragOffset[0];
        dragging.center[1] = y - dragOffset[1];
        scene = [...scene];
      }
    });

    window.addEventListener("mouseup", () => {
      dragging = null;
    });

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
      if (e.button === 2 || e.button === 0) {
        isPanning = false;
      }
    });
    canvas.addEventListener("dblclick", (e) => {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = 1 - ((e.clientY - rect.top) / rect.height) * 2;
      const worldX = (ndcX - viewOffset[0]) / viewScale;
      const worldY = (ndcY - viewOffset[1]) / viewScale;
      scene = addCircle(scene, worldX, worldY, defaultNodeColor);
    });

    window.addEventListener("keydown", (e) => {
      if (e.key !== "Backspace") return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      const circleIdx = scene.findIndex(
        (s) => s.type === "circle" && s.selected,
      );
      if (circleIdx !== -1) {
        const circle = scene[circleIdx] as CircleNode;
        if (circle.role === "input" || circle.role === "output") {
          return;
        }
        scene.splice(circleIdx, 1);
        for (let i = scene.length - 1; i >= 0; i--) {
          const s = scene[i];
          if (s.type === "edge" && (s.from === circle || s.to === circle)) {
            scene.splice(i, 1);
          }
        }
        scene = [...scene];
        return;
      }
      const edgeIdx = scene.findIndex((s) => s.type === "edge" && s.selected);
      if (edgeIdx !== -1) {
        scene.splice(edgeIdx, 1);
        scene = [...scene];
      }
    });

    regl.frame(() => {
      if (!canvas) return;
      viewScale += (viewScaleTarget - viewScale) * SMOOTHING;
      viewOffset[0] += (viewOffsetTarget[0] - viewOffset[0]) * SMOOTHING;
      viewOffset[1] += (viewOffsetTarget[1] - viewOffset[1]) * SMOOTHING;

      regl.clear({ color: [0.18, 0.18, 0.18, 1], depth: 1 });
      drawEdges(
        scene,
        drawLine,
        drawTriangle,
        viewScale,
        viewOffset,
        selectedColor,
        highlightColor,
        canvas!,
      );
      scene.forEach((shape) => {
        if (shape.type === "circle") {
          if (shape.selected) {
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
            drawCircle({
              center: shape.center,
              radius: shape.radius,
              color: highlightColor,
            });
          } else {
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
</script>

<div class="canvas-container">
  <canvas bind:this={canvas}></canvas>
  {#each scene.filter((s) => s.type === "circle") as node (node.id)}
    <Node {node} {viewScale} {viewOffset} {canvas} />
  {/each}
</div>

<style>
  .canvas-container {
    flex: 1;
    position: relative;
  }
  canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }
</style>

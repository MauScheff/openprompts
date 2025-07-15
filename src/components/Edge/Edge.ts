import type { CircleNode, Edge, SceneShape } from '../../lib/scene';

/**
 * Creates or toggles an edge between two circle nodes.
 * Returns the updated scene array.
 */
export function addEdge(
  scene: SceneShape[],
  from: CircleNode,
  to: CircleNode
): SceneShape[] {
  // Clone scene to trigger reactivity
  const newScene = [...scene];
  // Remove any existing edge between these two nodes
  for (let i = newScene.length - 1; i >= 0; i--) {
    const s = newScene[i];
    if (
      s.type === 'edge' &&
      ((s.from === from && s.to === to) || (s.from === to && s.to === from))
    ) {
      newScene.splice(i, 1);
    }
  }
  // Add the new edge
  const newEdge: Edge = {
    type: 'edge',
    from,
    to,
    color: [1, 1, 1, 1],
    selected: false,
  };
  newScene.push(newEdge);
  return newScene;
}

/**
 * Draws all edges (with arrowheads) given the WebGL drawing commands.
 */
export function drawEdges(
  scene: SceneShape[],
  drawLine: any,
  drawTriangle: any,
  viewScale: number,
  viewOffset: [number, number],
  selectedColor: number[],
  highlightColor: number[],
  canvas: HTMLCanvasElement
): void {
  scene.forEach((shape) => {
    if (shape.type === 'edge') {
      const p1 = shape.from.center;
      const p2 = shape.to.center;
      const edgeColor = shape.selected
        ? selectedColor
        : shape.highlight
        ? highlightColor
        : shape.color;
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len <= 0) return;
      const ux = dx / len;
      const uy = dy / len;
      const aspect = canvas.clientHeight / canvas.clientWidth;
      const r1 = shape.from.radius;
      const rX1 = r1 * aspect;
      const rY1 = r1;
      const t0 = (rX1 * rY1) / Math.sqrt(ux * ux * rY1 * rY1 + uy * uy * rX1 * rX1);
      const start: [number, number] = [p1[0] + ux * t0, p1[1] + uy * t0];
      const r2 = shape.to.radius;
      const rX2 = r2 * aspect;
      const rY2 = r2;
      const t1 = (rX2 * rY2) / Math.sqrt(ux * ux * rY2 * rY2 + uy * uy * rX2 * rX2);
      const end: [number, number] = [p2[0] - ux * t1, p2[1] - uy * t1];
      drawLine({ positions: [start, end], color: edgeColor });
      const arrowLen = r2 * 0.4;
      const arrowWid = r2 * 0.15;
      const baseX = end[0] - ux * arrowLen;
      const baseY = end[1] - uy * arrowLen;
      const px = -uy;
      const py = ux;
      const left: [number, number] = [baseX + px * arrowWid, baseY + py * arrowWid];
      const right: [number, number] = [baseX - px * arrowWid, baseY - py * arrowWid];
      drawTriangle({ positions: [end, left, right], color: edgeColor });
    }
  });
}

/**
 * Constructs regl drawLine and drawTriangle commands for rendering edges.
 * @param regl - the regl instance
 * @param getViewScale - function returning current viewScale
 * @param getViewOffset - function returning current viewOffset
 */
export function makeEdgeCommands(
  regl: any,
  getViewScale: () => number,
  getViewOffset: () => [number, number]
) {
  const drawLine = regl({
    frag: `
      precision mediump float;
      uniform vec4 color;
      void main() { gl_FragColor = color; }
    `,
    vert: `
      precision mediump float;
      attribute vec2 position;
      uniform float viewScale;
      uniform vec2 viewOffset;
      void main() {
        vec2 pos = position * viewScale + viewOffset;
        gl_Position = vec4(pos, 0, 1);
      }
    `,
    attributes: {
      position: regl.prop('positions'),
    },
    uniforms: {
      color: regl.prop('color'),
      viewScale: getViewScale,
      viewOffset: getViewOffset,
    },
    count: 2,
    primitive: 'lines',
  });

  const drawTriangle = regl({
    frag: `
      precision mediump float;
      uniform vec4 color;
      void main() { gl_FragColor = color; }
    `,
    vert: `
      precision mediump float;
      attribute vec2 position;
      uniform float viewScale;
      uniform vec2 viewOffset;
      void main() {
        vec2 pos = position * viewScale + viewOffset;
        gl_Position = vec4(pos, 0, 1);
      }
    `,
    attributes: {
      position: regl.prop('positions'),
    },
    uniforms: {
      color: regl.prop('color'),
      viewScale: getViewScale,
      viewOffset: getViewOffset,
    },
    count: 3,
    primitive: 'triangles',
  });

  return { drawLine, drawTriangle };
}

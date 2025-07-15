import type { CircleNode, Edge, SceneShape } from '../../lib/scene';
import { generateId } from '../../lib/scene';

/**
 * Add a new circle node (and connecting edge if a node was already selected).
 * Returns the updated scene array.
 */
export function addCircle(
  scene: SceneShape[],
  x: number,
  y: number,
  defaultNodeColor: number[]
): SceneShape[] {
  const prevSelected = scene.find(
    (s): s is CircleNode => s.type === 'circle' && s.selected
  );
  const newNode: CircleNode = {
    id: generateId(),
    type: 'circle',
    role: 'default',
    nodeType: 'newNode',
    name: `Node ${scene.filter((s): s is CircleNode => s.type === 'circle').length - 1}`,
    center: [x, y],
    radius: 0.1,
    color: defaultNodeColor,
    selected: true,
    highlight: false,
    outputText: '',
  };
  if (prevSelected) {
    prevSelected.selected = false;
  }
  const newScene = [...scene, newNode];
  if (prevSelected) {
    const newEdge: Edge = {
      type: 'edge',
      from: prevSelected,
      to: newNode,
      color: [1, 1, 1, 1],
      selected: false,
    };
    newScene.push(newEdge);
  }
  return newScene;
}

/**
 * Constructs a regl drawCircle command for rendering node circles.
 * @param regl - the regl instance
 * @param getViewScale - function returning current viewScale
 * @param getViewOffset - function returning current viewOffset
 */
export function makeDrawCircle(
  regl: any,
  getViewScale: () => number,
  getViewOffset: () => [number, number]
) {
  const quadPositions: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, -1],
    [1, 1],
    [-1, 1],
  ];
  const quadBuffer = regl.buffer(quadPositions);
  return regl({
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
        vec2 transformed = pos * viewScale + viewOffset;
        gl_Position = vec4(transformed, 0, 1);
        fragColor = color;
      }`,
    attributes: { position: quadBuffer },
    uniforms: {
      aspect: (ctx: any) => ctx.viewportHeight / ctx.viewportWidth,
      center: regl.prop('center'),
      radius: regl.prop('radius'),
      color: regl.prop('color'),
      viewScale: getViewScale,
      viewOffset: getViewOffset,
    },
    count: 6,
    primitive: 'triangles',
  });
}

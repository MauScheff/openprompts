// Core scene types and utilities (functional core)
export interface EnvVar {
    key: string;
    value: string;
}

export interface CircleNode {
    id: string;
    type: "circle";
    role: "input" | "output" | "default";
    nodeType: string;
    name: string;
    center: [number, number];
    radius: number;
    color: number[];
    selected: boolean;
    highlight: boolean;
    inputText?: string;
    outputText?: string;
    envVars?: EnvVar[];
}

export interface Edge {
    type: "edge";
    from: CircleNode;
    to: CircleNode;
    color: number[];
    selected: boolean;
    highlight?: boolean;
}

export type SceneShape = CircleNode | Edge;

/**
 * Generate a unique ID for identifying nodes.
 */
export function generateId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
// Scene metadata for persistence
export interface SceneMeta {
    name: string;
    description: string;
    instructions: string;
    requirements: string;
    compatibility: string;
}

// Default input/output node color
export const ioColor: number[] = [0.38, 0.67, 0.93, 1];

/**
 * Create a new default scene with only input and output nodes.
 */
export function getDefaultScene(): SceneShape[] {
    const inputNode: CircleNode = {
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
    };
    const outputNode: CircleNode = {
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
    };
    return [inputNode, outputNode];
}

/**
 * Ensure that the scene array contains at least one input and one output node.
 */
export function ensureInputOutputNodes(scene: SceneShape[]): SceneShape[] {
    let result = [...scene];
    const hasInput = result.some((s): s is CircleNode => s.type === "circle" && s.role === "input");
    const hasOutput = result.some((s): s is CircleNode => s.type === "circle" && s.role === "output");
    if (!hasInput) {
        const [inputNode] = getDefaultScene();
        result.push({ ...inputNode, id: generateId() });
    }
    if (!hasOutput) {
        const [, outputNode] = getDefaultScene();
        result.push({ ...outputNode, id: generateId() });
    }
    return result;
}

/**
 * Parse a saved scene object (from localStorage) into metadata and SceneShape array.
 */
export function parseSavedScene(parsed: any): { meta: SceneMeta; scene: SceneShape[] } {
    const meta: SceneMeta = {
        name: parsed.name || "Untitled Flow",
        description: parsed.description || "",
        instructions: parsed.instructions || "",
        requirements: parsed.requirements || "",
        compatibility: parsed.compatibility || "",
    };
    const raw = parsed.scene;
    let scene: SceneShape[] = [];
    // Legacy flat-array format
    if (Array.isArray(raw)) {
        const sceneData = raw as SceneShape[];
        const circles = sceneData.filter((s): s is CircleNode => s.type === "circle");
        circles.forEach((s) => {
            if (s.role === "input" && s.envVars == null) s.envVars = [];
            if (!("nodeType" in s)) s.nodeType = s.role === "default" ? "newNode" : s.role;
        });
        const edgesRaw = sceneData.filter((s): s is Edge => s.type === "edge");
        const newScene: SceneShape[] = [...circles];
        edgesRaw.forEach((e) => {
            const rawFrom = e.from as CircleNode;
            const rawTo = e.to as CircleNode;
            // Try identity match (YAML alias), then by ID, then by name
            let fromNode: CircleNode | undefined = newScene.find((n): n is CircleNode => n === rawFrom);
            if (!fromNode && rawFrom.id != null) {
                fromNode = newScene.find((n): n is CircleNode => n.id === rawFrom.id);
            }
            if (!fromNode) {
                fromNode = newScene.find((n): n is CircleNode => n.name === rawFrom.name);
            }
            let toNode: CircleNode | undefined = newScene.find((n): n is CircleNode => n === rawTo);
            if (!toNode && rawTo.id != null) {
                toNode = newScene.find((n): n is CircleNode => n.id === rawTo.id);
            }
            if (!toNode) {
                toNode = newScene.find((n): n is CircleNode => n.name === rawTo.name);
            }
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
    // Indexed format with circles and edges arrays
    else if (
        raw &&
        Array.isArray((raw as any).circles) &&
        Array.isArray((raw as any).edges)
    ) {
        const circles = (raw as any).circles as CircleNode[];
        circles.forEach((s) => {
            if (s.role === "input" && s.envVars == null) s.envVars = [];
            if (!("nodeType" in s)) s.nodeType = s.role === "default" ? "newNode" : s.role;
        });
        const edgesRaw = (raw as any).edges as Array<{ from: number; to: number; color: number[]; selected: boolean; highlight?: boolean }>;
        const newScene: SceneShape[] = [...circles];
        edgesRaw.forEach((e) => {
            const fromNode = circles[e.from];
            const toNode = circles[e.to];
            if (fromNode && toNode) {
                newScene.push({ type: "edge", from: fromNode, to: toNode, color: e.color, selected: e.selected, highlight: e.highlight || false });
            }
        });
        scene = newScene;
    }
    // Other: empty scene
    else {
        scene = [];
    }
    return { meta, scene };
}

/**
 * Serialize the scene and metadata into a persistable object.
 */
export function serializeScene(
    scene: SceneShape[],
    meta: SceneMeta,
): any {
    const circles = scene.filter((s) => s.type === "circle") as CircleNode[];
    const edges = scene.filter((s) => s.type === "edge") as Edge[];
    const nodeIndexMap = new Map<CircleNode, number>(circles.map((n, i) => [n, i]));
    const serializableEdges = edges.map((e) => ({
        type: e.type,
        from: nodeIndexMap.get(e.from)!, // index of source circle
        to: nodeIndexMap.get(e.to)!,     // index of target circle
        color: e.color,
        selected: e.selected,
        highlight: e.highlight || false,
    }));
    return {
        name: meta.name,
        description: meta.description,
        instructions: meta.instructions,
        requirements: meta.requirements,
        compatibility: meta.compatibility,
        scene: { circles, edges: serializableEdges },
    };
}

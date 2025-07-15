import { open, save } from "@tauri-apps/plugin-dialog";
import { create, readTextFile } from "@tauri-apps/plugin-fs";
import { parseFromYaml, parseToYaml } from "../yaml";
import {
  ensureInputOutputNodes,
  generateId,
  getDefaultScene,
  ioColor,
  parseSavedScene,
  serializeScene,
} from "./scene";

export interface SceneMeta {
  name: string;
  description: string;
  instructions: string;
  requirements: string;
  compatibility: string;
}

/** Load scene from localStorage or fall back to default scene. */
export function loadSceneFromStorage(): { meta: SceneMeta; scene: any[] } {
  if (typeof window === "undefined") {
    const defaultScene = getDefaultScene();
    return {
      meta: {
        name: "Untitled Flow",
        description: "",
        instructions: "",
        requirements: "",
        compatibility: "",
      },
      scene: ensureInputOutputNodes(defaultScene),
    };
  }
  const saved = window.localStorage.getItem("scene");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const { meta, scene: loaded } = parseSavedScene(parsed);
      return {
        meta,
        scene: ensureInputOutputNodes(loaded),
      };
    } catch {
      // fall through to default
    }
  }
  const defaultScene = getDefaultScene();
  return {
    meta: {
      name: "Untitled Flow",
      description: "",
      instructions: "",
      requirements: "",
      compatibility: "",
    },
    scene: ensureInputOutputNodes(defaultScene),
  };
}

/** Persist scene and metadata to localStorage. */
export function saveSceneToStorage(
  meta: SceneMeta,
  scene: any[]
): void {
  if (typeof window === "undefined") return;
  const serialized = serializeScene(scene, meta);
  window.localStorage.setItem("scene", JSON.stringify(serialized));
}

/** Create a new default scene and metadata. */
export function newScene(): { meta: SceneMeta; scene: any[] } {
  const sceneShape = [
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
  return {
    meta: {
      name: "Untitled Flow",
      description: "",
      instructions: "",
      requirements: "",
      compatibility: "",
    },
    scene: sceneShape,
  };
}

/** Import a scene from a YAML file via Tauri dialog. */
export async function importScene(): Promise<
  { meta: SceneMeta; scene: any[] } | null
> {
  const file = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Flow Scene", extensions: ["yaml", "yml"] }],
  });
  if (!file) return null;
  const text = await readTextFile(file);
  const raw = parseFromYaml(text);
  if (!raw || typeof raw !== "object" || raw.scene == null) {
    throw new Error("Invalid scene format");
  }
  const { meta, scene: loaded } = parseSavedScene(raw);
  return { meta, scene: ensureInputOutputNodes(loaded) };
}

/** Export the current scene (with metadata) to a YAML file via Tauri dialog. */
export async function exportScene(
  meta: SceneMeta,
  scene: any[]
): Promise<void> {
  const path = await save({
    filters: [{ name: "Flow Scene", extensions: ["yaml", "yml"] }],
  });
  if (!path) return;
  const serialized = serializeScene(scene, meta);
  const yaml = parseToYaml(serialized);
  if (!yaml) throw new Error("Serialization failed");
  const handle = await create(path);
  await handle.write(new TextEncoder().encode(yaml));
  await handle.close();
}

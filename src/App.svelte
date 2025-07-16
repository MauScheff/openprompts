<script lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { tick } from "svelte";
import { run } from "svelte/legacy";
import type { CircleNode, Edge, SceneShape } from "./lib/scene";
import {
    exportScene as doExportScene,
    importScene as doImportScene,
    loadSceneFromStorage,
    newScene as makeNewScene,
    saveSceneToStorage,
} from "./lib/SceneManager";

import CanvasArea from "./components/Canvas/CanvasArea.svelte";
import Controls from "./components/Controls/Controls.svelte";
import InfoPanel from "./components/InfoPanel/InfoPanel.svelte";
import { executors } from "./node-executors";

let canvas = $state<HTMLCanvasElement | null>(null);
let lastFocusedEl: HTMLInputElement | HTMLTextAreaElement | null = null;
let scene = $state<SceneShape[]>([]);
let sceneName = $state("");
let sceneDescription = $state("");
let sceneInstructions = $state("");
let sceneRequirements = $state("");
let sceneCompatibility = $state("");
let editingScene = $state(false);
let sceneNameInputEl = $state<HTMLInputElement | null>(null);

async function handleSceneTitleClick() {
  editingScene = true;
  await tick();
  if (sceneNameInputEl) (sceneNameInputEl as HTMLInputElement).focus();
}

const { meta, scene: initialScene } = loadSceneFromStorage();
({
  name: sceneName,
  description: sceneDescription,
  instructions: sceneInstructions,
  requirements: sceneRequirements,
  compatibility: sceneCompatibility,
} = meta);
scene = initialScene;

let viewScale = $state(1);
let viewOffset = $state<[number, number]>([0, 0]);

// selection helpers
let selectedShape = $derived<CircleNode | undefined>(
  scene.find((s) => s.type === "circle" && (s.highlight || s.selected)) as
    | CircleNode
    | undefined,
);
run(() => {
  if (canvas) {
    const w = (canvas as HTMLCanvasElement).clientWidth;
    const h = (canvas as HTMLCanvasElement).clientHeight;
    (canvas as HTMLCanvasElement).width = w * window.devicePixelRatio;
    (canvas as HTMLCanvasElement).height = h * window.devicePixelRatio;
    selectedShape = scene.find(
      (s) => s.type === "circle" && (s.highlight || s.selected),
    ) as CircleNode | undefined;
  }
});

let isRunning = $state(false);
let abort = false;
let currentNode = $state<CircleNode | null>(null);
let inspectorNode = $derived(isRunning ? currentNode : selectedShape);
run(() => {
  if (inspectorNode) {
    editingScene = false;
  }
});

let availableVariables = $derived(
  (() => {
    if (!inspectorNode || inspectorNode.role === "input" || inspectorNode.role === "output") {
      return [] as string[];
    }
    const inEdges = scene.filter((s) => s.type === "edge" && s.to === inspectorNode);
    let vars: string[] = [];
    if (inEdges.length === 1) {
      vars.push("input");
    } else if (inEdges.length > 1) {
      for (let i = 0; i < inEdges.length; i++) vars.push(`inputs.${i}`);
    }
    const envVars = scene
      .filter((s): s is CircleNode => s.type === "circle" && s.role === "input")
      .map((s) => (s.envVars || []).map((e) => e.key))
      .reduce((acc, val) => acc.concat(val), [])
      .filter((k) => k);
    return [...vars, ...envVars];
  })(),
);

function handleVarHover(varName: string, active: boolean) {
  if (!inspectorNode) return;
  const inEdges = scene.filter((s) => s.type === "edge" && s.to === inspectorNode);
  inEdges.forEach((e) => (e.highlight = false));
  if (varName === "input") {
    inEdges.forEach((e) => (e.highlight = active));
  } else if (varName.startsWith("inputs.")) {
    const idx = parseInt(varName.split(".")[1], 10);
    if (!isNaN(idx) && inEdges[idx]) inEdges[idx].highlight = active;
  }
  scene = [...scene];
}

function handleVarClick(varName: string) {
  let activeEl = document.activeElement as HTMLElement | null;
  if (!(activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT"))) {
    activeEl = lastFocusedEl;
  }
  if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT")) {
    const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
    const start = inputEl.selectionStart ?? 0;
    const end = inputEl.selectionEnd ?? 0;
    const value = inputEl.value;
    const insertion = "{{{" + varName + "}}}";
    inputEl.value = value.slice(0, start) + insertion + value.slice(end);
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    const newPos = start + insertion.length;
    inputEl.selectionStart = inputEl.selectionEnd = newPos;
    inputEl.focus();
  }
}

function getPipelineNodes() {
  const inputNode = scene.find((s): s is CircleNode => s.type === "circle" && s.role === "input");
  const outputNode = scene.find((s): s is CircleNode => s.type === "circle" && s.role === "output");
  if (!inputNode || !outputNode) return [];
  const nodes = scene.filter((s): s is CircleNode => s.type === "circle");
  const edges = scene.filter((s): s is Edge => s.type === "edge");
  const adj = new Map(nodes.map((n) => [n, [] as CircleNode[]]));
  for (const edge of edges) {
    if (adj.has(edge.from)) adj.get(edge.from)!.push(edge.to);
  }
  const queue = [inputNode];
  const seen = new Set([inputNode]);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === outputNode) return [inputNode, outputNode];
    const successors = adj.get(curr) || [];
    for (const successor of successors) {
      if (!seen.has(successor)) {
        seen.add(successor);
        queue.push(successor);
      }
    }
  }
  return [];
}

let hasPath = $state(false);
$effect(() => {
  hasPath = getPipelineNodes().length > 0;
});

async function runCommand(stdin: string, cmd: string) {
  let result = "";
  try {
    result = await invoke("run_command", { stdin, cmd });
    console.log(`Command executed: ${cmd} with result:`, result);
  } catch (error) {
    result = `Error here: ${error}`;
  }
  return result;
}

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
  const adj = new Map(nodes.map((n) => [n, [] as CircleNode[]]));
  const inDegree = new Map(nodes.map((n) => [n, 0]));
  edges.forEach((edge) => {
    if (adj.has(edge.from)) adj.get(edge.from)!.push(edge.to);
    if (inDegree.has(edge.to)) inDegree.set(edge.to, inDegree.get(edge.to)! + 1);
  });

  isRunning = true;
  abort = false;

  const nodeOutputs = new Map<CircleNode, string>();
  const executedNodes = new Set<CircleNode>();
  let queue: CircleNode[] = [];
  for (const [node, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(node);
  }
  if (inputNode) nodeOutputs.set(inputNode, inputNode.inputText || "");

  const envVars = (inputNode.envVars || []).filter((e) => e.key && e.value);
  const shellEscape = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
  const envPrefix = envVars.length > 0 ? envVars.map((e) => `export ${e.key}=${shellEscape(e.value)}`).join("; ") + "; " : "";
  const variables = envVars.reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as any);

  while (queue.length > 0 && !abort) {
    const currentBatch = queue;
    queue = [];
    scene.forEach((s) => (s.highlight = false));
    currentBatch.forEach((node) => (node.highlight = true));
    scene = [...scene];

    const promises = currentBatch.map(async (node) => {
      if (abort) return;
      currentNode = node;
      const parentEdges = edges.filter((e) => e.to === node);
      let inputData: string;
      if (node.role === "input") {
        inputData = node.inputText || "";
      } else {
        const parentOutputs = parentEdges.map((e) => nodeOutputs.get(e.from) || "");
        inputData = parentOutputs.join("\n");
      }
      let outputData = inputData;
      if (node.role === "input") {
        node.outputText = inputData;
      } else if (node.role === "output") {
        node.outputText = inputData;
      } else {
        const exec = executors[node.nodeType];
        if (exec) {
          const varsForNode: any = { ...variables, inputs: [], input: "" };
          const incoming = edges.filter((e) => e.to === node);
          varsForNode.inputs = incoming.map((e) => nodeOutputs.get(e.from) || "");
          varsForNode.input = varsForNode.inputs[0] || "";
          try {
            outputData = await exec(node, inputData, { envPrefix, variables: varsForNode, apiKey: (node as any).apiKey });
          } catch (err) {
            console.error(`Error executing ${node.nodeType} node "${node.name}":`, err);
            outputData = err instanceof Error ? err.message : String(err);
          }
          node.outputText = outputData;
        } else {
          console.warn(`No executor found for nodeType "${node.nodeType}"`);
          node.outputText = inputData;
        }
      }
      nodeOutputs.set(node, outputData);
      executedNodes.add(node);
      const successors = adj.get(node) || [];
      for (const successor of successors) {
        const parentsOfSuccessor = edges.filter((e) => e.to === successor).map((e) => e.from);
        const allParentsDone = parentsOfSuccessor.every((p) => executedNodes.has(p));
        if (allParentsDone) queue.push(successor);
      }
      scene = [...scene];
    });

    await Promise.all(promises);
    if (!abort) await new Promise((r) => setTimeout(r, 650));
  }

  isRunning = false;
  currentNode = null;
  scene.forEach((s) => (s.highlight = false));
  outputNode = scene.find((s): s is CircleNode => s.type === "circle" && s.role === "output");
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
  const { meta, scene: next } = makeNewScene();
  sceneName = meta.name;
  sceneDescription = meta.description;
  sceneInstructions = meta.instructions;
  sceneRequirements = meta.requirements;
  sceneCompatibility = meta.compatibility;
  scene = next;
}

async function copyOutput() {
  if (!selectedShape || !selectedShape.outputText) return;
  try {
    await navigator.clipboard.writeText(selectedShape.outputText);
  } catch (err) {
    console.error("Failed to copy output:", err);
  }
}

async function importScene() {
  try {
    const result = await doImportScene();
    if (result) {
      ({ meta: { name: sceneName, description: sceneDescription, instructions: sceneInstructions, requirements: sceneRequirements, compatibility: sceneCompatibility }, scene } = result);
      hasPath = getPipelineNodes().length > 0;
      editingScene = true;
    }
  } catch (err) {
    alert(`Failed to import scene: ${err}`);
  }
}

async function exportScene() {
  try {
    await doExportScene({ name: sceneName, description: sceneDescription, instructions: sceneInstructions, requirements: sceneRequirements, compatibility: sceneCompatibility }, scene);
  } catch (err) {
    alert(`Failed to export scene: ${err}`);
  }
}

$effect(() => {
  saveSceneToStorage({ name: sceneName, description: sceneDescription, instructions: sceneInstructions, requirements: sceneRequirements, compatibility: sceneCompatibility }, scene);
});

function handleSceneTitleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === "Escape") {
    e.preventDefault();
    (e.target as HTMLElement).blur();
  }
}

function handleSceneTitleBlur(e: FocusEvent) {
  const el = e.target as HTMLElement;
  if (el.innerText.trim() === "") {
    sceneName = "Untitled Flow";
    el.innerText = "Untitled Flow";
  } else {
    sceneName = el.innerText;
  }
}
</script>

<div class="app-wrap">
  <button
    class="scene-title"
    class:editing={editingScene}
    on:click={handleSceneTitleClick}
    on:keydown={handleSceneTitleKeydown}
    aria-label="Edit scene title"
    type="button"
  >
    {sceneName}
  </button>
  <InfoPanel
    bind:editingScene
    bind:sceneName
    bind:sceneDescription
    bind:sceneInstructions
    bind:sceneRequirements
    bind:sceneCompatibility
    bind:scene={scene}
    bind:sceneNameInputEl
    {inspectorNode}
    {isRunning}
    {availableVariables}
    {handleVarHover}
    {handleVarClick}
    {copyOutput}
  />
  <CanvasArea bind:scene bind:viewScale bind:viewOffset bind:editingScene bind:canvas />
  <Controls
    {playPipeline}
    {stopPipeline}
    {newScene}
    {importScene}
    {exportScene}
    {isRunning}
    {hasPath}
  />
</div>

<style>
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
</style>

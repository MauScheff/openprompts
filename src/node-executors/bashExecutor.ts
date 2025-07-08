import { invoke } from "@tauri-apps/api/core";
import { interpolate } from "../lib/interpolate";

/**
 * Executes a bash command via Tauri backend.
 * @param {object} node - The node definition containing `command`.
 * @param {string} input - The stdin input for the command.
 * @param {object} [context] - Optional context (e.g., envPrefix).
 * @returns {Promise<string>} The command output.
 */
export async function executeBash(
  node: any,
  input: string,
  context: any = {}
): Promise<string> {
  const { envPrefix = "", variables = {} } = context;
  const commandStr = interpolate((node.command || "").trim(), input, variables);
  const cmd = envPrefix + commandStr;
  console.log(`executeBash: ${cmd}`);
  const result = await invoke("run_command", { stdin: input, cmd });
  return result as string;
}
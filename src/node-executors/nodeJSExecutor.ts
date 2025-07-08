/**
 * Executes arbitrary NodeJS code defined in the node.
 * NOTE: using `new Function`; consider sandboxing / security in production.
 * @param {object} node - The node definition containing `code`.
 * @param {string} input - The input string from upstream nodes.
 * @returns {Promise<string>} The stringified result of the code execution.
 */
import { interpolate } from "../lib/interpolate";

/**
 * Executes arbitrary NodeJS code defined in the node,
 * with simple {{{var}}} interpolation before execution.
 * @param {object} node - The node definition containing `code`.
 * @param {string} input - The input string from upstream nodes.
 * @param {object} context - Execution context, containing `variables` map.
 * @returns {Promise<string>} The stringified result of the code execution.
 */
export async function executeNodeJS(
  node: any,
  input: string,
  context: any = {}
): Promise<string> {
  try {
    const vars = context.variables || {};
    const code = interpolate(node.code || "", input, vars);
    const fn = new Function("input", code);
    const result = fn(input);
    return typeof result === "string" ? result : JSON.stringify(result);
  } catch (err: any) {
    console.error("NodeJS executor error:", err);
    return `Error: ${err.message}`;
  }
}
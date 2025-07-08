import { executeBash } from "./bashExecutor";
import { executeOpenAI } from "./openAIExecutor";
import { executeNodeJS } from "./nodeJSExecutor";

/**
 * Registry of executors keyed by nodeType.
 * Each executor(node, input, context) returns a Promise<string>.
 */
// Executor function signature
type Executor = (node: any, input: string, context?: any) => Promise<string>;

export const executors: Record<string, Executor> = {
  bash: executeBash,
  // OpenAI node executor uses full context (variables/apiKey)
  OpenAI: executeOpenAI,
  nodeJS: executeNodeJS,
  // Placeholder for new/unconfigured nodes
  newNode: async () => ""
};
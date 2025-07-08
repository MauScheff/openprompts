import OpenAI from "openai";
import { interpolate } from "../lib/interpolate";

/**
 * Executes an OpenAI chat completion using messages from the node.
 * @param {object} node - The node definition containing `model` and `messages` array.
 * @param {string} _input - Ignored; messages array drives the prompt.
 * @param {object} context - Execution context, containing `variables` and/or `apiKey`.
 * @returns {Promise<string>} The assistant's response content.
 */
export async function executeOpenAI(
  node: any,
  _input: string,
  context: any = {}
): Promise<string> {
  const { model = "gpt-3.5-turbo", messages = [] } = node;
  // Determine API key from context.apiKey (set per-node) or variables (from Input node)
  const vars = context.variables || {};
  console.log(`executeOpenAI: vars=`, vars);
  const apiKey = context.apiKey || vars.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenAI API key is missing. Please set the API Key in the OpenAI node's editor or add OPENAI_API_KEY to the Input node's variables."
    );
  }
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  // Build API messages with interpolated content
  const apiMessages = messages.map((m: any) => ({
    role: m.role,
    content: interpolate(m.content || "", _input, vars),
  }));
  console.log(`executeOpenAI: model=${model}, messages=`, apiMessages);
  const resp = await openai.chat.completions.create({ model, messages: apiMessages });
  const content = resp.choices?.[0]?.message?.content || "";
  return content;
}

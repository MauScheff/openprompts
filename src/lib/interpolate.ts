// Utility for triple-brace placeholder interpolation across executors
const pattern = /\{\{\{\s*([\w\.]+)\s*\}\}\}/g;

/**
 * Replace {{{var}}}, {{{input}}}, and {{{inputs.X}}} in a template string.
 * - {{{input}}}: replaced with the provided input string.
 * - {{{inputs}}}: joined with newlines if an array, or indexed by {{{inputs.0}}}.
 * - {{{varName}}}: replaced by variables[varName] or empty string if missing.
 * @param template The string containing placeholders.
 * @param input The single-input alias value.
 * @param variables A map of variable names to values (may include inputs array).
 * @returns The interpolated string.
 */
export function interpolate(
  template: string,
  input: string,
  variables: Record<string, any> = {}
): string {
  return template.replace(pattern, (_match, name) => {
    const parts = name.split('.');
    let value = '';
    if (parts[0] === 'input') {
      value = input;
    } else if (parts[0] === 'inputs') {
      const arr = variables.inputs;
      if (Array.isArray(arr)) {
        if (parts.length > 1) {
          const idx = parseInt(parts[1], 10);
          if (!isNaN(idx) && arr[idx] != null) {
            value = arr[idx];
          }
        } else {
          value = arr.join("\n");
        }
      }
    } else {
      const v = variables[parts[0]];
      if (v != null) {
        value = String(v);
      }
    }
    return value;
  });
}
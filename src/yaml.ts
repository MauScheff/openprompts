
import yaml from 'js-yaml';

export function parseFromYaml(yamlString: string): any {
  try {
    const doc = yaml.load(yamlString);
    return doc;
  } catch (e: unknown) {
    console.error(e);
    return null;
  }
}

export function parseToYaml(data: any): string | null {
  try {
    const doc = yaml.dump(data);
    return doc;
  } catch (e: unknown) {
    console.error(e);
    return null;
  }
}

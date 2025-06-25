
import yaml from 'js-yaml';

export function parseFromYaml(yamlString) {
  try {
    const doc = yaml.load(yamlString);
    return doc;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function parseToYaml(data) {
  try {
    const doc = yaml.dump(data);
    return doc;
  } catch (e) {
    console.error(e);
    return null;
  }
}

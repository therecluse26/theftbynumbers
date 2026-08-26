/** Reading, writing and poking at the JSON data files. */
import { readFileSync, writeFileSync } from 'node:fs';

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Two-space indent and a trailing newline, so diffs stay small and readable. */
export function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

/** Read "gold.usdPerTroyOz" out of an object. Returns undefined if absent. */
export function getPath(object, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), object);
}

/** Write "gold.usdPerTroyOz" into an object, making objects on the way down. */
export function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = object;
  for (const key of keys) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key];
  }
  node[last] = value;
}

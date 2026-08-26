/**
 * The list of data files, and where each one's schema lives.
 * Add a file here and every command below picks it up.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..', '..');

export const DATA_FILES = [
  { id: 'federal-tax', label: 'Federal tax', file: 'src/data/federal-tax.json', schema: 'schemas/federal-tax.schema.json' },
  { id: 'states', label: 'States', file: 'src/data/states.json', schema: 'schemas/states.schema.json' },
  { id: 'metals', label: 'Metals', file: 'src/data/metals.json', schema: 'schemas/metals.schema.json' },
  { id: 'basket', label: 'Everyday purchases', file: 'src/data/basket.json', schema: 'schemas/basket.schema.json' },
  { id: 'ladder', label: 'Unlock ladder', file: 'src/data/ladder.json', schema: 'schemas/ladder.schema.json' },
  { id: 'assumptions', label: 'Assumptions', file: 'src/data/assumptions.json', schema: 'schemas/assumptions.schema.json' },
];

export const SHARED_SCHEMAS = ['schemas/meta.schema.json'];

export function dataPath(entry) {
  return join(ROOT, entry.file);
}

export function schemaPath(entry) {
  return join(ROOT, entry.schema);
}

export function findDataFile(id) {
  const entry = DATA_FILES.find((f) => f.id === id);
  if (!entry) throw new Error(`Unknown data file: ${id}`);
  return entry;
}

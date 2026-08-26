#!/usr/bin/env node
/**
 * Check every data file against its schema and against the rules the schema
 * cannot state. The build runs this first, so a bad data commit cannot ship.
 *
 *   node scripts/validate-data.mjs
 */
import { DATA_FILES, dataPath } from './lib/registry.mjs';
import { readJson } from './lib/json-io.mjs';
import { validateFile } from './lib/validate.mjs';

let failed = 0;

for (const entry of DATA_FILES) {
  let errors;
  try {
    errors = validateFile(entry, readJson(dataPath(entry)));
  } catch (error) {
    errors = [`could not be read: ${error.message}`];
  }

  if (errors.length === 0) {
    console.log(`ok    ${entry.file}`);
    continue;
  }

  failed++;
  console.error(`FAIL  ${entry.file}`);
  for (const message of errors) console.error(`        ${message}`);
}

if (failed > 0) {
  console.error(`\n${failed} of ${DATA_FILES.length} data files failed.`);
  process.exit(1);
}

console.log(`\nAll ${DATA_FILES.length} data files are valid.`);

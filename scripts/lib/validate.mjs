/**
 * Schema validation, plus the rules a JSON Schema cannot express.
 * Both the validate command and the update command run this before a write.
 */
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { DATA_FILES, ROOT, SHARED_SCHEMAS, schemaPath } from './registry.mjs';
import { getPath } from './json-io.mjs';

function buildAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const relative of SHARED_SCHEMAS) {
    const schema = JSON.parse(readFileSync(join(ROOT, relative), 'utf8'));
    ajv.addSchema(schema, basename(relative));
  }
  for (const entry of DATA_FILES) {
    const schema = JSON.parse(readFileSync(schemaPath(entry), 'utf8'));
    ajv.addSchema(schema, basename(entry.schema));
  }
  return ajv;
}

const ajv = buildAjv();

/** Schema errors for one data file, as readable lines. */
export function schemaErrors(entry, data) {
  const validate = ajv.getSchema(basename(entry.schema));
  if (!validate) return [`No compiled schema for ${entry.schema}`];
  if (validate(data)) return [];
  return validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
}

/**
 * A meta.fields key names the whole file ("*"), one field ("salesTax.spendShare"),
 * or one column of a list in the file ("medianHomeValue" across states).
 */
function fieldPathExists(data, path) {
  if (path === '*') return true;
  if (getPath(data, path) !== undefined) return true;
  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value.some((item) => getPath(item, path) !== undefined)) {
      return true;
    }
  }
  return false;
}

/**
 * Rules the schema cannot state.
 * Keep every rule cheap. This runs on every build.
 */
export function semanticErrors(entry, data) {
  const errors = [];
  const duplicate = (list, what) => {
    const seen = new Set();
    for (const id of list) {
      if (seen.has(id)) errors.push(`Duplicate ${what} id: ${id}`);
      seen.add(id);
    }
  };

  if (entry.id === 'federal-tax') {
    for (const [status, table] of Object.entries(data.brackets)) {
      if (table[0].from !== 0) errors.push(`brackets.${status} must start at 0`);
      for (let i = 1; i < table.length; i++) {
        if (table[i].from <= table[i - 1].from) {
          errors.push(`brackets.${status}[${i}] is not above the band below it`);
        }
        if (table[i].rate < table[i - 1].rate) {
          errors.push(`brackets.${status}[${i}] rate falls below the band below it`);
        }
      }
    }
    for (const status of ['single', 'mfj', 'hoh']) {
      if (!data.filingStatuses.some((s) => s.id === status)) {
        errors.push(`filingStatuses is missing ${status}`);
      }
    }
  }

  if (entry.id === 'states') {
    duplicate(data.states.map((s) => s.id), 'state');
    if (!data.states[0].isNational) {
      errors.push('The first state row must be the national row (isNational: true)');
    }
    if (data.states.filter((s) => s.isNational).length !== 1) {
      errors.push('Exactly one state row may be the national row');
    }
  }

  if (entry.id === 'basket') duplicate(data.items.map((i) => i.id), 'basket item');

  if (entry.id === 'ladder') {
    duplicate(data.items.map((i) => i.id), 'ladder item');
    for (const item of data.items) {
      if (item.price && item.priceFrom) {
        errors.push(`${item.id} has both price and priceFrom; pick one`);
      }
    }
  }

  if (entry.id === 'receipt') {
    duplicate(data.items.map((i) => i.id), 'receipt item');
    duplicate(data.groups.map((g) => g.id), 'receipt group');
    const groups = new Set(data.groups.map((g) => g.id));
    for (const item of data.items) {
      if (!groups.has(item.group)) {
        errors.push(`${item.id} points at group "${item.group}", which does not exist`);
      }
    }
    // A card that renders a count must not carry a rate as well, or the two
    // numbers disagree and nobody can tell which one the card used.
    for (const item of data.items) {
      const carried = ['annualCost', 'price', 'total'].filter(
        (key) => item[key] !== undefined,
      );
      if (item.kind !== 'computed' && carried.length > 1) {
        errors.push(`${item.id} carries ${carried.join(' and ')}; a card takes one`);
      }
    }
  }

  if (entry.id === 'charity') duplicate(data.items.map((i) => i.id), 'charity item');

  if (entry.id === 'assumptions') {
    const inv = data.investment;
    if (inv.minAnnualReturnPct > inv.maxAnnualReturnPct) {
      errors.push('investment min is above max');
    }
    if (
      inv.defaultAnnualReturnPct < inv.minAnnualReturnPct ||
      inv.defaultAnnualReturnPct > inv.maxAnnualReturnPct
    ) {
      errors.push('investment default sits outside the slider range');
    }
    const h = data.horizon;
    if (h.minYears > h.maxYears) errors.push('horizon min is above max');
    if (h.defaultYears < h.minYears || h.defaultYears > h.maxYears) {
      errors.push('horizon default sits outside the slider range');
    }
  }

  // Every provenance entry must point at a field that exists.
  for (const path of Object.keys(data.meta.fields)) {
    if (!fieldPathExists(data, path)) {
      errors.push(`meta.fields."${path}" points at a field that does not exist`);
    }
  }

  return errors;
}

export function validateFile(entry, data) {
  return [...schemaErrors(entry, data), ...semanticErrors(entry, data)];
}

/**
 * Schema validation, plus the rules a JSON Schema cannot express.
 * Both the validate command and the update command run this before a write.
 */
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { DATA_FILES, ROOT, SHARED_SCHEMAS, dataPath, findDataFile, schemaPath } from './registry.mjs';
import { getPath, readJson } from './json-io.mjs';

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

/** The one receipt group where a card may print a length of time. */
const DURATION_GROUP = 'scale';

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
    duplicate(data.groups.map((g) => g.id), 'ladder group');
    const groups = new Set(data.groups.map((g) => g.id));
    for (const item of data.items) {
      if (!groups.has(item.group)) {
        errors.push(`${item.id} points at group "${item.group}", which does not exist`);
      }
      if (item.price && item.priceFrom) {
        errors.push(`${item.id} has both price and priceFrom; pick one`);
      }
    }

    // The give is a group of this ladder, not a section of its own. No group
    // claims it and charity.json renders nowhere, silently. Two groups claim it
    // and the same rungs appear twice on the page.
    const giving = data.groups.filter((g) => g.includesCharity);
    if (giving.length !== 1) {
      errors.push(
        `exactly one group must set includesCharity, so charity.json has a home; ` +
          `${giving.length} do`,
      );
    }

    // The ladder used to price a rung from charity.life-amf. That rung and the
    // give section then printed the same figure in two places. Now that the give
    // IS a group here, the ref would put every charity price on the page twice.
    for (const item of data.items) {
      if (item.priceFrom?.ref?.startsWith('charity.')) {
        errors.push(
          `${item.id} prices from "${item.priceFrom.ref}"; charity items are ` +
            `already rungs of this ladder, so the figure would appear twice`,
        );
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

      // A duration card prints a length of time where every other card prints a
      // sum of money. That only reads as an argument in the scale group, whose
      // lede declares the unit: your whole working life against one year of
      // federal spending. Elsewhere it produced cards like "2.5 minutes of the
      // money stolen from the government every year", which a reader parses as
      // minutes of money and which means nothing. Those are `yearly` cards now.
      if (item.kind === 'duration' && item.group !== DURATION_GROUP) {
        errors.push(
          `${item.id} is a duration card in group "${item.group}"; a length of ` +
            `time only reads as an argument in "${DURATION_GROUP}", where the ` +
            `lede declares the unit. Use a yearly card and print a sum of money`,
        );
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

  if (entry.id === 'roads') {
    duplicate(data.items.map((i) => i.id), 'roads item');
    duplicate(data.groups.map((g) => g.id), 'roads group');
    const groups = new Set(data.groups.map((g) => g.id));
    for (const item of data.items) {
      if (!groups.has(item.group)) {
        errors.push(`${item.id} points at group "${item.group}", which does not exist`);
      }

      if (item.kind === 'multiple') {
        // The section claims the market does the same job for less. A card whose
        // private price is the higher one prints "0.8× more" under a heading that
        // says the opposite, and hands the argument to the other side. If a real
        // comparison comes out that way, it does not belong in this section.
        if (item.privatePrice >= item.publicPrice) {
          errors.push(
            `${item.id} has a private price of ${item.privatePrice} at or above its ` +
              `public price of ${item.publicPrice}; section six only holds units the ` +
              `market buys cheaper`,
          );
        }

        // Both tokens are the point of the note. A note that names one price
        // leaves the reader unable to check the multiple printed above it.
        for (const token of ['{public}', '{private}']) {
          if (!item.note.includes(token)) {
            errors.push(`${item.id} note does not use ${token}; state both prices`);
          }
        }

        // A comparison must earn itself before it is made. There used to be a
        // card claiming police cost 5.3x more per officer, which then conceded
        // in its own note that a guard cannot arrest anyone. The critic answers
        // "exactly, it is not the same job" and the card has lost. Writing this
        // sentence is what proves the unit was chosen well.
        if (!item.sameness || !item.sameness.trim()) {
          errors.push(
            `${item.id} has no sameness sentence; say what makes the two sides ` +
              `the same job, or pick a narrower unit where they are`,
          );
        }
      }

      if (item.kind !== 'multiple' && item.sameness) {
        errors.push(`${item.id} is a ${item.kind} card and carries sameness; drop it`);
      }

      // A record card applies no arithmetic, so a price on one is a number the
      // reader can see no way to reach. It means the card was written as one
      // kind and edited into another.
      if (item.kind !== 'multiple' && (item.publicPrice || item.privatePrice)) {
        errors.push(`${item.id} is a ${item.kind} card and carries a price; drop it`);
      }
      if (item.kind !== 'record' && item.figure) {
        errors.push(`${item.id} is a ${item.kind} card and carries a figure; drop it`);
      }
    }

    // The lede promises the reader the size of the transportation bill before it
    // asks who else could do the job. Lose the token and the section opens by
    // conceding the argument.
    if (!data.lede.includes('{transportShare}')) {
      errors.push('lede does not use {transportShare}; open with the size of the bill');
    }

    // The lede computes the transportation share from outlays.json. The card beside
    // it types the same share as a string. Two copies of one number drift the
    // moment somebody refreshes the Treasury figures, and then the section
    // opens with one percentage and repeats a different one two lines down.
    const shareCard = data.items.find((i) => i.id === 'transport-share');
    if (shareCard) {
      try {
        const outlays = readJson(dataPath(findDataFile('outlays')));
        const transport = outlays.categories.find((c) => c.id === 'transportation');
        if (!transport) {
          errors.push('outlays.json has no transportation category to agree with');
        } else {
          const computed = (transport.amount / outlays.totalOutlays) * 100;
          const typed = parseFloat(String(shareCard.figure).replace('%', ''));
          if (!Number.isFinite(typed) || Math.abs(typed - computed) > 0.01) {
            errors.push(
              `transport-share figure "${shareCard.figure}" does not match ` +
                `outlays.json, which computes ${computed.toFixed(2)}%`,
            );
          }
        }
      } catch (error) {
        errors.push(`could not check transport-share against outlays: ${error.message}`);
      }
    }
  }

  if (entry.id === 'outlays') {
    duplicate(data.categories.map((c) => c.id), 'outlay category');

    // The donut is a whole dollar split into parts. If the parts do not add up,
    // the picture lies. A tenth of a percent of drift is rounding; more is a bug.
    const sum = data.categories.reduce((run, c) => run + c.amount, 0);
    const drift = Math.abs(sum - data.totalOutlays) / data.totalOutlays;
    if (drift > 0.001) {
      errors.push(
        `categories sum to ${Math.round(sum)}, which is ${(drift * 100).toFixed(2)}% ` +
          `away from totalOutlays ${data.totalOutlays}`,
      );
    }

    // The donut and the "all federal spending" card divide the same number.
    // Let them drift and the page contradicts itself in two places at once.
    try {
      const receipt = readJson(dataPath(findDataFile('receipt')));
      const card = receipt.items.find((i) => i.id === 'federal-spending');
      if (!card) {
        errors.push('receipt.json has no federal-spending card to agree with');
      } else if (card.annualCost !== data.totalOutlays) {
        errors.push(
          `totalOutlays ${data.totalOutlays} does not match the federal-spending ` +
            `card in receipt.json, which says ${card.annualCost}`,
        );
      }
    } catch (error) {
      errors.push(`could not cross-check receipt.json: ${error.message}`);
    }
  }

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

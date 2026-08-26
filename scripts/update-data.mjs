#!/usr/bin/env node
/**
 * Refresh the JSON data files from their sources.
 *
 * The scheduled job will call this, then commit whatever changed.
 * Run it by hand the same way.
 *
 *   node scripts/update-data.mjs              refresh every fetchable field
 *   node scripts/update-data.mjs --dry-run    fetch and report, write nothing
 *   node scripts/update-data.mjs --only=gold-spot
 *   node scripts/update-data.mjs --due-only   only fields past maxAgeDays
 *   node scripts/update-data.mjs --force      accept a change a guard refused
 *   node scripts/update-data.mjs --check      report staleness, fetch nothing
 *
 * Exit code 0 means the run succeeded, whether or not anything changed.
 * Exit code 1 means an updater failed, a file failed validation, or --check
 * found a stale field.
 */
import { appendFileSync } from 'node:fs';

import { ageInDays, todayIso } from './lib/dates.mjs';
import { readJson, writeJson } from './lib/json-io.mjs';
import { DATA_FILES, dataPath, findDataFile } from './lib/registry.mjs';
import { validateFile } from './lib/validate.mjs';
import { UPDATERS, findUpdater } from './sources/index.mjs';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const options = {
  check: has('--check'),
  dryRun: has('--dry-run'),
  force: has('--force'),
  dueOnly: has('--due-only'),
  only: valueOf('only'),
  help: has('--help') || has('-h'),
};

const TODAY = todayIso();

if (options.help) {
  console.log(
    [
      'Usage: node scripts/update-data.mjs [options]',
      '',
      '  --check       Report stale fields and fetch nothing.',
      '  --dry-run     Fetch and report, but write nothing.',
      '  --only=NAME   Run one updater. Names: ' + UPDATERS.map((u) => u.name).join(', '),
      '  --due-only    Skip fields that are not past maxAgeDays yet.',
      '  --force       Accept a change an updater guard would refuse.',
    ].join('\n'),
  );
  process.exit(0);
}

/* ---------- staleness report ---------- */

function everyField() {
  const out = [];
  for (const entry of DATA_FILES) {
    const data = readJson(dataPath(entry));
    for (const [path, field] of Object.entries(data.meta.fields)) {
      out.push({
        entry,
        path,
        field,
        age: ageInDays(field.updatedAt),
        stale: ageInDays(field.updatedAt) > field.maxAgeDays,
      });
    }
  }
  return out;
}

function runCheck() {
  const fields = everyField();
  const stale = fields.filter((f) => f.stale);

  for (const f of fields) {
    const flag = f.stale ? 'STALE' : 'ok   ';
    console.log(
      `${flag} ${f.entry.id} / ${f.path}  (${f.field.updateMode})  ` +
        `${f.age}d old, limit ${f.field.maxAgeDays}d`,
    );
  }

  if (stale.length === 0) {
    console.log(`\nAll ${fields.length} fields are inside their age limit.`);
    return 0;
  }

  console.log(`\n${stale.length} of ${fields.length} fields are stale:`);
  for (const f of stale) {
    const how = f.field.updateMode === 'fetch'
      ? `run: node scripts/update-data.mjs --only=${f.field.updater}`
      : 'needs a person';
    console.log(`  ${f.entry.id} / ${f.path} — ${f.field.label}`);
    console.log(`    ${f.field.url}`);
    console.log(`    ${how}`);
  }
  return 1;
}

/* ---------- update run ---------- */

function chooseUpdaters() {
  if (options.only) {
    const one = findUpdater(options.only);
    if (!one) {
      console.error(`Unknown updater: ${options.only}`);
      console.error('Known: ' + UPDATERS.map((u) => u.name).join(', '));
      process.exit(1);
    }
    return [one];
  }
  if (!options.dueOnly) return UPDATERS;

  return UPDATERS.filter((updater) => {
    const data = readJson(dataPath(findDataFile(updater.fileId)));
    return updater.fields.some((path) => {
      const field = data.meta.fields[path];
      return field && ageInDays(field.updatedAt) > field.maxAgeDays;
    });
  });
}

async function runUpdaters() {
  const updaters = chooseUpdaters();
  if (updaters.length === 0) {
    console.log('Nothing is due. Nothing to do.');
    return { failed: 0, changed: 0, touched: 0 };
  }

  let failed = 0;
  let changed = 0;
  let touched = 0;

  for (const updater of updaters) {
    const entry = findDataFile(updater.fileId);
    const path = dataPath(entry);
    const data = readJson(path);
    const log = (message) => console.log(`  ${updater.name}: ${message}`);

    console.log(`\n${updater.name} → ${entry.file}`);
    console.log(`  ${updater.describe}`);

    let changes;
    try {
      changes = await updater.run({ data, log, force: options.force });
    } catch (error) {
      console.error(`  FAILED: ${error.message}`);
      failed++;
      continue;
    }

    // A successful run confirms the field, whether or not the value moved.
    for (const field of updater.fields) {
      if (data.meta.fields[field]) data.meta.fields[field].updatedAt = TODAY;
    }
    if (changes.length > 0) data.meta.updatedAt = TODAY;

    const errors = validateFile(entry, data);
    if (errors.length > 0) {
      console.error(`  FAILED validation, file left alone:`);
      for (const message of errors) console.error(`    ${message}`);
      failed++;
      continue;
    }

    const before = JSON.stringify(readJson(path));
    const after = JSON.stringify(data);
    if (before === after) {
      console.log('  no change');
      continue;
    }

    for (const change of changes.slice(0, 12)) {
      console.log(`  ${change.path}: ${change.from} → ${change.to}`);
    }
    if (changes.length > 12) console.log(`  …and ${changes.length - 12} more`);

    changed += changes.length;
    touched++;
    if (options.dryRun) {
      console.log('  dry run, not written');
      continue;
    }
    writeJson(path, data);
    console.log('  written');
  }

  return { failed, changed, touched };
}

/* ---------- go ---------- */

if (options.check) {
  process.exit(runCheck());
}

const result = await runUpdaters();

console.log('');
console.log(
  `${result.changed} value${result.changed === 1 ? '' : 's'} changed across ` +
    `${result.touched} file${result.touched === 1 ? '' : 's'}. ` +
    `${result.failed} updater${result.failed === 1 ? '' : 's'} failed.`,
);

const stale = everyField().filter((f) => f.stale && f.field.updateMode === 'manual');
if (stale.length > 0) {
  console.log('\nManual fields past their age limit:');
  for (const f of stale) {
    console.log(`  ${f.entry.id} / ${f.path} — ${f.field.label} (${f.age}d)`);
    console.log(`    ${f.field.url}`);
  }
}

// A scheduled job reads these to decide whether to commit.
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `changed=${result.touched > 0}\nvalues_changed=${result.changed}\n` +
      `manual_stale=${stale.length}\n`,
  );
}

process.exit(result.failed > 0 ? 1 : 0);

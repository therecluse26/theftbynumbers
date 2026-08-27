#!/usr/bin/env node
/**
 * Every link on the page, tested.
 *
 * The page argues from numbers, so every number names a source. A source that
 * 404s is worse than no source: it looks checkable and is not. This command
 * finds every URL the site can render and asks whether it still answers.
 *
 * It reads two places:
 *
 *   1. Every data file in the registry. Any `url` key anywhere in the tree
 *      counts, so it picks up `meta.fields[*].url`, `source`, `publicSource`,
 *      `privateSource` and `footnoteSource` without naming them one by one. A
 *      new kind of source block is covered the day it is added.
 *   2. Every .astro and .ts file under src. A few claims are prose in a
 *      component and carry their link inline.
 *
 * This is NOT part of `npm run build`. A government site being down for an
 * afternoon must never stop a deploy. Run it by hand, or on a schedule.
 *
 * It does not use fetchText() from lib/http.mjs. That helper retries and then
 * throws, which is right for an updater and wrong here: a link check wants the
 * status code, and retrying a 403 three times just makes the run slower.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DATA_FILES, ROOT, dataPath } from './lib/registry.mjs';
import { readJson } from './lib/json-io.mjs';

const TIMEOUT_MS = 20000;
const CONCURRENCY = 6;

/* Some publishers answer a browser and refuse a script. That is not a dead
 * link, so it is reported apart from one. */
const BLOCKED = new Set([401, 403, 405, 406, 429, 503]);

/** Every `url` in the tree, with the label beside it when there is one. */
function collectFromJson(node, where, out) {
  if (Array.isArray(node)) {
    for (const item of node) collectFromJson(item, where, out);
    return;
  }
  if (!node || typeof node !== 'object') return;

  if (typeof node.url === 'string' && node.url.startsWith('http')) {
    out.push({ url: node.url, label: node.label ?? '', where });
  }
  for (const value of Object.values(node)) collectFromJson(value, where, out);
}

/** Every .astro and .ts file under src, so inline prose links are covered too. */
function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(astro|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

function collectFromCode(out) {
  // A trailing quote, bracket or brace is not part of the URL.
  const pattern = /https?:\/\/[^\s"'`<>)}\]]+/g;
  for (const file of sourceFiles(join(ROOT, 'src'))) {
    const where = file.slice(ROOT.length + 1);
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      // A bare origin is a preconnect hint, not a citation. fonts.gstatic.com
      // answers 404 at the root and serves fonts perfectly well.
      if (!/^https?:\/\/[^/]+\/./.test(match[0])) continue;
      out.push({ url: match[0], label: '', where });
    }
  }
}

/**
 * One request. HEAD first, because most of these are PDFs and reports and the
 * body is not wanted. A server that refuses HEAD gets a GET.
 */
async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'endthetheft-link-check' },
      });
      // Plenty of hosts answer HEAD with 400, 403 or 405 and answer GET fine.
      // An unhappy HEAD is a reason to ask properly, not a verdict.
      if (method === 'HEAD' && response.status >= 400) continue;
      return { status: response.status };
    } catch (error) {
      if (method === 'GET') return { status: 0, error: error.message };
    } finally {
      clearTimeout(timer);
    }
  }
  return { status: 0, error: 'no response' };
}

/** Run the probes a few at a time. A hundred at once gets the runner rate-limited. */
async function probeAll(links) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (next < links.length) {
      const index = next++;
      const link = links[index];
      results[index] = { ...link, ...(await probe(link.url)) };
    }
  });
  await Promise.all(workers);
  return results;
}

const found = [];
for (const entry of DATA_FILES) {
  collectFromJson(readJson(dataPath(entry)), entry.file, found);
}
collectFromCode(found);

// One URL cited from three cards is one link to test. Keep every place it is
// used, so a failure names all of them.
const byUrl = new Map();
for (const link of found) {
  const seen = byUrl.get(link.url);
  if (seen) {
    if (!seen.where.includes(link.where)) seen.where.push(link.where);
    if (!seen.label && link.label) seen.label = link.label;
  } else {
    byUrl.set(link.url, { url: link.url, label: link.label, where: [link.where] });
  }
}

const links = [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
console.log(`Testing ${links.length} links from ${found.length} citations.\n`);

const results = await probeAll(links);
const ok = results.filter((r) => r.status >= 200 && r.status < 400);
const blocked = results.filter((r) => BLOCKED.has(r.status));
const dead = results.filter((r) => !ok.includes(r) && !blocked.includes(r));

for (const result of ok) console.log(`ok    ${result.status}  ${result.url}`);

if (blocked.length) {
  console.log('\nBlocked a script, but may answer a browser. Check these by hand:');
  for (const result of blocked) {
    console.log(`      ${result.status}  ${result.url}`);
    console.log(`            cited in ${result.where.join(', ')}`);
  }
}

if (dead.length) {
  console.log('\nDead:');
  for (const result of dead) {
    console.log(`      ${result.status || result.error}  ${result.url}`);
    console.log(`            cited in ${result.where.join(', ')}`);
  }
}

console.log(`\n${ok.length} ok, ${blocked.length} blocked, ${dead.length} dead.`);

// A blocked link is not a failure. A dead one is.
process.exit(dead.length ? 1 : 0);

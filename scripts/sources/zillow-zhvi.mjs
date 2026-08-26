/**
 * Median home value per state, from the Zillow Home Value Index.
 *
 * Zillow publishes a public CSV each month. The last column is the newest
 * month. The state file covers the 50 states and the District of Columbia;
 * the metro file carries the "United States" row used for the national entry.
 */
import { parseCsv } from '../lib/csv.mjs';
import { fetchText } from '../lib/http.mjs';

const BASE = 'https://files.zillowstatic.com/research/public_csvs/zhvi';
const SUFFIX = 'uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv';
const STATE_URL = process.env.ZILLOW_STATE_CSV_URL || `${BASE}/State_zhvi_${SUFFIX}`;
const NATIONAL_URL = process.env.ZILLOW_METRO_CSV_URL || `${BASE}/Metro_zhvi_${SUFFIX}`;

/** A file that arrives half-empty or wildly different must not reach the site. */
const MIN_VALUE = 10000;
const MAX_MOVE = 0.4;
const MIN_MATCHED = 45;

/** RegionName to latest value, from one ZHVI CSV. */
function latestByRegion(text) {
  const { header, rows } = parseCsv(text);
  const nameIndex = header.indexOf('RegionName');
  if (nameIndex < 0) throw new Error('ZHVI CSV has no RegionName column');

  const values = new Map();
  for (const row of rows) {
    // Walk back from the last column until a month has a number in it.
    for (let i = row.length - 1; i > nameIndex; i--) {
      const value = Number(row[i]);
      if (row[i] !== '' && Number.isFinite(value)) {
        values.set(row[nameIndex], Math.round(value));
        break;
      }
    }
  }
  return { values, latestMonth: header[header.length - 1] };
}

export default {
  name: 'zillow-zhvi',
  fileId: 'states',
  fields: ['medianHomeValue'],
  describe: 'Median home values from ' + STATE_URL,

  async run({ data, log, force }) {
    const states = latestByRegion(await fetchText(STATE_URL));
    const national = latestByRegion(await fetchText(NATIONAL_URL));
    log('latest ZHVI month: ' + states.latestMonth);

    const changes = [];
    const missing = [];
    let matched = 0;

    for (const state of data.states) {
      const source = state.isNational ? national.values : states.values;
      const next = source.get(state.name);

      if (next === undefined) {
        missing.push(state.name);
        continue;
      }
      if (next < MIN_VALUE) {
        throw new Error(`${state.name} came back as ${next}, which is too low to be real`);
      }

      matched++;
      const current = state.medianHomeValue;
      const move = Math.abs(next - current) / current;
      if (move > MAX_MOVE && !force) {
        throw new Error(
          `${state.name} moved ${(move * 100).toFixed(1)}% from ${current} to ${next}. ` +
            'Check the feed, then re-run with --force to accept it.',
        );
      }
      if (next === current) continue;

      state.medianHomeValue = next;
      changes.push({ path: `states.${state.id}.medianHomeValue`, from: current, to: next });
    }

    if (missing.length > 0) log('no ZHVI row for: ' + missing.join(', '));
    if (matched < MIN_MATCHED) {
      throw new Error(`Only ${matched} states matched a ZHVI row; expected ${MIN_MATCHED} or more`);
    }

    return changes;
  },
};

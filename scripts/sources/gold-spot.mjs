/**
 * Spot gold, US dollars per troy ounce.
 *
 * Default source: gold-api.com, which needs no key. Point GOLD_PRICE_URL and
 * GOLD_PRICE_FIELD at another feed if that one goes away.
 */
import { fetchJson } from '../lib/http.mjs';
import { getPath, setPath } from '../lib/json-io.mjs';

const URL = process.env.GOLD_PRICE_URL || 'https://api.gold-api.com/price/XAU';
const FIELD = process.env.GOLD_PRICE_FIELD || 'price';

/** A feed that returns nonsense must not reach the site. */
const MIN_PRICE = 100;
const MAX_PRICE = 100000;
const MAX_MOVE = 0.25;

export default {
  name: 'gold-spot',
  fileId: 'metals',
  fields: ['gold.usdPerTroyOz'],
  describe: 'Spot gold price from ' + URL,

  async run({ data, log, force }) {
    const payload = await fetchJson(URL);
    const raw = getPath(payload, FIELD);
    const price = Math.round(Number(raw) * 100) / 100;

    if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
      throw new Error(`Gold price out of range: ${JSON.stringify(raw)}`);
    }

    const current = data.gold.usdPerTroyOz;
    const move = Math.abs(price - current) / current;
    if (move > MAX_MOVE && !force) {
      throw new Error(
        `Gold moved ${(move * 100).toFixed(1)}% from ${current} to ${price}. ` +
          'Check the feed, then re-run with --force to accept it.',
      );
    }
    if (price === current) {
      log('gold unchanged at ' + price);
      return [];
    }

    setPath(data, 'gold.usdPerTroyOz', price);
    return [{ path: 'gold.usdPerTroyOz', from: current, to: price }];
  },
};

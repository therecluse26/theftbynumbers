/** Number and money formatting. One format, used everywhere. */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const USD_CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "$16,373". Whole dollars, except where whole dollars would be a lie.
 *
 * Safe water costs about $1.50 a person a year. Rounded, that reads "$2", which
 * is a third more than the source says and prints a figure nobody published.
 * Under ten dollars the cents carry real weight, so keep them.
 */
export function usd(n: number): string {
  if (Math.abs(n) < 10 && !Number.isInteger(n)) return USD_CENTS.format(n);
  return USD.format(Math.round(n));
}

/** 0.193 becomes "19.3%". */
export function pct(n: number, places = 1): string {
  return (n * 100).toFixed(places) + '%';
}

export function commas(n: number): string {
  return n.toLocaleString('en-US');
}

/** Seconds in a year, averaged over the leap cycle. The receipt counts in these. */
const SECONDS_IN_YEAR = 31_557_600;

/**
 * "0.9 seconds", "34 minutes", "18.8 hours".
 *
 * The receipt divides one person's tax by a national yearly cost. The answer is
 * always small, and how small is the whole point. Never print "0 seconds".
 */
export function duration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return 'no time at all';

  const say = (n: number, unit: string): string => {
    const rounded = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
    return rounded + ' ' + (rounded === 1 ? unit : unit + 's');
  };

  if (seconds < 0.1) {
    const ms = seconds * 1000;
    if (ms < 1) return Math.round(ms * 1000) / 1000 + ' milliseconds';
    return say(ms, 'millisecond');
  }
  if (seconds < 1) return Math.round(seconds * 100) / 100 + ' seconds';
  if (seconds < 60) return say(seconds, 'second');
  if (seconds < 3600) return say(seconds / 60, 'minute');
  if (seconds < 86_400) return say(seconds / 3600, 'hour');
  if (seconds < SECONDS_IN_YEAR) return say(seconds / 86_400, 'day');
  return say(seconds / SECONDS_IN_YEAR, 'year');
}

/**
 * Months, to one decimal: "12.4 months".
 *
 * The donut legend compares ten slices of one working life. career() rounds to
 * whole months, which flattens every small slice to the same "1 month" and makes
 * the column useless. One decimal keeps them apart.
 */
export function months(count: number): string {
  if (!isFinite(count) || count <= 0) return '0 months';
  const rounded = Math.round(count * 10) / 10;
  return rounded + (rounded === 1 ? ' month' : ' months');
}

/** A count of years as a person says it: "5 years and 6 months". */
export function career(years: number): string {
  const months = Math.round(years * 12);
  const wholeYears = Math.floor(months / 12);
  const restMonths = months % 12;

  const parts: string[] = [];
  if (wholeYears > 0) parts.push(wholeYears + (wholeYears === 1 ? ' year' : ' years'));
  if (restMonths > 0) parts.push(restMonths + (restMonths === 1 ? ' month' : ' months'));
  if (parts.length === 0) return 'less than a month';
  return parts.join(' and ');
}

/**
 * "3.7×", "24×". How many times one price is the other.
 *
 * Section six divides a government unit price by a market one. The rounding
 * follows countText(): below ten a decimal carries real weight, above ten it is
 * noise. Never print "1.0×"; a card that says a thing costs the same as itself
 * has no business on the page, and validation refuses one.
 */
export function multiple(n: number): string {
  if (!isFinite(n) || n <= 0) return '0×';
  return (n >= 10 ? String(Math.round(n)) : n.toFixed(1)) + '×';
}

/*
 * There was a tinyPct() here, for shares too small for pct() to print without
 * exponent notation. The receipt used it to show a reader's tax as a fraction of
 * a national lump sum. "0.0000041%" told nobody anything, so those cards now
 * divide the lump sum across every household instead, and print plain dollars.
 */

/** Guards every value that reaches innerHTML from a data file. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

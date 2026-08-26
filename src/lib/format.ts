/** Number and money formatting. One format, used everywhere. */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** "$16,373". Always whole dollars. */
export function usd(n: number): string {
  return USD.format(Math.round(n));
}

/** 0.193 becomes "19.3%". */
export function pct(n: number, places = 1): string {
  return (n * 100).toFixed(places) + '%';
}

export function commas(n: number): string {
  return n.toLocaleString('en-US');
}

/** Guards every value that reaches innerHTML from a data file. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

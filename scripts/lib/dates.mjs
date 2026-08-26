/** Dates, always as YYYY-MM-DD in UTC. */

export function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Whole days from an ISO date to today. Negative dates in the future. */
export function ageInDays(iso, now = new Date()) {
  const then = Date.parse(iso + 'T00:00:00Z');
  const today = Date.parse(todayIso(now) + 'T00:00:00Z');
  return Math.round((today - then) / 86400000);
}

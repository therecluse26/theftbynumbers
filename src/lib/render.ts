/**
 * HTML builders for every part of the page that changes with the inputs.
 *
 * Astro calls these at build time to render the opening state. The browser
 * script calls the same functions on every keystroke. One source of truth,
 * so the first paint and the first update always agree.
 */
import { ASSUMPTIONS, BASKET, METALS, OUTLAYS, RECEIPT, ROADS, STATES, STATES_DATA, TAX, longDate } from './data';
import {
  career,
  commas,
  duration,
  escapeHtml,
  months,
  multiple,
  pct,
  usd,
  usdShort,
} from './format';
import { resolveLadderGroups } from './ladder';
import type { ResolvedLadderItem } from './ladder';
import { employerSharePctLabel, investmentSeries } from './tax';
import type { Breakdown, Inputs, ReceiptItem, RoadsItem, SourceRef } from './types';

const INK = '#0B0B0A';
const BONE = '#EDEAE3';
const YELLOW = '#FFD400';

/* Legend swatches. The gray segment needs none; it is named in its own bar. */
const CMP_TAX = '#FFD400';
const CMP_GROWTH = '#A38512';

function statusOf(inputs: Inputs) {
  return (
    TAX.filingStatuses.find((s) => s.id === inputs.status) ?? TAX.filingStatuses[0]!
  );
}

function plural(n: number, word: string): string {
  return n === 1 ? word : word + 's';
}

/* ---------- rail and hero ---------- */

export function statusEcho(inputs: Inputs): string {
  const rate =
    inputs.stateRatePct > 0
      ? inputs.stateRatePct.toFixed(2).replace(/0$/, '') + '% state'
      : 'no state tax';
  return statusOf(inputs).name + ' · ' + rate;
}

export interface HeroText {
  label: string;
  figure: string;
  foot: string;
  keptPct: string;
  ribbonBase: string;
}

export function heroText(r: Breakdown, inputs: Inputs): HeroText {
  const status = statusOf(inputs);

  if (inputs.countEmployerShare) {
    // With the employer's share counted, the honest denominator is what you
    // cost, not what you were paid.
    return {
      label:
        'It costs <b>' +
        usd(r.base) +
        '</b> a year to employ ' +
        status.whoObject +
        '. Of that, tax takes',
      figure: usd(r.total),
      // The percentage is quoted against your cost to your employer, so its
      // numerator must be employment tax only. Sales tax gets its own clause;
      // your employer never pays it.
      foot:
        'Payroll and income tax take <b>' +
        pct(r.employmentRate) +
        '</b> of your full cost to your employer. ' +
        (r.salesTax > 0
          ? 'Sales tax takes <b>' + usd(r.salesTax) + '</b> more when you spend. '
          : '') +
        'Your paycheck still nets <b>' +
        usd(r.takeHomePay) +
        '</b> &mdash; the employer\'s share never reaches it.',
      keptPct: 'Kept ' + pct(r.kept / r.base) + ' of what you cost',
      ribbonBase: 'Every dollar it costs to employ you, left to right',
    };
  }

  return {
    label: 'On <b>' + usd(r.wage) + '</b> a year, ' + status.who + ' pays',
    figure: usd(r.total),
    foot:
      'That is <b>' +
      pct(r.effectiveRate) +
      '</b> of everything you earned. You keep <b>' +
      usd(r.kept) +
      '</b>.',
    keptPct: 'Kept ' + pct(r.kept / r.base),
    ribbonBase: 'Every dollar you earned, left to right',
  };
}

/** Hero text for an empty income box. */
export function emptyHeroText(inputs: Inputs): HeroText {
  return {
    label: 'On <b>$0</b> a year, ' + statusOf(inputs).who + ' pays',
    figure: '$0',
    foot: 'Enter an income below to see the breakdown.',
    keptPct: 'Kept 0%',
    ribbonBase: 'Every dollar you earned, left to right',
  };
}

/* ---------- arcs ---------- */

/*
 * Both the dial and the donut are arcs on a circle centered on the origin.
 * The trigonometry lives here once. Degrees run clockwise from twelve o'clock.
 */

function point(radius: number, deg: number): [string, string] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [(radius * Math.cos(a)).toFixed(2), (radius * Math.sin(a)).toFixed(2)];
}

/** `attrs` rides on the path untouched, for callers that need a hook on a slice. */
function arc(
  radius: number,
  a0: number,
  a1: number,
  width: number,
  color: string,
  attrs = '',
): string {
  const p0 = point(radius, a0);
  const p1 = point(radius, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return (
    '<path d="M' +
    p0[0] +
    ' ' +
    p0[1] +
    ' A' +
    radius +
    ' ' +
    radius +
    ' 0 ' +
    large +
    ' 1 ' +
    p1[0] +
    ' ' +
    p1[1] +
    '" fill="none" stroke="' +
    color +
    '" stroke-width="' +
    width +
    '" stroke-linecap="butt"' +
    (attrs ? ' ' + attrs : '') +
    '/>'
  );
}

/* ---------- dial ---------- */

export function dialSvg(effectiveRate: number): string {
  const MAX = 0.6;
  const SWEEP = 270;
  const START = -135;
  const clamped = Math.min(effectiveRate, MAX);
  const angle = START + (clamped / MAX) * SWEEP;

  let g = arc(74, START, START + SWEEP, 15, 'rgba(237,234,227,.14)');
  if (clamped > 0.0005) g += arc(74, START, angle, 15, YELLOW);

  for (let i = 0; i <= 24; i++) {
    const value = (i / 24) * MAX;
    const tickAngle = START + (i / 24) * SWEEP;
    const major = i % 4 === 0;
    const from = point(major ? 56 : 61, tickAngle);
    const to = point(64, tickAngle);
    g +=
      '<line x1="' +
      from[0] +
      '" y1="' +
      from[1] +
      '" x2="' +
      to[0] +
      '" y2="' +
      to[1] +
      '" stroke="' +
      BONE +
      '" stroke-width="' +
      (major ? 2.2 : 1) +
      '" opacity="' +
      (major ? 0.75 : 0.3) +
      '"/>';
    if (major) {
      const label = point(43, tickAngle);
      g +=
        '<text x="' +
        label[0] +
        '" y="' +
        label[1] +
        '" text-anchor="middle" dominant-baseline="central" ' +
        'font-family="IBM Plex Mono, monospace" font-size="9" fill="' +
        BONE +
        '" opacity=".55">' +
        Math.round(value * 100) +
        '</text>';
    }
  }

  const needle = point(70, angle);
  const tail = point(-11, angle);
  g +=
    '<line x1="' +
    tail[0] +
    '" y1="' +
    tail[1] +
    '" x2="' +
    needle[0] +
    '" y2="' +
    needle[1] +
    '" stroke="' +
    YELLOW +
    '" stroke-width="3.5" stroke-linecap="round"/>';
  g += '<circle r="7" fill="' + INK + '" stroke="' + YELLOW + '" stroke-width="3"/>';
  g +=
    '<text x="0" y="88" text-anchor="middle" font-family="IBM Plex Mono, monospace" ' +
    'font-size="9" letter-spacing="2" fill="' +
    BONE +
    '" opacity=".5">% TO TAX</text>';

  return g;
}

/* ---------- ribbon ---------- */

export interface RibbonRender {
  html: string;
  ariaLabel: string;
}

export function ribbon(r: Breakdown): RibbonRender {
  const parts: Array<[string, string, number, string, string]> = [
    ['Kept', 'What you keep', r.kept, '#2C2B27', BONE],
    ['Federal', 'Box 2', r.federal, '#FFD400', INK],
    ['Soc. Sec.', 'Box 4', r.socialSecurity, '#E0B905', INK],
    ['Medicare', 'Box 6', r.medicare, '#C29F0C', INK],
    ['State', 'Box 17', r.state, '#A38512', INK],
    ['Employer', 'Not on it', r.employerShare, '#7C6415', BONE],
    ['Sales', 'Not on it', r.salesTax, '#5C4A16', BONE],
    ['Property', 'Not on it', r.propertyTax, '#453814', BONE],
  ];

  const total = r.base || 1;
  let html = '';
  for (const [name, box, amount, background, color] of parts) {
    if (amount <= 0) continue;
    const share = amount / total;
    html +=
      '<div class="seg-bar' +
      (share < 0.09 ? ' narrow' : '') +
      '" style="flex-grow:' +
      share +
      ';flex-basis:0;background:' +
      background +
      ';color:' +
      color +
      '">' +
      '<span class="sb-box">' +
      box +
      '</span>' +
      '<span><span class="sb-name">' +
      name +
      '</span><br>' +
      '<span class="sb-val">' +
      usd(amount) +
      '</span></span>' +
      '</div>';
  }

  return {
    html,
    ariaLabel:
      'You kept ' +
      pct(r.kept / total) +
      ' of your income; ' +
      pct(r.effectiveRate) +
      ' went to tax.',
  };
}

/* ---------- ledger ---------- */

interface LedgerRow {
  box: string;
  onForm: boolean;
  name: string;
  amount: number;
  note: string;
}

/** Real W-2 box numbers. The lines with no box are the ones you never see. */
function ledgerRows(r: Breakdown, inputs: Inputs): LedgerRow[] {
  const { socialSecurity, medicare } = TAX.payroll;
  const threshold = medicare.additionalThreshold[inputs.status];

  const rows: LedgerRow[] = [
    {
      box: 'Box 2',
      onForm: true,
      name: 'Federal income tax',
      amount: r.federal,
      note:
        'On ' +
        usd(r.taxable) +
        ' of taxable income, after the ' +
        usd(TAX.standardDeduction[inputs.status]) +
        ' standard deduction.',
    },
    {
      box: 'Box 4',
      onForm: true,
      name: 'Social Security',
      amount: r.socialSecurity,
      note:
        pct(socialSecurity.rate) +
        ' on the first ' +
        usd(socialSecurity.wageBase) +
        ' you earn.',
    },
    {
      box: 'Box 6',
      onForm: true,
      name: 'Medicare',
      amount: r.medicare,
      note:
        r.wage > threshold
          ? pct(medicare.rate, 2) +
            ' on everything, plus ' +
            pct(medicare.additionalRate, 1) +
            ' above ' +
            usd(threshold) +
            '.'
          : pct(medicare.rate, 2) + ', with no cap.',
    },
  ];

  if (r.state > 0) {
    rows.push({
      box: 'Box 17',
      onForm: true,
      name: 'State income tax',
      amount: r.state,
      note: pct(inputs.stateRatePct / 100, 2) + ' of gross, approximated.',
    });
  }
  if (r.employerShare > 0) {
    rows.push({
      box: 'Not on it',
      onForm: false,
      name: 'Employer payroll tax',
      amount: r.employerShare,
      note:
        'Another ' +
        employerSharePctLabel(r.wage) +
        ' your employer pays on top of your wage. It never enters your paycheck, ' +
        'so it does not reduce your take-home; it raises what you cost.',
    });
  }
  if (r.salesTax > 0) {
    rows.push({
      box: 'Not on it',
      onForm: false,
      name: 'Sales tax, estimated',
      amount: r.salesTax,
      note: 'Collected a few dollars at a time, never totalled anywhere.',
    });
  }
  if (r.propertyTax > 0) {
    rows.push({
      box: 'Not on it',
      onForm: false,
      name: 'Property tax, estimated',
      amount: r.propertyTax,
      note:
        'A year of tax on the median home in the state you picked. Owed on a ' +
        'home already paid off, every year, for as long as you hold it. Stop ' +
        'paying and the county sells the house.',
    });
  }
  return rows;
}

export function ledgerHtml(r: Breakdown, inputs: Inputs): string {
  let html = '';
  for (const row of ledgerRows(r, inputs)) {
    html +=
      '<tr>' +
      '<td class="c-box"><span class="box-tag' +
      (row.onForm ? '' : ' off') +
      '">' +
      row.box +
      '</span></td>' +
      '<td class="c-name">' +
      row.name +
      '<span class="li-note">' +
      row.note +
      '</span></td>' +
      '<td class="amt">' +
      usd(row.amount) +
      '</td></tr>';
  }
  html +=
    '<tr class="sum"><td class="c-box"></td><td class="c-name">Total for the year</td>' +
    '<td class="amt">' +
    usd(r.total) +
    '</td></tr>';
  return html;
}

/* ---------- cards ---------- */

/**
 * How many of a thing an amount comes to, and the small word beside it.
 *
 * Above ten, a fraction is noise, so round. Below one, the count reads
 * "0.35 of one" and needs the singular noun back from the caller.
 */
function countText(count: number): { shown: string; unit: string; singular: boolean } {
  if (count >= 10) return { shown: commas(Math.round(count)), unit: '', singular: false };
  if (count >= 1) return { shown: count.toFixed(1), unit: '', singular: false };
  return { shown: count.toFixed(2), unit: 'of one', singular: true };
}

interface Source {
  label: string;
  url: string;
}

/**
 * One card. Every string from a data file arrives escaped by the caller.
 *
 * A card takes one source, or several. Section six compares one unit bought
 * twice, so both prices must name their own publisher on the same card.
 *
 * `sub` is the second number: the published national figure the headline share
 * was worked out from. A card that states the reader's share must show what it
 * is a share of, or the reader has to hunt for it in the note. Pass '' where
 * the headline figure IS the published one, as on a `fact` card.
 */
function card(
  extraClass: string,
  figure: string,
  unit: string,
  sub: string,
  label: string,
  note: string,
  source?: Source | Source[],
): string {
  const sources = source ? (Array.isArray(source) ? source : [source]) : [];
  const links = sources
    .map(
      (s) =>
        '<a href="' +
        escapeHtml(s.url) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(s.label) +
        '</a>',
    )
    .join(' &middot; ');

  return (
    '<div class="buy' +
    (extraClass ? ' ' + extraClass : '') +
    '">' +
    '<span class="buy-count">' +
    figure +
    (unit ? '<small>' + escapeHtml(unit) + '</small>' : '') +
    '</span>' +
    (sub ? '<p class="buy-sub">' + escapeHtml(sub) + '</p>' : '') +
    '<p class="buy-label">' +
    escapeHtml(label) +
    '</p>' +
    '<p class="buy-price">' +
    escapeHtml(note) +
    '</p>' +
    (links ? '<p class="buy-src">' + links + '</p>' : '') +
    '</div>'
  );
}

/* ---------- basket ---------- */

export function basketHtml(total: number): string {
  let html = '';
  for (const item of BASKET.items) {
    const { shown, unit, singular } = countText(total / item.price);
    // No sub-line here. A basket note is the unit price and nothing else, so the
    // card already carries both numbers.
    html += card(
      '',
      shown,
      unit,
      '',
      singular ? item.singular : item.plural,
      item.note.replace('{price}', usd(item.price)),
      item.source,
    );
  }
  return html;
}

/* ---------- receipt ---------- */

export interface LifeCost {
  /** "5 years and 6 months". */
  figure: string;
  note: string;
  /** The five-day week, with the government's share filled in. */
  weekHtml: string;
  weekNote: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/**
 * How much of a working life the tax costs.
 *
 * Tax is a share of what you earn, so the share of your career it takes is the
 * effective rate itself. No hourly wage is needed and the answer holds at every
 * income. This is the strongest sentence on the page.
 */
export function lifeCost(r: Breakdown, inputs: Inputs): LifeCost {
  const yearsForTax = r.effectiveRate * inputs.years;
  const hoursOfForty = r.effectiveRate * 40;

  let days = '';
  for (const day of WEEKDAYS) days += '<span class="wd">' + day + '</span>';

  return {
    figure: career(yearsForTax),
    note:
      'You work ' +
      inputs.years +
      ' ' +
      plural(inputs.years, 'year') +
      '. That much of it is for the government, not for you.',
    weekHtml:
      '<div class="week" role="img" aria-label="' +
      pct(r.effectiveRate) +
      ' of every working week goes to tax.">' +
      '<div class="week-fill" style="width:' +
      Math.min(100, r.effectiveRate * 100).toFixed(2) +
      '%"></div>' +
      '<div class="week-days">' +
      days +
      '</div>' +
      '</div>',
    weekNote:
      'In a 40-hour week, ' +
      hoursOfForty.toFixed(1) +
      ' hours of your work are theirs before an hour of it is yours.',
  };
}

/* ---------- the donut ---------- */

/**
 * One step per slice, brightest first. Same yellow-to-dark ramp as the ribbon,
 * extended so ten slices stay apart. No hue that is not already on the page.
 */
const SLICE_COLORS = [
  '#FFD400',
  '#EFC504',
  '#E0B905',
  '#D1AC08',
  '#C29F0C',
  '#B2920F',
  '#A38512',
  '#937514',
  '#7C6415',
  '#5C4A16',
];

export interface DonutRender {
  svg: string;
  legend: string;
  note: string;
}

/** Ring geometry. The browser draws its connectors against the same numbers. */
const DONUT_RADIUS = 62;
const DONUT_WIDTH = 30;

/** A lit slice thickens. Keep this equal to `.dn-slice.is-on` in global.css. */
const DONUT_LIT_WIDTH = 38;

/**
 * Where a connector meets the ring: the outer edge of a lit slice, since a
 * connector is only ever drawn on one. Exported so the drawing code and the
 * hover code can never drift apart.
 */
export const DONUT_ANCHOR_R = DONUT_RADIUS + DONUT_LIT_WIDTH / 2;

/**
 * Where the money goes, and what each slice cost the reader in months of work.
 *
 * The slices come from Treasury's closed accounts and add up to the year's total
 * outlays; validation refuses a file where they do not. The reader's own share of
 * a slice is their federal tax times that slice's share of the whole.
 *
 * Federal tax, not the whole bill. These are federal accounts, so a Californian's
 * state tax has no business enlarging their slice of one.
 */
export function outlaysDonut(r: Breakdown, inputs: Inputs): DonutRender {
  const total = OUTLAYS.totalOutlays || 1;
  const taxOverYears = r.federalTotal * inputs.years;

  const RADIUS = DONUT_RADIUS;
  const WIDTH = DONUT_WIDTH;

  let svg = '';
  let legend = '';
  let angle = 0;

  OUTLAYS.categories.forEach((category, index) => {
    const share = category.amount / total;
    const sweep = share * 360;
    const color = SLICE_COLORS[index % SLICE_COLORS.length]!;

    // The pair of hooks that ties one slice to one legend row: which category
    // it is, and the angle a connector should leave the ring at.
    const mid = angle + sweep / 2;
    const hooks =
      'data-slice="' +
      escapeHtml(category.id) +
      '" data-mid="' +
      mid.toFixed(3) +
      '"';

    // A slice under a fifth of a degree draws as a dot and reads as dirt.
    if (sweep > 0.2) {
      // A single arc cannot span a full circle; its two ends would meet and
      // the path would collapse to nothing.
      if (sweep >= 359.9) {
        svg +=
          '<circle class="dn-slice" ' +
          hooks +
          ' r="' +
          RADIUS +
          '" fill="none" stroke="' +
          color +
          '" stroke-width="' +
          WIDTH +
          '"/>';
      } else {
        svg += arc(
          RADIUS,
          angle,
          angle + sweep,
          WIDTH,
          color,
          'class="dn-slice" ' + hooks,
        );
      }
    }
    angle += sweep;

    const yours = taxOverYears * share;
    // The same numerator as the column beside it. Using effectiveRate here would
    // price the months off the whole bill while "Yours" prices the dollars off
    // the federal part, and the two columns would describe one slice two ways.
    const federalRate = r.base > 0 ? r.federalTotal / r.base : 0;
    const monthsOfLife = federalRate * inputs.years * share * 12;

    legend +=
      '<div class="dn-row" tabindex="0" ' +
      hooks +
      '>' +
      '<i class="dn-dot" style="background:' +
      color +
      '"></i>' +
      '<span class="dn-name">' +
      escapeHtml(category.name) +
      '<span class="dn-note">' +
      escapeHtml(category.note) +
      sourceLink(category.source) +
      '</span></span>' +
      // What the category itself cost. The legend used to give a share, the
      // reader's slice and their months of life, but never the sum being split.
      '<span class="dn-spent num">' +
      usdShort(category.amount) +
      '</span>' +
      '<span class="dn-pct num">' +
      pct(share) +
      '</span>' +
      '<span class="dn-yours num">' +
      usd(yours) +
      '</span>' +
      '<span class="dn-life num">' +
      months(monthsOfLife) +
      '</span>' +
      '</div>';
  });

  svg +=
    '<text x="0" y="-6" text-anchor="middle" font-family="IBM Plex Mono, monospace" ' +
    'font-size="10" letter-spacing="2" fill="' +
    BONE +
    '" opacity=".5">FY' +
    OUTLAYS.fiscalYear +
    '</text>';
  svg +=
    '<text x="0" y="14" text-anchor="middle" font-family="IBM Plex Mono, monospace" ' +
    'font-size="15" fill="' +
    BONE +
    '">$' +
    (total / 1e12).toFixed(2) +
    'tn</text>';

  return {
    svg,
    legend,
    note:
      'Every dollar the federal government spent in ' +
      OUTLAYS.fiscalYear +
      ', from Treasury’s closed accounts. "Yours" is your ' +
      usd(taxOverYears) +
      ' of federal tax, split the same way. The last column is that slice, priced ' +
      'in your own working life. Every slice also says what that money buys now ' +
      'against what it bought before, and names the publisher of both figures.' +
      sourceLink(OUTLAYS.meta.fields['totalOutlays']),
  };
}

/** Seconds in a year, averaged over the leap cycle. */
const SECONDS_IN_YEAR = 31_557_600;

/**
 * The part of every federal dollar this reader pays.
 *
 * One ratio, and every money card on the receipt divides by it. The receipt used
 * to hold two ideas of "your share" at once: a card priced off the reader's own
 * tax, and a card priced off a flat split across every US household. Adjacent
 * cards therefore meant different things by the same word, and half of them
 * barely moved when the reader changed their income.
 *
 * Both halves must describe the same government. This used to divide `r.total`,
 * which counts state, sales and property tax, by federal outlays. A Californian
 * with all three boxes ticked saw every figure in sections three and six 53% too
 * high, because $12,123 a year that never left the state was being credited
 * against Washington's spending. `federalTotal` is the honest numerator.
 */
function federalDollarShare(r: Breakdown): number {
  return OUTLAYS.totalOutlays > 0 ? r.federalTotal / OUTLAYS.totalOutlays : 0;
}

/** One receipt card. The kind decides which field carries the number. */
function receiptCard(
  item: ReceiptItem,
  r: Breakdown,
  inputs: Inputs,
  taxOverYears: number,
): string {
  const note = item.note.replace('{price}', usd(item.price ?? 0));

  if (item.kind === 'duration') {
    const seconds = (taxOverYears / item.annualCost!) * SECONDS_IN_YEAR;
    const text = duration(seconds);
    const at = text.indexOf(' ');
    return card(
      'rc',
      text.slice(0, at),
      text.slice(at + 1),
      usdShort(item.annualCost!) + ' a year',
      item.label!,
      note,
      item.source,
    );
  }

  if (item.kind === 'yearly') {
    // A yearly national cost, run for as long as the reader works. The years
    // slider belongs here: twenty years of work fund twenty years of the waste.
    //
    // The sub-line has to carry the horizon. Without it the card reads "$10,884"
    // under a label ending "every year", and a reader takes the figure for a
    // yearly one when it is twenty years of $544.
    const yours = federalDollarShare(r) * item.annualCost! * inputs.years;
    const costShare = item.annualCost! / OUTLAYS.totalOutlays;
    const yearWord = inputs.years + ' ' + plural(inputs.years, 'year');
    return card(
      'rc',
      usd(yours),
      '',
      usdShort(item.annualCost!) + ' a year, over your ' + yearWord,
      item.label!,
      note +
        ' That is ' +
        pct(costShare) +
        ' of all federal spending. The same ' +
        pct(costShare) +
        ' of your own federal tax, over ' +
        yearWord +
        ', is the figure above.',
      item.source,
    );
  }

  if (item.kind === 'unit') {
    // No sub-line. Every unit note opens with {price} in the item's own words:
    // "an hour", "a kit", "a year". A sub-line would print the same figure twice
    // and have to say "each", which is wrong for an hour of flying.
    const { shown, unit, singular } = countText(taxOverYears / item.price!);
    return card(
      'rc',
      shown,
      unit,
      '',
      singular ? item.singular! : item.plural!,
      note,
      item.source,
    );
  }

  if (item.kind === 'lump') {
    // One cumulative total, counted once. The years slider must NOT multiply it;
    // nobody pays for the Afghanistan war twenty times over.
    //
    // The lump is measured against a single year of current outlays, so a bill
    // run up when the government was smaller reads low. The notes section says
    // so. The trailing sentence names the horizon rather than hiding it.
    //
    // duration() prints that horizon, never toFixed(1). Four of these bills are
    // under a twentieth of a year, and one decimal turned every one of them into
    // "0.0 years of all federal spending" — the same nothing-figure that got the
    // old `share` kind deleted for printing "0.0000041%".
    const yours = federalDollarShare(r) * item.total!;
    const spendingTime = duration(
      (item.total! / OUTLAYS.totalOutlays) * SECONDS_IN_YEAR,
    );
    return card(
      'rc',
      usd(yours),
      '',
      usdShort(item.total!) + ' once, at your rate',
      item.label!,
      note +
        ' This bill is ' +
        spendingTime +
        ' of all federal spending, so it costs you ' +
        spendingTime +
        ' of your own federal tax.',
      item.source,
    );
  }

  if (item.kind === 'fact') {
    return card(
      'rc rc-fact',
      escapeHtml(item.figure!),
      '',
      '',
      item.label!,
      note,
      item.source,
    );
  }

  // Computed: worked out from the reader's own figures, not from a fixed price.
  // The kind names a function here, so read the name rather than assuming there
  // is only ever one. A second computed card used to render as this one.
  if (item.compute !== 'social-security') return '';

  // Both halves of the payroll tax. Box 4 is only the half your paycheck feels;
  // the employer pays the same again. This page already argues that half is your
  // money, so counting one half here would contradict its own ledger.
  //
  // Whether this beats the benefit depends on the years slider, and at short runs
  // it does not. Say so. The argument that holds at every setting is the last
  // sentence: a Social Security claim dies with you, and a balance does not.
  const bothHalves = r.socialSecurity * 2;
  const series = investmentSeries(bothHalves, inputs.returnPct, inputs.years, 0);
  const final = series[inputs.years]!.balance;
  // No sub-line. The note opens with the same yearly figure and then explains
  // why it counts both halves, which a four-word sub-line cannot do.
  return card(
    'rc rc-wide',
    usd(final),
    '',
    '',
    item.label!,
    usd(bothHalves) +
      ' a year goes in, counting the half your employer pays. Held for ' +
      inputs.years +
      ' ' +
      plural(inputs.years, 'year') +
      ' at ' +
      inputs.returnPct.toFixed(1) +
      '%, it would be this, and drawing ' +
      pct(ASSUMPTIONS.investment.safeWithdrawalRate, 0) +
      ' of it would pay you ' +
      usd(final * ASSUMPTIONS.investment.safeWithdrawalRate) +
      ' a year without touching the pot. ' +
      note +
      ' A benefit stops when you die. A balance passes to your children.',
    item.source,
  );
}

/**
 * The whole receipt: every group, in file order, each with its own grid.
 *
 * Every figure here is the reader's SHARE of a national total. Nobody's dollars
 * are traceable to one missile or one empty desk. The copy must never say the
 * reader bought a thing; the notes section carries the same warning.
 */
export function receiptHtml(r: Breakdown, inputs: Inputs): string {
  // Federal tax, not the whole bill. Every card here divides a federal figure.
  const taxOverYears = r.federalTotal * inputs.years;

  let html = '';
  for (const group of RECEIPT.groups) {
    const items = RECEIPT.items.filter((item) => item.group === group.id);
    if (items.length === 0) continue;

    let cards = '';
    for (const item of items) cards += receiptCard(item, r, inputs, taxOverYears);

    html +=
      '<div class="rc-group">' +
      '<h3 class="rc-title">' +
      escapeHtml(group.title) +
      '</h3>' +
      '<p class="rc-lede">' +
      escapeHtml(group.lede) +
      '</p>' +
      '<div class="buy-grid">' +
      cards +
      '</div>' +
      '</div>';
  }
  return html;
}

/**
 * The lede above the receipt. It names the sum every card divides.
 *
 * That sum is the federal part of the bill, which is smaller than the hero
 * figure whenever the reader picks a state or ticks a box. Say both numbers when
 * they differ, or the reader meets a total here that contradicts the one at the
 * top of the page. Say one when they are equal; printing a figure twice reads
 * as a mistake.
 */
export function receiptLede(r: Breakdown, inputs: Inputs): string {
  const federal = usd(r.federalTotal * inputs.years);
  const span = inputs.years + ' ' + plural(inputs.years, 'year');

  if (r.total - r.federalTotal < 1) {
    return (
      'Over ' +
      span +
      ' you hand over ' +
      federal +
      ' in federal tax. Every figure below is your share of a national total, ' +
      'not a purchase in your name.'
    );
  }

  return (
    'Over ' +
    span +
    ' you hand over ' +
    usd(r.total * inputs.years) +
    ' in tax. ' +
    federal +
    ' of it reaches Washington, and that is the sum every figure below divides. ' +
    'Each one is your share of a national total, not a purchase in your name.'
  );
}

/* ---------- invest ---------- */

export interface InvestText {
  balance: string;
  /** The same balance as a number. The unlock ladder is priced against it. */
  balanceValue: number;
  balanceNote: string;
  growth: string;
  growthNote: string;
  /** "After 20 years", the eyebrow above the comparison. */
  heading: string;
  /** The two bars and their legend, ready for innerHTML. */
  comparison: string;
  /** The line under the comparison. It states the case in words. */
  chartNote: string;
}

/**
 * One block of a bar. A block thinner than an eighth of the bar cannot hold a
 * money figure, so it goes bare. The legend under the bars names it instead.
 */
function cmpSegment(
  className: string,
  share: number,
  name: string,
  amount: string | null,
): string {
  return (
    '<div class="cmp-seg ' +
    className +
    (share < 0.13 ? ' narrow' : '') +
    '" style="flex-grow:' +
    share +
    ';flex-basis:0">' +
    '<span class="cmp-name">' +
    name +
    '</span>' +
    (amount ? '<span class="cmp-val">' + amount + '</span>' : '') +
    '</div>'
  );
}

/**
 * Two bars on one scale. The short one is your life. The long one is the same
 * life with the tax money kept and invested. The yellow is the difference.
 */
function comparisonHtml(
  tookHome: number,
  taxPaid: number,
  growth: number,
  couldHave: number,
): string {
  const scale = couldHave || 1;
  const tookShare = tookHome / scale;
  const taxShare = taxPaid / scale;
  const growthShare = growth / scale;

  const row = (label: string, total: string, hot: boolean, bar: string) =>
    '<div class="cmp-row">' +
    '<div class="cmp-head">' +
    '<p class="cmp-label">' +
    label +
    '</p>' +
    '<p class="cmp-total num' +
    (hot ? ' cmp-total-hot' : '') +
    '">' +
    total +
    '</p>' +
    '</div>' +
    '<div class="cmp-bar">' +
    bar +
    '</div>' +
    '</div>';

  const actual = row(
    'What you actually took home',
    usd(tookHome),
    false,
    cmpSegment('cmp-took', tookShare, 'Your pay, after tax', null) +
      '<div class="cmp-empty" style="flex-grow:' +
      (1 - tookShare) +
      ';flex-basis:0"></div>',
  );

  const possible = row(
    'What you could have had',
    usd(couldHave),
    true,
    cmpSegment('cmp-took', tookShare, 'Your pay, after tax', null) +
      // Short names only. A long one gets cut off inside its own segment.
      cmpSegment('cmp-tax', taxShare, 'Tax paid', usd(taxPaid)) +
      cmpSegment('cmp-growth', growthShare, 'Growth lost', usd(growth)),
  );

  const legend =
    '<p class="cmp-legend">' +
    '<span><i style="background:' +
    CMP_TAX +
    '"></i>Tax you paid <b>' +
    usd(taxPaid) +
    '</b></span>' +
    '<span><i style="background:' +
    CMP_GROWTH +
    '"></i>Growth you never earned <b>' +
    usd(growth) +
    '</b></span>' +
    '<span class="cmp-legend-total">What the tax cost you <b>' +
    usd(taxPaid + growth) +
    '</b></span>' +
    '</p>';

  return actual + possible + legend;
}

export function investText(r: Breakdown, inputs: Inputs): InvestText {
  const series = investmentSeries(r.total, inputs.returnPct, inputs.years, r.kept);
  const final = series[inputs.years]!.balance;
  const taxPaid = r.total * inputs.years;
  const growth = final - taxPaid;
  const tookHome = r.kept * inputs.years;
  const couldHave = tookHome + final;

  return {
    balance: usd(final),
    balanceValue: final,
    balanceNote:
      'Assumes you set aside ' +
      usd(r.total) +
      ' at the start of every year for ' +
      inputs.years +
      ' ' +
      plural(inputs.years, 'year') +
      ' and earned ' +
      inputs.returnPct.toFixed(1) +
      '% a year on it. That is the yellow below.',
    growth: usd(growth),
    growthNote:
      'You would have contributed ' +
      usd(taxPaid) +
      '. The rest is compounding' +
      (growth > taxPaid ? ', which by now is doing more work than you are.' : '.'),
    heading:
      'After ' + inputs.years + ' ' + plural(inputs.years, 'year') + ' at this income',
    comparison: comparisonHtml(tookHome, taxPaid, growth, couldHave),
    chartNote:
      'You take home ' +
      usd(tookHome) +
      ' over those ' +
      inputs.years +
      ' ' +
      plural(inputs.years, 'year') +
      '. Had the ' +
      usd(taxPaid) +
      ' in tax stayed with you and been invested, you would be sitting on ' +
      usd(couldHave) +
      ' instead. Your spending never changes; only the tax money is invested.',
  };
}


/* ---------- ladder ---------- */

export interface StackRender {
  html: string;
  lede: string;
}

/**
 * The source link that hangs off the end of a note, a footnote or a hint.
 *
 * A card names its sources through `card()`. Everything else on the page that
 * makes a claim in prose uses this: a rung, a donut slice, a group footnote and
 * the checkbox hints. It takes a `{ label, url }`, which is the shape of both a
 * data item's `source` and a meta block's field provenance, so a hint can link
 * the same URL the updater fetches from.
 *
 * It is declared below its first caller and hoisted. It sits here because it is
 * a sibling of the ladder renderers that used it first.
 *
 * It takes one source or a list of them. A donut slice states the Treasury
 * amount and then what that money buys against what it used to buy, and those
 * two figures come from two publishers. Both must be reachable from the slice.
 */
function sourceLink(source?: SourceRef): string {
  if (!source) return '';
  const list = Array.isArray(source) ? source : [source];
  if (list.length === 0) return '';
  // A middle dot between them, the same separator card() uses, so a slice with
  // three publishers does not read as one long run of link text.
  return (
    ' ' +
    list
      .map(
        (one) =>
          '<a href="' +
          escapeHtml(one.url) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(one.label) +
          '</a>',
      )
      .join(' &middot; ')
  );
}

/**
 * The count column is a fixed width, so the numbers line up down the page.
 * A dollar rung counted against a large balance gives "1,724,324,275x", which
 * would run straight through the name beside it and scroll the whole page
 * sideways. Step the size down rather than break the alignment.
 */
function countClass(shown: string): string {
  if (shown.length >= 11) return ' tier-count-xs';
  if (shown.length >= 8) return ' tier-count-sm';
  return '';
}

/** One rung the balance clears outright. */
function tier(item: ResolvedLadderItem, count: number): string {
  const shown = commas(count);
  return (
    '<div class="tier">' +
    '<span class="tier-count num' +
    countClass(shown) +
    '">' +
    shown +
    '<small>x</small></span>' +
    '<span class="tier-name">' +
    escapeHtml(count === 1 ? item.singular : item.plural) +
    '<span class="tier-note">' +
    escapeHtml(item.note) +
    sourceLink(item.source) +
    '</span></span>' +
    '<span class="tier-price num">' +
    usd(item.price) +
    '</span>' +
    '</div>'
  );
}

/** One rung the balance does not reach, with the gap named. */
function lockedTier(item: ResolvedLadderItem, balance: number): string {
  return (
    '<div class="tier locked">' +
    '<span class="tier-count">short ' +
    usd(item.price - balance) +
    '</span>' +
    '<span class="tier-name">' +
    escapeHtml(item.singular) +
    '<span class="tier-note">' +
    escapeHtml(item.note) +
    sourceLink(item.source) +
    '</span></span>' +
    '<span class="tier-price num">' +
    usd(item.price) +
    '</span>' +
    '</div>'
  );
}

/** Locked rungs shown per group. Past this it is a wall of gray, not an argument. */
const LOCKED_PER_GROUP = 2;

/**
 * What the invested balance buys back, in three groups: for someone else, for
 * your family, for you. Within a group the rungs run cheapest first.
 *
 * The groups sort by who a rung is for, not by what it costs. That is the whole
 * point of grouping: a saved life and a paid-off home answer different questions,
 * and a single price-ordered list makes them look like the same question.
 *
 * The rungs measure freedom, not objects, so several of them are priced from the
 * reader's own kept pay: wage less every tax on this page. Not takeHomePay,
 * which is only net of withholdings. That is why this needs the figure passed in.
 */
export function stack(
  balance: number,
  inputs: Inputs,
  annualTakeHome: number,
): StackRender {
  const groups = resolveLadderGroups(inputs.stateIndex, annualTakeHome);

  // The balance is stated once, at the top. It used to be a waterline drawn
  // where the ladder ran out. Grouped rungs are no longer in price order across
  // the whole section, so "everything above this line is yours" stopped being
  // true and the line had to become a plain heading.
  let html =
    '<div class="balance-bar">' +
    '<span>Your balance after ' +
    inputs.years +
    ' ' +
    plural(inputs.years, 'year') +
    '</span>' +
    '<span class="num">' +
    usd(balance) +
    '</span>' +
    '</div>';

  let cleared = 0;
  let total = 0;

  for (const group of groups) {
    let rungs = '';
    let shownLocked = 0;

    for (const item of group.items) {
      total++;
      const count = Math.floor(balance / item.price);
      if (count >= 1) {
        cleared++;
        rungs += tier(item, count);
      } else if (shownLocked < LOCKED_PER_GROUP) {
        rungs += lockedTier(item, balance);
        shownLocked++;
      }
    }

    html +=
      '<div class="rc-group">' +
      '<h3 class="rc-title">' +
      escapeHtml(group.title) +
      '</h3>' +
      '<p class="rc-lede">' +
      escapeHtml(group.lede) +
      '</p>' +
      '<div class="stack">' +
      rungs +
      '</div>' +
      (group.footnote
        ? '<p class="hint stack-foot">' +
          escapeHtml(group.footnote) +
          sourceLink(group.footnoteSource) +
          '</p>'
        : '') +
      '</div>';
  }

  return {
    html,
    lede:
      cleared === 0
        ? 'Not yet enough for anything on this list. Raise the income, the years, or the return.'
        : 'Invested instead of paid, ' +
          usd(balance) +
          ' buys back ' +
          cleared +
          ' of the ' +
          total +
          ' rungs below. ' +
          federalSecondsSentence(balance),
  };
}

/**
 * How long the federal government takes to spend the reader's whole balance.
 * The federal figure comes from the receipt file, never from a number typed here.
 */
function federalSecondsSentence(balance: number): string {
  const federal = RECEIPT.items.find((item) => item.id === 'federal-spending');
  if (!federal?.annualCost) return '';
  const seconds = (balance / federal.annualCost) * SECONDS_IN_YEAR;
  return 'The federal government spends that much in ' + duration(seconds) + '.';
}

/* ---------- but what about the roads? ---------- */

/**
 * The transportation slice of federal spending, as a share of the whole.
 *
 * This is the first answer section six gives, and the hardest one to argue
 * with. It comes from outlays.json, never from a number typed here, so the
 * donut in section three and the lede in section six can never disagree.
 */
function transportShare(): number {
  const transport = OUTLAYS.categories.find((c) => c.id === 'transportation');
  if (!transport) return 0;
  return transport.amount / OUTLAYS.totalOutlays;
}

/** The paragraph above the groups. It names the size of the bill first. */
export function roadsLede(): string {
  return ROADS.lede.replace('{transportShare}', pct(transportShare(), 2));
}

/** One section six card. The kind decides which field carries the number. */
function roadsCard(item: RoadsItem, r: Breakdown, inputs: Inputs): string {
  if (item.kind === 'multiple') {
    // The sameness sentence prints first, ahead of the prices. A reader who
    // doubts the card asks "is that the same job?" before anything else, so the
    // card answers that question before it quotes a number.
    return card(
      'rc',
      multiple(item.publicPrice! / item.privatePrice!),
      '',
      '',
      item.label,
      item.sameness +
        ' ' +
        item.note
          .replace('{public}', usd(item.publicPrice!))
          .replace('{private}', usd(item.privatePrice!)),
      [item.publicSource!, item.privateSource!],
    );
  }

  if (item.kind === 'record') {
    // No arithmetic. The figure is printed as the file wrote it, so it can
    // carry its own unit: "284,000 km", "1.9 to 1", "1.82%".
    return card(
      'rc rc-fact',
      escapeHtml(item.figure!),
      '',
      '',
      item.label,
      item.note,
      item.source,
    );
  }

  // Reader: the transportation share of this reader's own tax, over their own years.
  // The same slice the donut already shows them, lifted out and set alone under
  // the question it answers. Read the compute name; do not assume one exists.
  if (item.compute !== 'roads-share') return '';

  // Federal tax, like every other share on this page. The transportation slice is a
  // federal account, so state and local tax cannot enlarge the reader's part of
  // it. This card understates the road bill for a different reason, named in the
  // notes: most roads are built and kept by states and counties, not Washington.
  const federalOverYears = r.federalTotal * inputs.years;
  const share = federalOverYears * transportShare();
  // No sub-line. The transport-share card sits directly above this one and its
  // note already states the national figure, so a second copy of it here would
  // print one number twice, in two roundings, on one screen.
  return card(
    'rc',
    usd(share),
    '',
    '',
    item.label,
    'Over ' +
      inputs.years +
      ' ' +
      plural(inputs.years, 'year') +
      ' you hand over ' +
      usd(federalOverYears) +
      ' in federal tax. At the transportation share, ' +
      usd(share) +
      ' of it is the roads answer. The other ' +
      usd(federalOverYears - share) +
      ' is everything else. ' +
      item.note,
    item.source,
  );
}

/**
 * Section six: every group, in file order, each with its own grid.
 *
 * One card moves with the reader's inputs, so this takes the breakdown like
 * every other builder here and the browser script re-runs it on each keystroke.
 * The rest of the section is the same at every income; re-rendering it costs
 * nothing and keeps one code path instead of two.
 */
export function roadsHtml(r: Breakdown, inputs: Inputs): string {
  let html = '';
  for (const group of ROADS.groups) {
    const items = ROADS.items.filter((item) => item.group === group.id);
    if (items.length === 0) continue;

    let cards = '';
    for (const item of items) cards += roadsCard(item, r, inputs);

    html +=
      '<div class="rc-group">' +
      '<h3 class="rc-title">' +
      escapeHtml(group.title) +
      '</h3>' +
      '<p class="rc-lede">' +
      escapeHtml(group.lede) +
      '</p>' +
      '<div class="buy-grid">' +
      cards +
      '</div>' +
      '</div>';
  }
  return html;
}

/*
 * The five functions below return HTML, not text.
 *
 * Each one states a figure, so each one names where the figure came from. The
 * link is read out of the meta block of the file the figure lives in, so the
 * reader is sent to the same page the updater fetches from. Their callers use
 * set:html, and src/scripts/app.ts sets the donut note with innerHTML.
 *
 * Anything interpolated here must already be safe: usd(), pct() and longDate()
 * emit digits and punctuation, and sourceLink() escapes its own label and URL.
 * Never drop a raw data string into one of these without escapeHtml().
 */

/** The footnote under the ladder. Its date comes from the metals file. */
export function stackFootnote(): string {
  return (
    'A rung about your own time is priced at what you keep after every tax on ' +
    'this page, held flat. That is a smaller number than your paycheck, because ' +
    'sales tax and property tax come out of the paycheck later. ' +
    'Other prices are ' +
    TAX.taxYear +
    ' averages. The home is the median value in the state you picked above. ' +
    'Gold moves daily; this uses spot on ' +
    longDate(METALS.meta.updatedAt) +
    '.' +
    sourceLink(STATES_DATA.meta.fields['medianHomeValue']) +
    sourceLink(METALS.meta.fields['gold.usdPerTroyOz'])
  );
}

/** The last footnote in the notes section. */
export function figuresFootnote(): string {
  return (
    TAX.taxYear +
    ' IRS brackets and standard deductions, a ' +
    usd(TAX.payroll.socialSecurity.wageBase) +
    ' Social Security wage base, and prices sampled from typical ' +
    TAX.taxYear +
    ' US averages.' +
    sourceLink(TAX.meta.fields['*']) +
    sourceLink(TAX.meta.fields['payroll.socialSecurity.wageBase'])
  );
}

/** The wording on the sales tax checkbox, built from the assumptions file. */
export function salesTaxHint(): string {
  return (
    'Rough: ' +
    pct(ASSUMPTIONS.salesTax.spendShare, 0) +
    ' of take-home spent on taxable goods at a ' +
    pct(ASSUMPTIONS.salesTax.combinedRate, 1) +
    ' combined rate.'
  );
}

/** The wording on the property tax checkbox, built from the states file. */
export function propertyTaxHint(inputs: Inputs): string {
  const row = STATES[inputs.stateIndex];
  if (!row) return '';
  return (
    pct(row.propertyTaxRatePct / 100, 2) +
    ' a year on the ' +
    usd(row.medianHomeValue) +
    ' median home in ' +
    row.name +
    '. It never ends, and owning the house outright does not stop it.'
  );
}

/** The wording on the employer share checkbox. */
export function employerHint(): string {
  return (
    'Another ' +
    employerSharePctLabel() +
    " paid on top of your wage. It doesn't shrink your paycheck, it raises " +
    "what you cost — so it's counted against your full compensation, not your salary. " +
    'The Social Security half stops at the wage base, so above ' +
    usd(TAX.payroll.socialSecurity.wageBase) +
    ' the rate on your whole wage is lower. The ledger row shows your own.'
  );
}

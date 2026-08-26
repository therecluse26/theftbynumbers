/**
 * HTML builders for every part of the page that changes with the inputs.
 *
 * Astro calls these at build time to render the opening state. The browser
 * script calls the same functions on every keystroke. One source of truth,
 * so the first paint and the first update always agree.
 */
import { ASSUMPTIONS, BASKET, CHARITY, METALS, RECEIPT, TAX, longDate } from './data';
import { career, commas, duration, escapeHtml, pct, tinyPct, usd } from './format';
import { resolveLadder } from './ladder';
import { employerSharePctLabel, investmentSeries } from './tax';
import type { Breakdown, Inputs, ReceiptItem } from './types';

const INK = '#0B0B0A';
const BONE = '#EDEAE3';
const YELLOW = '#FFD400';

/* Legend swatches. The grey segment needs none; it is named in its own bar. */
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

/* ---------- dial ---------- */

export function dialSvg(effectiveRate: number): string {
  const MAX = 0.6;
  const SWEEP = 270;
  const START = -135;
  const clamped = Math.min(effectiveRate, MAX);
  const angle = START + (clamped / MAX) * SWEEP;

  const point = (radius: number, deg: number): [string, string] => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [(radius * Math.cos(a)).toFixed(2), (radius * Math.sin(a)).toFixed(2)];
  };
  const arc = (radius: number, a0: number, a1: number, width: number, colour: string) => {
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
      colour +
      '" stroke-width="' +
      width +
      '" stroke-linecap="butt"/>'
    );
  };

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
    ['Kept', 'Take-home', r.kept, '#2C2B27', BONE],
    ['Federal', 'Box 2', r.federal, '#FFD400', INK],
    ['Soc. Sec.', 'Box 4', r.socialSecurity, '#E0B905', INK],
    ['Medicare', 'Box 6', r.medicare, '#C29F0C', INK],
    ['State', 'Box 17', r.state, '#A38512', INK],
    ['Employer', 'Not on it', r.employerShare, '#7C6415', BONE],
    ['Sales', 'Not on it', r.salesTax, '#5C4A16', BONE],
  ];

  const total = r.base || 1;
  let html = '';
  for (const [name, box, amount, background, colour] of parts) {
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
      colour +
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
        employerSharePctLabel() +
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

/** One card. Every string from a data file arrives escaped by the caller. */
function card(
  extraClass: string,
  figure: string,
  unit: string,
  label: string,
  note: string,
  source?: { label: string; url: string },
): string {
  return (
    '<div class="buy' +
    (extraClass ? ' ' + extraClass : '') +
    '">' +
    '<span class="buy-count">' +
    figure +
    (unit ? '<small>' + escapeHtml(unit) + '</small>' : '') +
    '</span>' +
    '<p class="buy-label">' +
    escapeHtml(label) +
    '</p>' +
    '<p class="buy-price">' +
    escapeHtml(note) +
    '</p>' +
    (source
      ? '<p class="buy-src"><a href="' +
        escapeHtml(source.url) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(source.label) +
        '</a></p>'
      : '') +
    '</div>'
  );
}

/* ---------- basket ---------- */

export function basketHtml(total: number): string {
  let html = '';
  for (const item of BASKET.items) {
    const { shown, unit, singular } = countText(total / item.price);
    html += card(
      '',
      shown,
      unit,
      singular ? item.singular : item.plural,
      item.note.replace('{price}', usd(item.price)),
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

/** Seconds in a year, averaged over the leap cycle. */
const SECONDS_IN_YEAR = 31_557_600;

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
      item.label!,
      note,
      item.source,
    );
  }

  if (item.kind === 'unit') {
    const { shown, unit, singular } = countText(taxOverYears / item.price!);
    return card(
      'rc',
      shown,
      unit,
      singular ? item.singular! : item.plural!,
      note,
      item.source,
    );
  }

  if (item.kind === 'share') {
    return card(
      'rc',
      tinyPct(taxOverYears / item.total!),
      '',
      item.label!,
      note,
      item.source,
    );
  }

  if (item.kind === 'fact') {
    return card('rc rc-fact', escapeHtml(item.figure!), '', item.label!, note, item.source);
  }

  // Computed: worked out from the reader's own figures, not from a fixed price.
  //
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
  return card(
    'rc rc-wide',
    usd(final),
    '',
    item.label!,
    usd(bothHalves) +
      ' a year goes in, counting the half your employer pays. Held for ' +
      inputs.years +
      ' ' +
      plural(inputs.years, 'year') +
      ' at ' +
      inputs.returnPct.toFixed(1) +
      '%, it would be this, and drawing four percent of it would pay you ' +
      usd(final * 0.04) +
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
  const taxOverYears = r.total * inputs.years;

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

/** The lede above the receipt. It names the sum every card divides. */
export function receiptLede(r: Breakdown, inputs: Inputs): string {
  return (
    'Over ' +
    inputs.years +
    ' ' +
    plural(inputs.years, 'year') +
    ' you hand over ' +
    usd(r.total * inputs.years) +
    '. Every figure below is your share of a national total, not a purchase in your name.'
  );
}

/* ---------- give ---------- */

export function giveHtml(taxOverYears: number): string {
  let html = '';
  for (const item of CHARITY.items) {
    const { shown, unit, singular } = countText(taxOverYears / item.price);
    html += card(
      'gv',
      shown,
      unit,
      singular ? item.singular : item.plural,
      item.note.replace('{price}', usd(item.price)),
      item.source,
    );
  }
  return html;
}

/**
 * The lede above the give. The two halves of the sentence are the whole argument.
 * The federal figure comes from the receipt file, never from a number typed here.
 */
export function giveLede(r: Breakdown, inputs: Inputs): string {
  const taxOverYears = r.total * inputs.years;
  const federal = RECEIPT.items.find((item) => item.id === 'federal-spending');
  const seconds = federal?.annualCost
    ? (taxOverYears / federal.annualCost) * SECONDS_IN_YEAR
    : 0;
  return (
    'The same ' +
    usd(taxOverYears) +
    '. To the federal government it bought ' +
    duration(seconds) +
    '. Handed over by you instead, it buys this.'
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
 * The ladder, cheapest first, with a waterline marking where the balance lands.
 * Everything above the line is bought back outright; the next few are shown short.
 *
 * The rungs measure freedom, not objects, so several of them are priced from the
 * reader's own take-home. That is why this needs the take-home passed in.
 */
export function stack(
  balance: number,
  inputs: Inputs,
  annualTakeHome: number,
): StackRender {
  const items = resolveLadder(inputs.stateIndex, annualTakeHome);
  const waterline =
    '<div class="waterline">' +
    '<span>Your balance after ' +
    inputs.years +
    ' ' +
    plural(inputs.years, 'year') +
    '</span>' +
    '<span class="num">' +
    usd(balance) +
    '</span>' +
    '</div>';

  let html = '';
  let cleared = 0;
  let shownLocked = 0;

  for (const item of items) {
    const count = Math.floor(balance / item.price);

    if (count >= 1) {
      cleared++;
      html +=
        '<div class="tier">' +
        '<span class="tier-count num">' +
        commas(count) +
        '<small>x</small></span>' +
        '<span class="tier-name">' +
        escapeHtml(count === 1 ? item.singular : item.plural) +
        '<span class="tier-note">' +
        escapeHtml(item.note) +
        '</span></span>' +
        '<span class="tier-price num">' +
        usd(item.price) +
        '</span>' +
        '</div>';
      continue;
    }

    if (shownLocked === 0) html += waterline;
    if (shownLocked < 3) {
      html +=
        '<div class="tier locked">' +
        '<span class="tier-count">short ' +
        usd(item.price - balance) +
        '</span>' +
        '<span class="tier-name">' +
        escapeHtml(item.singular) +
        '<span class="tier-note">' +
        escapeHtml(item.note) +
        '</span></span>' +
        '<span class="tier-price num">' +
        usd(item.price) +
        '</span>' +
        '</div>';
      shownLocked++;
    }
  }

  // Balance clears the whole ladder, so the waterline goes at the top.
  if (shownLocked === 0) html = waterline + html;

  return {
    html,
    lede:
      cleared === 0
        ? 'Not yet enough for anything on this list. Raise the income, the years, or the return.'
        : 'Invested instead of paid, the balance buys back ' +
          cleared +
          ' of the ' +
          items.length +
          ' rungs below.',
  };
}

/** The footnote under the ladder. Its date comes from the metals file. */
export function stackFootnote(): string {
  return (
    'A rung about your own time is priced at your take-home, held flat. ' +
    'Other prices are ' +
    TAX.taxYear +
    ' averages. The home is the median value in the state you picked above. ' +
    'Gold moves daily; this uses spot on ' +
    longDate(METALS.meta.updatedAt) +
    '.'
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
    ' US averages.'
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

/** The wording on the employer share checkbox. */
export function employerHint(): string {
  return (
    'Another ' +
    employerSharePctLabel() +
    " paid on top of your wage. It doesn't shrink your paycheck, it raises " +
    "what you cost — so it's counted against your full compensation, not your salary."
  );
}

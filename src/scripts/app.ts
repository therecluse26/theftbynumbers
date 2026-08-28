/**
 * The browser half of the page.
 *
 * Astro renders the opening state at build time. This script reads that state
 * back out of the DOM, then re-renders with the same functions whenever the
 * reader changes a control. Nothing is sent anywhere.
 */
import { ASSUMPTIONS, STATES } from '../lib/data';
import { commas } from '../lib/format';
import {
  basketHtml,
  childrenHint,
  dialSvg,
  earnersHint,
  emptyHeroText,
  heroText,
  investText,
  ledgerHtml,
  lifeCost,
  outlaysDonut,
  propertyTaxHint,
  receiptHtml,
  receiptLede,
  ribbon,
  roadsHtml,
  roadsLede,
  salesTaxHint,
  stack,
  statusEcho,
  tenureHint,
} from '../lib/render';
import { computeBreakdown, defaultInputs } from '../lib/tax';
import type { Inputs, StatusId, Tenure } from '../lib/types';
import { initDonutHover, refreshDonutHover } from './donut';

/* `Element`, not `HTMLElement`: the chart and its connector layer are SVG. */
function el<T extends Element = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error('Missing element: ' + id);
  // getElementById is typed HTMLElement, but an SVG node is not one.
  return node as unknown as T;
}

const dom = {
  income: el<HTMLInputElement>('income'),
  state: el<HTMLSelectElement>('state'),
  stateRate: el<HTMLInputElement>('stateRate'),
  stateRateVal: el('stateRateVal'),
  years: el<HTMLInputElement>('years'),
  yearsVal: el('yearsVal'),
  rate: el<HTMLInputElement>('rate'),
  rateVal: el('rateVal'),
  earnersField: el<HTMLElement>('earnersField'),
  earnersHint: el('earnersHint'),
  children: el<HTMLSelectElement>('children'),
  childrenHint: el('childrenHint'),
  tenureHint: el('tenureHint'),
  employer: el<HTMLInputElement>('employer'),
  sales: el<HTMLInputElement>('sales'),
  salesHint: el('salesHint'),
  property: el<HTMLInputElement>('property'),
  propertyHint: el('propertyHint'),
  statusEcho: el('statusEcho'),
  heroLabel: el('heroLabel'),
  heroFig: el('heroFig'),
  heroFoot: el('heroFoot'),
  dial: el('dial'),
  ribbonBand: el('ribbonBand'),
  ribbon: el('ribbon'),
  ribbonBase: el('ribbonBase'),
  keptPct: el('keptPct'),
  results: el('results'),
  empty: el('empty'),
  ledgerBody: el('ledgerBody'),
  buyGrid: el('buyGrid'),
  lifeFig: el('lifeFig'),
  lifeNote: el('lifeNote'),
  lifeWeek: el('lifeWeek'),
  lifeWeekNote: el('lifeWeekNote'),
  donutHost: el<HTMLElement>('donutHost'),
  donutSvg: el<SVGSVGElement>('donutSvg'),
  donutLegend: el<HTMLElement>('donutLegend'),
  donutLink: el<SVGSVGElement>('donutLink'),
  donutNote: el('donutNote'),
  receiptLede: el('receiptLede'),
  receiptGroups: el('receiptGroups'),
  yearsEcho: el('yearsEcho'),
  fvFig: el('fvFig'),
  fvNote: el('fvNote'),
  growthFig: el('growthFig'),
  growthNote: el('growthNote'),
  gainsNote: el('gainsNote'),
  chartNote: el('chartNote'),
  cmpHeading: el('cmpHeading'),
  cmpBody: el('cmpBody'),
  stackLede: el('stackLede'),
  stack: el('stack'),
  roadsLede: el('roadsLede'),
  roadsGroups: el('roadsGroups'),
};

/*
 * Scoped to #statusSeg on purpose. An unscoped '.seg button' would pick up
 * any other segmented control added to the page later, and clicking one would
 * clear the pressed filing status.
 */
const statusButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('#statusSeg button'),
);

const earnersButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('#earnersSeg button'),
);

const tenureButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('#tenureSeg button'),
);

const inputs: Inputs = defaultInputs();
const maxIncome = Number(dom.income.dataset.max) || ASSUMPTIONS.income.maxIncome;

/*
 * The minus sign is kept, not stripped. Stripping it turned a pasted -50000
 * into +50000 and the page charged tax on it. A negative wage has no meaning
 * here, so clampIncome sends it to zero and the empty state takes over.
 */
function parseMoney(value: string): number {
  const n = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : 0;
}

function clampIncome(n: number): number {
  return Math.min(Math.max(n, 0), maxIncome);
}

/** A restored control can be empty. Fall back rather than compute on NaN. */
function num(value: string, fallback: number): number {
  const n = parseFloat(value);
  return isFinite(n) ? n : fallback;
}

const defaults = defaultInputs();

/**
 * Browsers restore form values on a reload. Read the controls once at start,
 * so the page always agrees with what the reader can see.
 */
function readDom(): void {
  inputs.income = clampIncome(parseMoney(dom.income.value));
  const pressed = statusButtons.find(
    (b) => b.getAttribute('aria-pressed') === 'true',
  );
  if (pressed?.dataset.status) inputs.status = pressed.dataset.status as StatusId;
  const earners = earnersButtons.find(
    (b) => b.getAttribute('aria-pressed') === 'true',
  );
  inputs.earners = Number(earners?.dataset.earners) || defaults.earners;
  inputs.children = Math.max(0, Math.round(num(dom.children.value, defaults.children)));
  const tenure = tenureButtons.find(
    (b) => b.getAttribute('aria-pressed') === 'true',
  );
  inputs.tenure = (tenure?.dataset.tenure as Tenure) ?? defaults.tenure;
  inputs.stateIndex = Number(dom.state.value) || 0;
  inputs.stateRatePct = num(dom.stateRate.value, defaults.stateRatePct);
  inputs.years = Math.round(num(dom.years.value, defaults.years));
  inputs.returnPct = num(dom.rate.value, defaults.returnPct);
  inputs.countEmployerShare = dom.employer.checked;
  inputs.countSalesTax = dom.sales.checked;
  inputs.countPropertyTax = dom.property.checked;
}

/**
 * Write every label from `inputs`.
 *
 * Each listener used to write its own label. readDom() wrote none, so a value
 * the browser restored moved the arithmetic and left the labels behind: New
 * Jersey selected in the picker, and the hint beside it still reading "0.79% a
 * year on the $408,800 median home in United States". One function, called
 * from every path, is the only way that cannot happen.
 */
function syncLabels(): void {
  dom.stateRateVal.textContent = inputs.stateRatePct.toFixed(1) + '%';
  dom.yearsVal.textContent = String(inputs.years);
  dom.rateVal.textContent = inputs.returnPct.toFixed(1) + '%';
  // Ends in a source link, so it is HTML. render.ts builds it from escaped
  // data; nothing the reader types reaches it.
  dom.propertyHint.innerHTML = propertyTaxHint(inputs);
  dom.salesHint.innerHTML = salesTaxHint(inputs);
  dom.childrenHint.innerHTML = childrenHint(inputs);
  dom.tenureHint.textContent = tenureHint(inputs);
  for (const button of tenureButtons) {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.tenure === inputs.tenure),
    );
  }

  // Only a joint return can cover two earners.
  const joint = inputs.status === 'mfj';
  dom.earnersField.hidden = !joint;
  dom.earnersHint.textContent = earnersHint(inputs);
  for (const button of earnersButtons) {
    button.setAttribute(
      'aria-pressed',
      String(Number(button.dataset.earners) === inputs.earners),
    );
  }
}

function update(): void {
  dom.statusEcho.textContent = statusEcho(inputs);

  const live = inputs.income > 0;
  (dom.results as HTMLElement).hidden = !live;
  (dom.empty as HTMLElement).hidden = live;
  dom.ribbonBand.style.display = live ? '' : 'none';

  if (!live) {
    const hero = emptyHeroText(inputs);
    dom.heroLabel.innerHTML = hero.label;
    dom.heroFig.textContent = hero.figure;
    dom.heroFoot.innerHTML = hero.foot;
    dom.dial.innerHTML = dialSvg(0);
    // Section three is hidden now. Drop any highlight the reader was holding.
    refreshDonutHover();
    return;
  }

  const breakdown = computeBreakdown(inputs);
  const hero = heroText(breakdown, inputs);

  dom.heroLabel.innerHTML = hero.label;
  dom.heroFig.textContent = hero.figure;
  dom.heroFoot.innerHTML = hero.foot;
  dom.keptPct.textContent = hero.keptPct;
  dom.ribbonBase.textContent = hero.ribbonBase;

  dom.dial.innerHTML = dialSvg(breakdown.effectiveRate);

  const band = ribbon(breakdown, inputs);
  dom.ribbon.innerHTML = band.html;
  dom.ribbon.setAttribute('aria-label', band.ariaLabel);

  dom.ledgerBody.innerHTML = ledgerHtml(breakdown, inputs);
  dom.buyGrid.innerHTML = basketHtml(breakdown.total);

  const life = lifeCost(breakdown, inputs);
  dom.lifeFig.textContent = life.figure;
  dom.lifeNote.textContent = life.note;
  dom.lifeWeek.innerHTML = life.weekHtml;
  dom.lifeWeekNote.textContent = life.weekNote;
  const donut = outlaysDonut(breakdown, inputs);
  dom.donutSvg.innerHTML = donut.svg;
  dom.donutLegend.innerHTML = donut.legend;
  // The note ends in a source link, so it is HTML. render.ts builds it from
  // escaped data; nothing the reader types reaches it.
  dom.donutNote.innerHTML = donut.note;
  // Both halves were just replaced. Put the reader's highlight back on them.
  refreshDonutHover();

  dom.receiptLede.textContent = receiptLede(breakdown, inputs);
  dom.receiptGroups.innerHTML = receiptHtml(breakdown, inputs);

  const invest = investText(breakdown, inputs);
  dom.yearsEcho.textContent = String(inputs.years);
  dom.fvFig.textContent = invest.balance;
  dom.fvNote.textContent = invest.balanceNote;
  dom.growthFig.textContent = invest.growth;
  dom.growthNote.textContent = invest.growthNote;
  // Ends in a source link, like the donut note above.
  dom.gainsNote.innerHTML = invest.gainsNote;
  dom.chartNote.textContent = invest.chartNote;
  dom.cmpHeading.textContent = invest.heading;
  dom.cmpBody.innerHTML = invest.comparison;

  const ladder = stack(invest.balanceValue, inputs, breakdown.kept);
  dom.stack.innerHTML = ladder.html;
  dom.stackLede.textContent = ladder.lede;

  // Only one card in section six moves with the reader. Re-rendering the whole
  // section costs nothing and keeps one code path instead of two.
  dom.roadsLede.textContent = roadsLede();
  dom.roadsGroups.innerHTML = roadsHtml(breakdown, inputs);
}

/** "85000.5" becomes "85,000.50". A whole number keeps no cents. */
function formatIncome(amount: number): string {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  return cents > 0
    ? commas(whole) + '.' + String(cents).padStart(2, '0')
    : commas(whole);
}

dom.income.addEventListener('input', function () {
  const caretFromEnd = this.value.length - (this.selectionStart ?? this.value.length);
  // Clamp before writing back. The box used to show the unclamped number
  // while the page computed the clamped one, so 999,999,999 sat above a hero
  // reading "On $100,000,000 a year".
  const amount = clampIncome(parseMoney(this.value));
  inputs.income = amount;
  // A trailing "." or ".5" is a half-typed decimal. Reformatting now would
  // eat the character the reader just pressed, which made cents unenterable.
  const typingDecimal = /\.\d?$/.test(this.value.replace(/,/g, ''));
  if (!typingDecimal) {
    this.value = amount > 0 ? formatIncome(amount) : '';
    const caret = Math.max(0, this.value.length - caretFromEnd);
    try {
      this.setSelectionRange(caret, caret);
    } catch {
      /* the field is not always selectable */
    }
  }
  update();
});

/** Settle a half-typed "85000." once the reader leaves the field. */
dom.income.addEventListener('blur', function () {
  this.value = inputs.income > 0 ? formatIncome(inputs.income) : '';
});

for (const button of statusButtons) {
  button.addEventListener('click', () => {
    for (const other of statusButtons) {
      other.setAttribute('aria-pressed', String(other === button));
    }
    inputs.status = button.dataset.status as StatusId;
    syncLabels();
    update();
  });
}

for (const button of earnersButtons) {
  button.addEventListener('click', () => {
    inputs.earners = Number(button.dataset.earners) || 1;
    syncLabels();
    update();
  });
}

for (const button of tenureButtons) {
  button.addEventListener('click', () => {
    inputs.tenure = (button.dataset.tenure as Tenure) ?? 'own';
    syncLabels();
    update();
  });
}

/* Each listener sets `inputs`, then syncLabels() writes every label. */

dom.children.addEventListener('change', function () {
  inputs.children = Math.max(0, Math.round(num(this.value, defaults.children)));
  syncLabels();
  update();
});

dom.state.addEventListener('change', function () {
  inputs.stateIndex = Number(this.value);
  const rate = (STATES[inputs.stateIndex] ?? STATES[0]!).incomeTaxRatePct;
  inputs.stateRatePct = rate;
  dom.stateRate.value = String(rate);
  syncLabels();
  update();
});

dom.stateRate.addEventListener('input', function () {
  inputs.stateRatePct = num(this.value, defaults.stateRatePct);
  syncLabels();
  update();
});

dom.years.addEventListener('input', function () {
  inputs.years = Math.round(num(this.value, defaults.years));
  syncLabels();
  update();
});

dom.rate.addEventListener('input', function () {
  inputs.returnPct = num(this.value, defaults.returnPct);
  syncLabels();
  update();
});

dom.employer.addEventListener('change', function () {
  inputs.countEmployerShare = this.checked;
  update();
});

dom.sales.addEventListener('change', function () {
  inputs.countSalesTax = this.checked;
  update();
});

dom.property.addEventListener('change', function () {
  inputs.countPropertyTax = this.checked;
  update();
});

/*
 * Back-button and bfcache returns restore the controls without firing an
 * input event. Read them again, or the page shows one state and computes
 * another.
 */
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  readDom();
  syncLabels();
  update();
});

initDonutHover(dom.donutHost, dom.donutSvg, dom.donutLegend, dom.donutLink);

readDom();
syncLabels();
update();

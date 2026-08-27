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
  dialSvg,
  emptyHeroText,
  heroText,
  investText,
  ledgerHtml,
  lifeCost,
  outlaysDonut,
  receiptHtml,
  receiptLede,
  ribbon,
  roadsHtml,
  roadsLede,
  stack,
  statusEcho,
} from '../lib/render';
import { computeBreakdown, defaultInputs } from '../lib/tax';
import type { Inputs, StatusId } from '../lib/types';
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
  employer: el<HTMLInputElement>('employer'),
  sales: el<HTMLInputElement>('sales'),
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
  chartNote: el('chartNote'),
  cmpHeading: el('cmpHeading'),
  cmpBody: el('cmpBody'),
  stackLede: el('stackLede'),
  stack: el('stack'),
  roadsLede: el('roadsLede'),
  roadsGroups: el('roadsGroups'),
};

const statusButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('.seg button'),
);

const inputs: Inputs = defaultInputs();
const maxIncome = Number(dom.income.dataset.max) || ASSUMPTIONS.income.maxIncome;

function parseMoney(value: string): number {
  const n = parseFloat(value.replace(/[^0-9.]/g, ''));
  return isFinite(n) ? n : 0;
}

/**
 * Browsers restore form values on a reload. Read the controls once at start,
 * so the page always agrees with what the reader can see.
 */
function readDom(): void {
  inputs.income = Math.min(parseMoney(dom.income.value), maxIncome);
  const pressed = statusButtons.find(
    (b) => b.getAttribute('aria-pressed') === 'true',
  );
  if (pressed?.dataset.status) inputs.status = pressed.dataset.status as StatusId;
  inputs.stateIndex = Number(dom.state.value) || 0;
  inputs.stateRatePct = parseFloat(dom.stateRate.value);
  inputs.years = parseInt(dom.years.value, 10);
  inputs.returnPct = parseFloat(dom.rate.value);
  inputs.countEmployerShare = dom.employer.checked;
  inputs.countSalesTax = dom.sales.checked;
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

  const band = ribbon(breakdown);
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
  dom.donutNote.textContent = donut.note;
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

dom.income.addEventListener('input', function () {
  const caretFromEnd = this.value.length - (this.selectionStart ?? this.value.length);
  const amount = parseMoney(this.value);
  inputs.income = Math.min(amount, maxIncome);
  this.value = amount > 0 ? commas(Math.round(amount)) : '';
  const caret = Math.max(0, this.value.length - caretFromEnd);
  try {
    this.setSelectionRange(caret, caret);
  } catch {
    /* the field is not always selectable */
  }
  update();
});

for (const button of statusButtons) {
  button.addEventListener('click', () => {
    for (const other of statusButtons) {
      other.setAttribute('aria-pressed', String(other === button));
    }
    inputs.status = button.dataset.status as StatusId;
    update();
  });
}

dom.state.addEventListener('change', function () {
  inputs.stateIndex = Number(this.value);
  const rate = (STATES[inputs.stateIndex] ?? STATES[0]!).incomeTaxRatePct;
  inputs.stateRatePct = rate;
  dom.stateRate.value = String(rate);
  dom.stateRateVal.textContent = rate.toFixed(1) + '%';
  update();
});

dom.stateRate.addEventListener('input', function () {
  inputs.stateRatePct = parseFloat(this.value);
  dom.stateRateVal.textContent = inputs.stateRatePct.toFixed(1) + '%';
  update();
});

dom.years.addEventListener('input', function () {
  inputs.years = parseInt(this.value, 10);
  dom.yearsVal.textContent = String(inputs.years);
  update();
});

dom.rate.addEventListener('input', function () {
  inputs.returnPct = parseFloat(this.value);
  dom.rateVal.textContent = inputs.returnPct.toFixed(1) + '%';
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

initDonutHover(dom.donutHost, dom.donutSvg, dom.donutLegend, dom.donutLink);

readDom();
update();

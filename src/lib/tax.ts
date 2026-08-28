/** The tax arithmetic. Every rate and threshold comes from src/data. */
import { ASSUMPTIONS, EMPLOYER_SHARE_RATE, STATES, TAX, basketPrice } from './data';
import type { Breakdown, Inputs, StatusId } from './types';

/** Tax on taxable income, bracket by bracket. */
export function federalTax(taxable: number, status: StatusId): number {
  if (taxable <= 0) return 0;
  const table = TAX.brackets[status];
  let owed = 0;
  for (let i = 0; i < table.length; i++) {
    const lower = table[i]!.from;
    if (taxable <= lower) break;
    const upper = i + 1 < table.length ? table[i + 1]!.from : Infinity;
    owed += (Math.min(taxable, upper) - lower) * table[i]!.rate;
  }
  return owed;
}

/**
 * The part of a wage the Social Security tax applies to.
 *
 * The wage base is per worker, not per return. A joint return covering two
 * earners gets two of them. Splitting the wage evenly is the only assumption
 * the page can make, because it never asks who earned what; it is exact when
 * the two earn alike and understates when they do not.
 *
 * Every caller goes through here. The wage base used to be applied to the
 * combined income in two separate places, and a two-earner couple at $300,000
 * was charged $11,439 where the truth is $18,600.
 */
function socialSecurityWage(wage: number, earners: number): number {
  const n = Math.max(1, earners);
  return Math.min(wage / n, TAX.payroll.socialSecurity.wageBase) * n;
}

/**
 * The child tax credit, after its phase-out.
 *
 * The statute cuts the credit by $50 for each $1,000 of income over the
 * threshold, "or fraction thereof", which is why the step is rounded up.
 */
export function childTaxCredit(
  wage: number,
  status: StatusId,
  children: number,
): number {
  const c = TAX.credits.childTaxCredit;
  if (children <= 0) return 0;
  const over = Math.max(0, wage - c.phaseOutStart[status]);
  const cut = Math.ceil(over / c.phaseOutStep) * c.phaseOutPerStep;
  return Math.max(0, c.perChild * children - cut);
}

export function computeBreakdown(inputs: Inputs): Breakdown {
  const { socialSecurity, medicare } = TAX.payroll;
  const wage = inputs.income;

  const taxable = Math.max(0, wage - TAX.standardDeduction[inputs.status]);
  // The credit is modelled as nonrefundable: it stops at zero tax and never
  // becomes a refund. Letting `federal` go negative would carry the sign into
  // employeeTax, total and federalTotal, and the donut would print negative
  // dollars and negative months of life across all ten slices.
  const childCredit = childTaxCredit(wage, inputs.status, inputs.children);
  const federal = Math.max(0, federalTax(taxable, inputs.status) - childCredit);
  const ss = socialSecurityWage(wage, inputs.earners) * socialSecurity.rate;
  const med =
    wage * medicare.rate +
    Math.max(0, wage - medicare.additionalThreshold[inputs.status]) *
      medicare.additionalRate;
  const state = wage * (inputs.stateRatePct / 100);

  // One row, read once, for both of the taxes that depend on where you live.
  const stateRow = STATES[inputs.stateIndex];

  // Taxes taken out of your wage. These are the only ones your paycheck feels.
  const employeeTax = federal + ss + med + state;
  const afterDirect = Math.max(0, wage - employeeTax);

  // The rate is the state's own combined state and average local rate, not a
  // national constant. Delaware, Montana, New Hampshire and Oregon levy none,
  // and a reader in one of them used to be charged it anyway.
  const salesTax = inputs.countSalesTax && stateRow
    ? afterDirect * ASSUMPTIONS.salesTax.spendShare * (stateRow.salesTaxRatePct / 100)
    : 0;

  // Property tax. It is not withheld and it never ends. Like sales tax, it is
  // paid out of the wage, so it does not enlarge the base.
  //
  // An owner pays it on the median home in the chosen state: owed every year,
  // on a house already owned outright. A renter pays it inside the rent, where
  // the landlord owes it and the tenant funds it. Charging every reader the
  // owner's bill put $10,507 of tax on a New Jersey renter's $30,000 wage.
  const propertyTax = !inputs.countPropertyTax || !stateRow
    ? 0
    : inputs.tenure === 'own'
      ? stateRow.medianHomeValue * (stateRow.propertyTaxRatePct / 100)
      : basketPrice('rent-month') * 12 * ASSUMPTIONS.propertyTax.rentTaxShare;

  // The employer's share never passes through your wage. On the standard
  // incidence argument it is money that would otherwise have been paid to you,
  // so it enlarges the base rather than shrinking the take-home.
  const employerShare = inputs.countEmployerShare
    ? socialSecurityWage(wage, inputs.earners) * socialSecurity.rate +
      wage * medicare.rate
    : 0;
  const base = wage + employerShare;

  // Everything the employment relationship costs in tax. Sales tax is absent
  // on purpose: your employer never pays it, so it cannot be a share of what
  // you cost them.
  const employmentTax = employeeTax + employerShare;
  const total = employmentTax + salesTax + propertyTax;

  // The part of the bill that reaches Washington. State, sales and property tax
  // are deliberately absent: they fund no federal outlay, so they cannot enlarge
  // the reader's share of one. Sections three and six divide this, never total.
  const federalTotal = federal + ss + med + employerShare;

  return {
    wage,
    base,
    taxable,
    federal,
    childCredit,
    socialSecurity: ss,
    medicare: med,
    state,
    employerShare,
    salesTax,
    propertyTax,
    employeeTax,
    employmentTax,
    federalTotal,
    total,
    // Sales tax comes out of this later. It is not withheld, so it does not
    // change what the paycheck nets.
    takeHomePay: afterDirect,
    // Not clamped at zero. Property tax is charged on a house, not on a
    // paycheck, so at a low income in a high-property-tax state the bill
    // passes the whole wage and this goes negative. That is the truth, and
    // the copy branches on `exceedsBase` to say it.
    kept: wage - employeeTax - salesTax - propertyTax,
    effectiveRate: base > 0 ? total / base : 0,
    employmentRate: base > 0 ? employmentTax / base : 0,
    exceedsBase: base > 0 && total > base,
  };
}

/**
 * Federal tax on a long-term gain, if it were all realised in one year.
 *
 * The gain stacks on top of ordinary taxable income, which is how the statute
 * works: the ordinary income fills the lower bands first, and the gain is
 * taxed in whatever is left. The net investment income tax adds 3.8% on the
 * part of the gain above its own threshold.
 *
 * Nothing on this page is reduced by this figure. It is computed only so the
 * invest section can say out loud what its own number does not deduct.
 */
export function capitalGainsTax(
  ordinaryTaxable: number,
  gain: number,
  status: StatusId,
): number {
  if (gain <= 0) return 0;
  const { longTerm, netInvestmentIncomeRate, netInvestmentIncomeThreshold } =
    TAX.capitalGains;
  const table = longTerm[status];

  const start = Math.max(0, ordinaryTaxable);
  const end = start + gain;
  let owed = 0;
  for (let i = 0; i < table.length; i++) {
    const lower = table[i]!.from;
    const upper = i + 1 < table.length ? table[i + 1]!.from : Infinity;
    // The slice of this band that the gain actually occupies.
    const from = Math.max(start, lower);
    const to = Math.min(end, upper);
    if (to > from) owed += (to - from) * table[i]!.rate;
  }

  // The surtax runs on modified adjusted gross income, which this page does
  // not model. Ordinary taxable income plus the gain is the closest it has.
  const over = Math.max(0, end - netInvestmentIncomeThreshold[status]);
  owed += Math.min(gain, over) * netInvestmentIncomeRate;

  return owed;
}

/** Three running totals at the end of each year. */
export interface SeriesPoint {
  year: number;
  /** The tax, invested and compounded. */
  balance: number;
  /** The tax, added up. No return on it. */
  contributed: number;
  /** Your pay after tax, added up. No return on it either. */
  takeHome: number;
}

/**
 * Pay the yearly amount at the start of the year, then earn on it.
 *
 * The take-home total is a plain sum. That money reached you and you spent it
 * or saved it as you liked. This page does not invest it for you.
 */
export function investmentSeries(
  yearly: number,
  ratePct: number,
  years: number,
  takeHomePerYear: number,
): SeriesPoint[] {
  const rate = ratePct / 100;
  const out: SeriesPoint[] = [{ year: 0, balance: 0, contributed: 0, takeHome: 0 }];
  let balance = 0;
  for (let year = 1; year <= years; year++) {
    balance = (balance + yearly) * (1 + rate);
    out.push({
      year,
      balance,
      contributed: yearly * year,
      takeHome: takeHomePerYear * year,
    });
  }
  return out;
}

/**
 * The opening state, before the reader touches a control.
 *
 * State index 0 is the national row. It carries the median state rate, not a
 * zero, so a reader who never opens the picker is charged what a typical state
 * charges. Sales and property tax start on for the same reason: both are owed
 * in almost every state, so leaving them off opens on a bill that is too low.
 * The employer's share starts off, because it never passes through the wage.
 */
export function defaultInputs(): Inputs {
  return {
    income: ASSUMPTIONS.income.defaultIncome,
    status: TAX.filingStatuses[0]!.id,
    earners: ASSUMPTIONS.earners.defaultEarners,
    children: ASSUMPTIONS.dependents.defaultChildren,
    // Own, deliberately. It is the larger of the two bills, so it does not
    // flatter the headline by defaulting to the smaller one.
    tenure: 'own',
    stateIndex: 0,
    stateRatePct: STATES[0]!.incomeTaxRatePct,
    years: ASSUMPTIONS.horizon.defaultYears,
    returnPct: ASSUMPTIONS.investment.defaultAnnualReturnPct,
    countEmployerShare: false,
    countSalesTax: true,
    countPropertyTax: true,
  };
}

/**
 * 0.0765 becomes "7.65%". Used in the copy about the employer's share.
 *
 * The statutory rate is 7.65%, but the Social Security half stops at the wage
 * base. Above that, the employer pays less than 7.65% of the whole wage, so a
 * flat label would overstate the rate for a high earner. Pass the wage and the
 * label reports what the employer actually paid on it.
 *
 * `earners` matters for the same reason it matters in computeBreakdown: two
 * earners get two wage bases, so a joint wage clears the cap later.
 */
export function employerSharePctLabel(wage?: number, earners = 1): string {
  const { medicare } = TAX.payroll;
  let rate = EMPLOYER_SHARE_RATE;
  if (wage && wage > 0) {
    const paid =
      socialSecurityWage(wage, earners) * TAX.payroll.socialSecurity.rate +
      wage * medicare.rate;
    rate = paid / wage;
  }
  return (rate * 100).toFixed(2).replace(/0$/, '') + '%';
}

/** The tax arithmetic. Every rate and threshold comes from src/data. */
import { ASSUMPTIONS, EMPLOYER_SHARE_RATE, STATES, TAX } from './data';
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

export function computeBreakdown(inputs: Inputs): Breakdown {
  const { socialSecurity, medicare } = TAX.payroll;
  const wage = inputs.income;

  const taxable = Math.max(0, wage - TAX.standardDeduction[inputs.status]);
  const federal = federalTax(taxable, inputs.status);
  const ss = Math.min(wage, socialSecurity.wageBase) * socialSecurity.rate;
  const med =
    wage * medicare.rate +
    Math.max(0, wage - medicare.additionalThreshold[inputs.status]) *
      medicare.additionalRate;
  const state = wage * (inputs.stateRatePct / 100);

  // Taxes taken out of your wage. These are the only ones your paycheck feels.
  const employeeTax = federal + ss + med + state;
  const afterDirect = Math.max(0, wage - employeeTax);
  const salesTax = inputs.countSalesTax
    ? afterDirect * ASSUMPTIONS.salesTax.spendShare * ASSUMPTIONS.salesTax.combinedRate
    : 0;

  // The employer's share never passes through your wage. On the standard
  // incidence argument it is money that would otherwise have been paid to you,
  // so it enlarges the base rather than shrinking the take-home.
  const employerShare = inputs.countEmployerShare
    ? Math.min(wage, socialSecurity.wageBase) * socialSecurity.rate +
      wage * medicare.rate
    : 0;
  const base = wage + employerShare;

  // Everything the employment relationship costs in tax. Sales tax is absent
  // on purpose: your employer never pays it, so it cannot be a share of what
  // you cost them.
  const employmentTax = employeeTax + employerShare;
  const total = employmentTax + salesTax;

  return {
    wage,
    base,
    taxable,
    federal,
    socialSecurity: ss,
    medicare: med,
    state,
    employerShare,
    salesTax,
    employeeTax,
    employmentTax,
    total,
    // Sales tax comes out of this later. It is not withheld, so it does not
    // change what the paycheck nets.
    takeHomePay: afterDirect,
    kept: Math.max(0, wage - employeeTax - salesTax),
    effectiveRate: base > 0 ? total / base : 0,
    employmentRate: base > 0 ? employmentTax / base : 0,
  };
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

export function defaultInputs(): Inputs {
  return {
    income: ASSUMPTIONS.income.defaultIncome,
    status: TAX.filingStatuses[0]!.id,
    stateIndex: 0,
    stateRatePct: STATES[0]!.incomeTaxRatePct,
    years: ASSUMPTIONS.horizon.defaultYears,
    returnPct: ASSUMPTIONS.investment.defaultAnnualReturnPct,
    countEmployerShare: false,
    countSalesTax: false,
  };
}

/** 0.0765 becomes "7.65%". Used in the copy about the employer's share. */
export function employerSharePctLabel(): string {
  return (EMPLOYER_SHARE_RATE * 100).toFixed(2).replace(/0$/, '') + '%';
}

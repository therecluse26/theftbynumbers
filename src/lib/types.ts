/**
 * Shapes of the JSON data files, and of the inputs the reader controls.
 * The JSON Schemas in /schemas are the contract for the update job.
 * These types are the contract for the site. Keep the two in step.
 */

export type StatusId = 'single' | 'mfj' | 'hoh';

export interface FieldProvenance {
  updateMode: 'fetch' | 'manual';
  updater?: string;
  label: string;
  url: string;
  maxAgeDays: number;
  updatedAt: string;
  note?: string;
}

export interface DataMeta {
  updatedAt: string;
  fields: Record<string, FieldProvenance>;
}

export interface FilingStatus {
  id: StatusId;
  name: string;
  shortName: string;
  who: string;
  whoObject: string;
}

export interface Bracket {
  from: number;
  rate: number;
}

export type ByStatus = Record<StatusId, number>;

export interface FederalTaxData {
  meta: DataMeta;
  taxYear: number;
  filingStatuses: FilingStatus[];
  brackets: Record<StatusId, Bracket[]>;
  standardDeduction: ByStatus;
  payroll: {
    socialSecurity: { rate: number; wageBase: number };
    medicare: {
      rate: number;
      additionalRate: number;
      additionalThreshold: ByStatus;
    };
  };
}

export interface StateRow {
  id: string;
  name: string;
  selectLabel?: string;
  isNational?: boolean;
  incomeTaxRatePct: number;
  medianHomeValue: number;
}

export interface StatesData {
  meta: DataMeta;
  states: StateRow[];
}

export interface MetalsData {
  meta: DataMeta;
  gold: { usdPerTroyOz: number };
}

export interface BasketItem {
  id: string;
  singular: string;
  plural: string;
  price: number;
  note: string;
  source?: { label: string; url: string };
}

export interface BasketData {
  meta: DataMeta;
  items: BasketItem[];
}

export type PriceRef =
  | 'metals.gold.usdPerTroyOz'
  | 'state.medianHomeValue'
  | 'basket.college-year'
  | 'charity.life-amf'
  /** The reader's own take-home. A rung priced this way costs them their own life. */
  | 'reader.annualTakeHome'
  | 'reader.monthlyTakeHome';

export interface LadderItem {
  id: string;
  singular: string;
  plural: string;
  singularInState?: string;
  pluralInState?: string;
  price?: number;
  priceFrom?: { ref: PriceRef; multiplier: number };
  note: string;
}

export interface LadderData {
  meta: DataMeta;
  items: LadderItem[];
}

/**
 * A receipt card. The kind decides which fields carry the number.
 *
 *   duration  your tax funds this yearly cost for a length of time
 *   unit      how many of these your tax comes to
 *   share     your tax as a share of one lump sum
 *   fact      no arithmetic; a finding that stands on its own
 *   computed  worked out in code from the reader's own figures
 */
export type ReceiptKind = 'duration' | 'unit' | 'share' | 'fact' | 'computed';

/** Names a function in render.ts. Add the case there before adding a value here. */
export type ReceiptCompute = 'social-security';

export interface ReceiptItem {
  id: string;
  group: string;
  kind: ReceiptKind;
  label?: string;
  singular?: string;
  plural?: string;
  annualCost?: number;
  price?: number;
  total?: number;
  figure?: string;
  compute?: ReceiptCompute;
  note: string;
  source?: { label: string; url: string };
}

export interface ReceiptGroup {
  id: string;
  title: string;
  lede: string;
}

export interface ReceiptData {
  meta: DataMeta;
  groups: ReceiptGroup[];
  items: ReceiptItem[];
}

export interface CharityItem {
  id: string;
  singular: string;
  plural: string;
  price: number;
  note: string;
  source: { label: string; url: string };
}

export interface CharityData {
  meta: DataMeta;
  items: CharityItem[];
}

export interface AssumptionsData {
  meta: DataMeta;
  salesTax: { spendShare: number; combinedRate: number };
  investment: {
    defaultAnnualReturnPct: number;
    minAnnualReturnPct: number;
    maxAnnualReturnPct: number;
    stepAnnualReturnPct: number;
  };
  horizon: { defaultYears: number; minYears: number; maxYears: number };
  income: { defaultIncome: number; maxIncome: number };
  stateRateSlider: { minPct: number; maxPct: number; stepPct: number };
}

/** Everything the reader can change. */
export interface Inputs {
  income: number;
  status: StatusId;
  stateIndex: number;
  stateRatePct: number;
  years: number;
  returnPct: number;
  countEmployerShare: boolean;
  countSalesTax: boolean;
}

/** One year of tax, worked out from the inputs. */
export interface Breakdown {
  wage: number;
  /** Wage, plus the employer's share when that option is on. */
  base: number;
  taxable: number;
  federal: number;
  socialSecurity: number;
  medicare: number;
  state: number;
  employerShare: number;
  salesTax: number;
  /** The taxes your paycheck feels. */
  employeeTax: number;
  total: number;
  kept: number;
  /** Total tax as a share of base. */
  effectiveRate: number;
}

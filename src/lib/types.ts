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
  /** Yearly property tax as a percentage of home value. */
  propertyTaxRatePct: number;
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
  | 'basket.childcare-month'
  /**
   * The reader's own take-home. A rung priced this way costs them their own life.
   * Years only: a multiplier of 0.25 is three months. One time unit keeps the
   * ladder from listing the same idea twice at two scales.
   */
  | 'reader.annualTakeHome';

/**
 * A band of the ladder. Groups sort by who the rung is for, not by what it costs,
 * so a saved life and a paid-off home never sit next to each other by accident.
 *
 * There used to be a `charity.life-amf` price ref, so one rung of the ladder was
 * priced from the give file. The give is now a group of this same ladder, which
 * means the ref would have put the same figure on the page twice.
 */
export interface LadderGroup {
  id: string;
  title: string;
  lede: string;
  /** When true, every charity item joins this group, priced in with its rungs. */
  includesCharity?: boolean;
  /** A caveat printed under this group's rungs. */
  footnote?: string;
  /** The link that substantiates the footnote. Rendered at the end of it. */
  footnoteSource?: { label: string; url: string };
}

export interface LadderItem {
  id: string;
  group: string;
  singular: string;
  plural: string;
  singularInState?: string;
  pluralInState?: string;
  price?: number;
  priceFrom?: { ref: PriceRef; multiplier: number };
  note: string;
  /**
   * Who published the price, or the claim in the note. A rung with a priceFrom
   * block takes its price from another file, which carries its own source, so
   * it needs one here only when the note itself makes a claim.
   */
  source?: { label: string; url: string };
}

export interface LadderData {
  meta: DataMeta;
  groups: LadderGroup[];
  items: LadderItem[];
}

/**
 * A receipt card. The kind decides which fields carry the number.
 *
 *   duration   your tax funds this yearly cost for a length of time
 *   unit       how many of these your tax comes to
 *   household  one lump sum, split evenly across every US household
 *   fact       no arithmetic; a finding that stands on its own
 *   computed   worked out in code from the reader's own figures
 *
 * There used to be a `share` kind: the reader's tax as a percentage of a
 * national lump sum. It printed things like "0.0000041%", which tells nobody
 * anything. `household` replaces it with a dollar figure a person can picture.
 */
export type ReceiptKind = 'duration' | 'unit' | 'household' | 'fact' | 'computed';

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
  /** US households. The denominator for every household card. */
  households: number;
  groups: ReceiptGroup[];
  items: ReceiptItem[];
}

export interface OutlayCategory {
  id: string;
  name: string;
  agency?: string;
  amount: number;
  note: string;
  source?: { label: string; url: string };
}

export interface OutlaysData {
  meta: DataMeta;
  fiscalYear: number;
  totalOutlays: number;
  categories: OutlayCategory[];
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

/**
 * A section six card. The kind decides which fields carry the number.
 *
 *   multiple  one unit bought twice; prints how many times more the state paid
 *   record    one figure that stands on its own, with no arithmetic
 *   reader    worked out in code from the reader's own tax
 *
 * The first version of this section had only `multiple`. That shape could not
 * hold the strongest answers to the question, which are not price comparisons
 * at all: that private companies built America's first roads, that Swedes still
 * maintain two thirds of theirs, and that transport is under two cents of the
 * federal dollar. Those are `record` cards now.
 */
export type RoadsKind = 'multiple' | 'record' | 'reader';

/** Names a function in render.ts. Add the case there before adding a value here. */
export type RoadsCompute = 'roads-share';

export interface RoadsItem {
  id: string;
  group: string;
  kind: RoadsKind;
  /** Reads after the figure: "18× | more, per kilogram carried to low Earth orbit". */
  label: string;
  /**
   * Multiple cards. privatePrice must be the lower of the two; validation
   * refuses the other way round, because a card reading "0.8× more" contradicts
   * the heading above it.
   */
  publicPrice?: number;
  privatePrice?: number;
  /**
   * Multiple cards, and required on every one. One sentence naming what makes
   * the two sides the same job. It prints first, ahead of the prices.
   *
   * A card once said police cost 5.3× more per officer, then conceded in its own
   * note that a guard cannot arrest anyone. The critic answers "exactly, it is
   * not the same job" and wins. This field forces the author to earn the
   * comparison before making it. If the sentence cannot be written, the unit is
   * wrong; find a narrower one or drop the card.
   */
  sameness?: string;
  /** Record cards. Printed exactly as written. No arithmetic is applied. */
  figure?: string;
  /** Reader cards. */
  compute?: RoadsCompute;
  /** Shown under the sameness sentence. Multiple cards use {public} and {private}. */
  note: string;
  source?: { label: string; url: string };
  publicSource?: { label: string; url: string };
  privateSource?: { label: string; url: string };
}

export interface RoadsGroup {
  id: string;
  title: string;
  lede: string;
}

export interface RoadsData {
  meta: DataMeta;
  lede: string;
  /** The honest limits of the comparison, printed under the last group. */
  caveat: string;
  groups: RoadsGroup[];
  items: RoadsItem[];
}

export interface AssumptionsData {
  meta: DataMeta;
  salesTax: { spendShare: number; combinedRate: number };
  investment: {
    defaultAnnualReturnPct: number;
    minAnnualReturnPct: number;
    maxAnnualReturnPct: number;
    stepAnnualReturnPct: number;
    /** Share of a pot drawn each year without exhausting it. */
    safeWithdrawalRate: number;
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
  countPropertyTax: boolean;
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
  /**
   * A year of property tax on the median home in the chosen state. Owed on a
   * home owned outright, every year, for as long as you hold it.
   */
  propertyTax: number;
  /** The taxes your paycheck feels. */
  employeeTax: number;
  /**
   * Tax that passes through the employment relationship: what is withheld from
   * your wage, plus the employer's share. Sales tax is not part of it, because
   * your employer never pays it.
   */
  employmentTax: number;
  total: number;
  /** What the paycheck nets: wage less withholdings. Sales tax is spent later. */
  takeHomePay: number;
  /** What is left after every tax on this page, sales tax included. */
  kept: number;
  /** Total tax as a share of base. */
  effectiveRate: number;
  /**
   * employmentTax as a share of base. This is the only honest rate to quote
   * against your cost to your employer.
   */
  employmentRate: number;
}

/**
 * Shapes of the JSON data files, and of the inputs the reader controls.
 * The JSON Schemas in /schemas are the contract for the update job.
 * These types are the contract for the site. Keep the two in step.
 */

export type StatusId = 'single' | 'mfj' | 'hoh';

/** One publisher and the page that states the figure. */
export interface SourceLink {
  label: string;
  url: string;
}

/**
 * What a claim cites: one publisher, or several.
 *
 * A card that only says what a program does argues the other side's case. Every
 * card that names government spending must also say what that spending costs
 * now against what it cost before, and the two figures rarely come from one
 * publisher. Treasury has the amount; CBO, CMS, GAO or NCES has the trend.
 */
export type SourceRef = SourceLink | SourceLink[];

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
  credits: {
    childTaxCredit: {
      perChild: number;
      phaseOutStart: ByStatus;
      phaseOutStep: number;
      phaseOutPerStep: number;
    };
  };
  /**
   * Long-term rates, and the net investment income surtax.
   *
   * Used only to state what the invested pot would owe. No figure on the page
   * is reduced by it. The surtax thresholds are statutory and unindexed.
   */
  capitalGains: {
    longTerm: Record<StatusId, Bracket[]>;
    netInvestmentIncomeRate: number;
    netInvestmentIncomeThreshold: ByStatus;
  };
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
  /**
   * Combined state and average local sales tax rate.
   *
   * Sales tax used to be one national constant applied to every reader, so an
   * Oregon reader was charged $1,703 a year of a tax Oregon does not levy.
   */
  salesTaxRatePct: number;
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
 *   yearly     your share of a yearly national cost, over your years
 *   unit       how many of these your tax comes to
 *   lump       your share of one cumulative total, counted once
 *   fact       no arithmetic; a finding that stands on its own
 *   computed   worked out in code from the reader's own figures
 *
 * There used to be a `share` kind: the reader's tax as a percentage of a
 * national lump sum. It printed things like "0.0000041%", which tells nobody
 * anything. A `household` kind replaced it, dividing the lump sum evenly across
 * every US household.
 *
 * `lump` replaces `household` in turn. A flat split barely moved when the reader
 * changed their income, so half the receipt sat still while the other half
 * responded, and two neighboring cards meant two different things by "your
 * share". Every money card now divides by the same thing: the part of every
 * federal dollar this reader pays. See federalDollarShare() in render.ts.
 *
 * `duration` survives only in the `scale` group, where the second is the unit
 * the group lede declares. Elsewhere it produced cards reading "2.5 minutes of
 * the money stolen every year", which parses as minutes of money. A rule in
 * semanticErrors refuses one in any other group.
 */
export type ReceiptKind =
  | 'duration'
  | 'yearly'
  | 'unit'
  | 'lump'
  | 'fact'
  | 'computed';

/** Names a function in render.ts. Add the case there before adding a value here. */
export type ReceiptCompute = 'social-security';

export interface ReceiptItem {
  id: string;
  group: string;
  kind: ReceiptKind;
  label?: string;
  singular?: string;
  plural?: string;
  /** Dollars a year. On a duration card and on a yearly card. */
  annualCost?: number;
  price?: number;
  /** One cumulative total, not a yearly rate. Only on a lump card. */
  total?: number;
  figure?: string;
  compute?: ReceiptCompute;
  note: string;
  source?: SourceRef;
}

export interface ReceiptGroup {
  id: string;
  title: string;
  lede: string;
}

/*
 * There used to be a `households` count here, the denominator for every
 * household card. Nothing divides by it now; see the note on ReceiptKind.
 */
export interface ReceiptData {
  meta: DataMeta;
  groups: ReceiptGroup[];
  items: ReceiptItem[];
}

export interface OutlayCategory {
  id: string;
  name: string;
  agency?: string;
  amount: number;
  /**
   * What the money does, then what it costs now against what it cost before.
   * A slice that only names the job reads as a defense of the spending.
   */
  note: string;
  source?: SourceRef;
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
 * maintain two thirds of theirs, and that transportation is under two cents of the
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
  /** The rate is per state, in states.json. Only the spend share is national. */
  salesTax: { spendShare: number };
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
  /** The hero gauge's scale. A chart bound, so it carries no provenance. */
  dial: { maxRatePct: number };
  /** How many people a joint return covers. A count, so no provenance. */
  earners: { defaultEarners: number; maxEarners: number };
  /** How many children the picker offers. A count, so no provenance. */
  dependents: { defaultChildren: number; maxChildren: number };
  /** The renter branch: the property tax line inside a rent dollar. */
  propertyTax: { rentTaxShare: number };
}

/** Own the home, or rent it. It decides which property tax bill applies. */
export type Tenure = 'own' | 'rent';

/** Everything the reader can change. */
export interface Inputs {
  income: number;
  status: StatusId;
  /**
   * How many people earned the income. Only a joint return can have two.
   *
   * The Social Security wage base is per worker, not per return. A couple who
   * each earn $150,000 owe two full wage bases, not one. Applying one base to
   * the combined income understated their Social Security tax by $7,161.
   */
  earners: number;
  /**
   * Children who qualify for the child tax credit.
   *
   * Head of household filing status requires a qualifying person, so a head of
   * household with children used to be charged federal income tax a real
   * return would not have: $2,748 at $50,000 with two children, where the
   * truth is nothing.
   */
  children: number;
  /**
   * Whether the reader owns their home or rents it.
   *
   * An owner is charged the tax on the state's median home. A renter is
   * charged the property tax line inside a year of average rent. Everybody
   * used to get the owner's bill, so a $30,000 renter in New Jersey was
   * charged $10,507 of tax on a house they do not have.
   */
  tenure: Tenure;
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
  /** Federal income tax, after the child tax credit. Never below zero. */
  federal: number;
  /**
   * The child tax credit that was applied, after its phase-out.
   *
   * Exposed so the ledger can name it rather than work it out again. The
   * refundable part is not modelled, so a reader owed a refund sees zero, not
   * a negative number.
   */
  childCredit: number;
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
  /**
   * Every tax on this page that reaches Washington: federal income tax, both
   * payroll taxes, and the employer's half when that box is on.
   *
   * Not `federal`, which is income tax alone. Not `total`, which adds state,
   * sales and property tax. Sections three and six divide federal spending, so
   * this is the only honest numerator for them: a Californian's state tax
   * funded no federal outlay and must not enlarge their share of one.
   *
   * `total` stays the numerator for the hero, the ledger, the basket, the
   * invest chart and the ladder. Those describe the reader's whole bill and
   * make no claim about where the money went.
   */
  federalTotal: number;
  total: number;
  /** What the paycheck nets: wage less withholdings. Sales tax is spent later. */
  takeHomePay: number;
  /**
   * What is left after every tax on this page, sales tax included.
   *
   * This can go negative. Property tax is charged on a house, not on a
   * paycheck, so it does not shrink when the wage does. At a low income in a
   * high-property-tax state the bill passes the whole wage. It used to be
   * clamped at zero, which printed "You keep $0" beside a rate above 100% and
   * left the two figures unable to agree.
   */
  kept: number;
  /** Total tax as a share of base. Not clamped: it can pass 1. */
  effectiveRate: number;
  /**
   * True when the bill is larger than everything the reader earned.
   *
   * Computed once here so no renderer re-derives the comparison and gets it
   * subtly different. Every string with a bounded unit — a career of N years,
   * an hour of a 40-hour week, a bar that cannot exceed its track — branches
   * on this and says out loud that it clamped.
   */
  exceedsBase: boolean;
  /**
   * employmentTax as a share of base. This is the only honest rate to quote
   * against your cost to your employer.
   */
  employmentRate: number;
}

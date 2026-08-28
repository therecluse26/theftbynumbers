/**
 * The arithmetic guard rail.
 *
 * Every rate and price on this page is checked by scripts/validate-data.mjs.
 * Nothing checked the sums those rates feed. Four defects found in the August
 * 2026 audit were arithmetic, not data: an effective rate above 100%, a sales
 * tax charged in states that levy none, a joint return charged one worker's
 * Social Security wage base, and a head of household charged tax a real return
 * would refund. A file this size would have caught all four.
 *
 * Run: node --import ./scripts/lib/ts-register.mjs scripts/check-tax.mjs
 * It imports src/lib/tax.ts directly, so it tests the code the page runs.
 *
 * Two lists below.
 *
 *   EXPECTED    Numbers that are right. A change here fails the build.
 *   KNOWN_WRONG Numbers that are wrong today, with the truth recorded beside
 *               them. These print a warning and do not fail. When a fix lands,
 *               move the case up into EXPECTED with its corrected figures.
 *
 * A case never sits in KNOWN_WRONG without a `truth` and a `fix` naming the
 * plan step that closes it. An undocumented wrong number is a bug; a
 * documented one is a task.
 */
import { STATES } from '../src/lib/data.ts';
import {
  capitalGainsTax,
  computeBreakdown,
  defaultInputs,
  federalTax,
} from '../src/lib/tax.ts';

/** The index of a state in the picker, by its printed name. */
function stateIndex(name) {
  const index = STATES.findIndex((row) => row.name === name);
  if (index < 0) throw new Error('No such state: ' + name);
  return index;
}

/** A reader, described as the difference from the opening state. */
function reader(overrides = {}) {
  return { ...defaultInputs(), ...overrides };
}

/** A state picked by name, with its own income rate, as the page does it. */
function inState(name, overrides = {}) {
  const index = stateIndex(name);
  return reader({
    stateIndex: index,
    stateRatePct: STATES[index].incomeTaxRatePct,
    ...overrides,
  });
}

/** Round to the cent, so a float tail never fails a comparison. */
const cents = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Cases that are right. Breaking one of these breaks the build.
// ---------------------------------------------------------------------------

const EXPECTED = [
  {
    name: 'The opening state: $85,000, single, the national row',
    inputs: reader(),
    want: {
      federal: 9870,
      socialSecurity: 5270,
      medicare: 1232.5,
      state: 3740,
      // The national row now carries Tax Foundation's own population-weighted
      // combined rate, 7.53%, in place of a hand-set 7.5%.
      salesTax: 1710.11,
      propertyTax: 3229.52,
      employerShare: 0,
      total: 25052.13,
      federalTotal: 16372.5,
      kept: 59947.87,
      takeHomePay: 64887.5,
    },
  },
  {
    name: 'Married filing jointly, $300,000, one earner',
    inputs: reader({ income: 300000, status: 'mfj' }),
    // One earner is the case the model is built for, and it is right.
    // Two earners is not. See KNOWN_WRONG.
    want: { federal: 49468, socialSecurity: 11439, medicare: 4800 },
  },
  {
    name: 'Head of household, $50,000, two children owes no federal income tax',
    inputs: reader({ income: 50000, status: 'hoh', children: 2 }),
    // $2,748 of tax against $4,400 of credit. The credit is nonrefundable
    // here, so it stops at zero and never turns the line negative.
    want: { federal: 0, childCredit: 4400 },
  },
  {
    name: 'The child tax credit phases out above the threshold',
    inputs: reader({ income: 450000, status: 'mfj', children: 2 }),
    // $50,000 over $400,000 is 50 steps of $1,000, so $2,500 comes off
    // $4,400.
    want: { childCredit: 1900 },
  },
  {
    name: 'The phase-out cannot take the credit below zero',
    inputs: reader({ income: 900000, status: 'single', children: 1 }),
    want: { childCredit: 0 },
  },
  {
    name: 'Married filing jointly, $300,000, two earners',
    inputs: reader({ income: 300000, status: 'mfj', earners: 2 }),
    // Two wage bases. 150,000 each is under 184,500, so the whole wage is
    // taxed: 300,000 x 6.2%. The employer owes the same again.
    want: { socialSecurity: 18600 },
  },
  {
    name: 'Two earners clear two wage bases, not one',
    inputs: reader({ income: 500000, status: 'mfj', earners: 2 }),
    // 250,000 each is over the base, so each is capped: 184,500 x 2 x 6.2%.
    want: { socialSecurity: 22878 },
  },
  {
    name: 'The Social Security wage base caps a single high earner',
    inputs: reader({ income: 1000000 }),
    // 184,500 x 6.2% = 11,439, and it stops there however high the wage goes.
    want: { socialSecurity: 11439 },
  },
  {
    name: 'The additional Medicare surtax starts above $200,000',
    inputs: reader({ income: 1000000 }),
    // 1,000,000 x 1.45% = 14,500, plus 800,000 x 0.9% = 7,200.
    want: { medicare: 21700 },
  },
  {
    name: "The employer's share enlarges the base, not the withholding",
    inputs: reader({ income: 300000, countEmployerShare: true }),
    // 11,439 + 300,000 x 1.45%. The 0.9% surtax has no employer half.
    // The take-home is unmoved by it: 300,000 less the four withheld taxes.
    want: { employerShare: 15789, takeHomePay: 201976.75 },
  },
  {
    name: 'Income below the standard deduction owes no federal income tax',
    inputs: reader({ income: 12000 }),
    want: { federal: 0, taxable: 0 },
  },
  {
    name: 'A renter is charged the tax inside the rent, not the tax on a house',
    inputs: reader({ tenure: 'rent' }),
    // $1,780 a month, twelve months, eleven cents in the dollar.
    want: { propertyTax: 2349.6 },
  },
  {
    name: 'The renter figure does not move with the state; the owner one does',
    inputs: inState('New Jersey', { tenure: 'rent' }),
    want: { propertyTax: 2349.6 },
  },
  {
    name: 'A New Jersey renter at $30,000 is no longer billed for a house',
    inputs: inState('New Jersey', { income: 30000, tenure: 'rent' }),
    // The owner branch would charge 10,507.32 here, a third of the wage.
    want: { propertyTax: 2349.6 },
  },
  {
    name: 'Oregon levies no sales tax, so none is charged',
    inputs: inState('Oregon'),
    want: { salesTax: 0 },
  },
  {
    name: 'Alaska has no state sales tax, but its boroughs do',
    inputs: inState('Alaska'),
    // 1.82% combined. Setting Alaska to zero would be a second wrong number.
    want: { salesTax: 437.16 },
  },
  {
    name: 'Louisiana has the highest combined rate in the country',
    inputs: inState('Louisiana'),
    // 10.13% combined, against the national 7.53%.
    want: { salesTax: 2342.78 },
  },
  {
    name: 'New Jersey at $12,000: the bill passes the whole wage',
    inputs: inState('New Jersey', { income: 12000 }),
    // Property tax on the state median home is 10,507.32 whatever the wage is.
    // The rate is true and `kept` is negative. Every bounded unit beside them
    // clamps and says so; nothing prints "You keep $0" against 102.1%.
    want: {
      propertyTax: 10507.32,
      salesTax: 243.24,
      total: 12220.56,
      kept: -220.56,
      effectiveRate: 1.01838,
    },
    alsoWant: { exceedsBase: true },
  },
  {
    name: 'Zero income: the page gates this, but the model must not throw',
    inputs: reader({ income: 0 }),
    // Property tax is owed on a house whatever the wage is, so it survives.
    // The rate is 0 because the base is 0, not because the bill is.
    want: { federal: 0, socialSecurity: 0, propertyTax: 3229.52, effectiveRate: 0 },
  },
];

// ---------------------------------------------------------------------------
// Cases that are wrong. Each names its truth and the plan step that fixes it.
// ---------------------------------------------------------------------------

const KNOWN_WRONG = [
  {
    name: 'Head of household, $50,000, two children: the refund is not shown',
    inputs: reader({ income: 50000, status: 'hoh', children: 2 }),
    is: { federal: 0 },
    truth:
      'The federal income tax is right at 0. But the real return also pays ' +
      'about $1,650 of refundable additional child tax credit, and this page ' +
      'has no way to show a refund. It stops at zero.',
    fix: 'Not planned. Modelling a refund means modelling the EITC too.',
  },
];

// ---------------------------------------------------------------------------

let failures = 0;

function check(name, want, got) {
  for (const [field, expected] of Object.entries(want)) {
    const actual = field === 'effectiveRate' ? got[field] : cents(got[field]);
    const rounded = field === 'effectiveRate' ? Math.round(actual * 1e6) / 1e6 : actual;
    if (rounded !== expected) {
      failures++;
      console.error(`FAIL  ${name}`);
      console.error(`      ${field}: expected ${expected}, got ${rounded}`);
    }
  }
}

console.log('Checking the tax arithmetic.\n');

for (const testCase of EXPECTED) {
  const got = computeBreakdown(testCase.inputs);
  check(testCase.name, testCase.want, got);
  // Flags and other non-money fields, compared as they are.
  for (const [field, expected] of Object.entries(testCase.alsoWant ?? {})) {
    if (got[field] !== expected) {
      failures++;
      console.error(`FAIL  ${testCase.name}`);
      console.error(`      ${field}: expected ${expected}, got ${got[field]}`);
    }
  }
}

// The bracket walk, straight, with no breakdown around it.
const bracketCases = [
  // The first bracket boundary. 12,400 x 10%, and not a cent of the 12%.
  { taxable: 12400, status: 'single', want: 1240 },
  { taxable: 12401, status: 'single', want: 1240.12 },
  { taxable: 0, status: 'single', want: 0 },
  { taxable: -5000, status: 'single', want: 0 },
  // The last cent before the top bracket opens: every band below it, summed.
  { taxable: 640600, status: 'single', want: 192979.25 },
  // And one dollar into the 37% band.
  { taxable: 640601, status: 'single', want: 192979.62 },
];
for (const { taxable, status, want } of bracketCases) {
  const got = cents(federalTax(taxable, status));
  if (got !== want) {
    failures++;
    console.error(`FAIL  federalTax(${taxable}, '${status}')`);
    console.error(`      expected ${want}, got ${got}`);
  }
}

// Long-term gains, stacked on top of ordinary taxable income.
const gainsCases = [
  // No ordinary income, a gain inside the 0% band: nothing owed.
  { taxable: 0, gain: 40000, status: 'single', want: 0 },
  // The gain straddles the 0% and 15% bands at $49,450.
  { taxable: 0, gain: 60000, status: 'single', want: 1582.5 },
  // Ordinary income has already filled the 0% band, so all of it is 15%.
  { taxable: 68900, gain: 100000, status: 'single', want: 15000 },
  // Over $200,000 the 3.8% surtax joins the 15%.
  { taxable: 150000, gain: 100000, status: 'single', want: 16900 },
  { taxable: 0, gain: 0, status: 'single', want: 0 },
  { taxable: 0, gain: -100, status: 'single', want: 0 },
];
for (const { taxable, gain, status, want } of gainsCases) {
  const got = cents(capitalGainsTax(taxable, gain, status));
  if (got !== want) {
    failures++;
    console.error(`FAIL  capitalGainsTax(${taxable}, ${gain}, '${status}')`);
    console.error(`      expected ${want}, got ${got}`);
  }
}

console.log(
  `${EXPECTED.length} reader cases, ${bracketCases.length} bracket cases and ` +
    `${gainsCases.length} capital gains cases checked.`,
);

if (KNOWN_WRONG.length) {
  console.log(`\n${KNOWN_WRONG.length} known-wrong cases, still open:\n`);
  for (const testCase of KNOWN_WRONG) {
    const got = computeBreakdown(testCase.inputs);
    const drifted = Object.entries(testCase.is).filter(([field, value]) => {
      const actual =
        field === 'effectiveRate'
          ? Math.round(got[field] * 1e6) / 1e6
          : cents(got[field]);
      return actual !== value;
    });
    if (drifted.length) {
      // Someone changed the arithmetic without moving this case. That is
      // either the fix landing, or a new bug. Either way, say so loudly.
      failures++;
      console.error(`FAIL  ${testCase.name}`);
      console.error(`      This case moved. Update it or move it to EXPECTED.`);
      for (const [field, value] of drifted) {
        console.error(`      ${field}: recorded ${value}, now ${got[field]}`);
      }
    } else {
      console.log(`  ${testCase.name}`);
      console.log(`    ${testCase.truth}`);
      console.log(`    ${testCase.fix}\n`);
    }
  }
}

if (failures) {
  console.error(`\n${failures} check${failures === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log('\nAll checks passed.');

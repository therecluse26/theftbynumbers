# The data mechanism

Every number on the site comes from a JSON file in `src/data`. No rate, price or
threshold is written in the code. This document explains the parts.

## The five ideas

1. **One file per subject.** Tax law changes yearly. Gold changes daily. They do
   not belong in the same file.
2. **Every file carries its own provenance.** A `meta` block says where each
   number came from, when it was last confirmed, and how long it stays good.
3. **A schema guards every file.** `npm run build` refuses to build a bad file.
4. **An updater is a small module.** It fetches one source and writes one file.
5. **A guard rail sits in front of every write.** A source that returns nonsense
   leaves the file untouched.

## The data files

| File | Holds | Refreshed by |
| --- | --- | --- |
| `src/data/federal-tax.json` | Brackets, standard deductions, payroll rates, wage base | a person, yearly |
| `src/data/states.json` | State income tax rate, property tax rate and median home value | rates by a person; home value by `zillow-zhvi` |
| `src/data/metals.json` | Spot gold, dollars per troy ounce | `gold-spot` |
| `src/data/basket.json` | Everyday purchase prices, section two | a person |
| `src/data/receipt.json` | What the money was spent on, section three | a person |
| `src/data/outlays.json` | Federal spending by category, the donut in section three | a person |
| `src/data/ladder.json` | The ladder and its groups, section five | a person |
| `src/data/charity.json` | Dollars per unit of good, one group of the ladder | a person |
| `src/data/roads.json` | One unit bought twice, public against private, section six | a person |
| `src/data/assumptions.json` | Sales tax estimate, slider ranges, defaults | a person |

Each file has a schema of the same name in `schemas/`.

## The meta block

```json
"meta": {
  "updatedAt": "2026-08-26",
  "fields": {
    "gold.usdPerTroyOz": {
      "updateMode": "fetch",
      "updater": "gold-spot",
      "label": "Spot gold, US dollars per troy ounce",
      "url": "https://api.gold-api.com/price/XAU",
      "maxAgeDays": 7,
      "updatedAt": "2026-08-26"
    }
  }
}
```

- `updatedAt` on the file is the day a value last **changed**.
- `updatedAt` on a field is the day the field was last **confirmed**. A fetch that
  finds no change still moves this date.
- `maxAgeDays` sets when the field counts as stale.
- `updateMode` is `fetch` or `manual`. A `fetch` field must name an `updater`.
- A field key is a dotted path (`salesTax.spendShare`), a column of a list
  (`medianHomeValue`, across every state), or `*` for the whole file.
- `url` must be a **deep link**: a page that states the figure. A publisher's
  front door is not one. The reader sees these URLs now, not only the updater.
  Several footnotes and hints render the meta `label` and `url` directly.

## Sources

Every claim on the page carries a link. `SOURCES.md` lists all of them, says
which were checked against the publisher, and names the ones that do not match.

A data item names its own source in a `source` block:

```json
"source": { "label": "GAO-24-106703, F-35 Sustainment", "url": "https://www.gao.gov/products/gao-24-106703" }
```

In `receipt.json` and `outlays.json`, `source` also takes a **list**. A card or a
donut slice that states what a thing costs now against what it cost before is
making two claims, and the two figures rarely come from one publisher. Give each
claim its own link, in the order the note makes them:

```json
"source": [
  { "label": "Final Monthly Treasury Statement, FY2025, table 5", "url": "…" },
  { "label": "CBO, Comparing the Compensation of Federal and Private-Sector Employees in 2022", "url": "…" }
]
```

The links render side by side, separated by a middle dot.

`roads.json` uses `publicSource` and `privateSource`, because one card carries
two prices from two publishers. A ladder group uses `footnoteSource`.

A rung with a `priceFrom` block takes its price from another file and inherits
that file's source. Give it a `source` of its own only when its note makes a
claim the price does not, such as a withdrawal rate.

## The commands

```
npm run data:validate     Check every file against its schema and rules
npm run data:check        Report which fields are stale. Exit 1 if any are
npm run data:update       Refresh every fetchable field
npm run data:update:dry   Fetch and report, write nothing
npm run data:links        Request every URL on the page and report the status
```

`data:links` is deliberately **not** part of `npm run build`. A publisher being
down for an afternoon must never stop a deploy. Run it by hand, or on a
schedule. It exits 1 on a dead link and 0 on a link that merely refuses a
script; those are reported apart and need a check in a browser.

More options on the update command:

```
node scripts/update-data.mjs --only=gold-spot   Run one updater
node scripts/update-data.mjs --due-only         Skip fields not yet past maxAgeDays
node scripts/update-data.mjs --force            Accept a change a guard refused
```

`npm run build` runs `data:validate` first. A bad data commit cannot ship.

## The outlay guard rails

The donut in section three and the "all federal spending" card divide the same
number. Two rules in `semanticErrors` stop them drifting apart.

1. The category amounts in `outlays.json` must sum to its own `totalOutlays`,
   within a tenth of a percent. A donut whose parts do not add up is a lie.
2. `totalOutlays` must equal the `annualCost` of the `federal-spending` card in
   `receipt.json`.

Break either one and `npm run build` refuses. To refresh the figures, pull the
Monthly Treasury Statement table 5 from the Fiscal Data API, take the `Total--`
rows at nesting level 2, and update the `federal-spending` card in the same
commit.

## Every slice carries its cost case

A donut slice note used to say only what the money does: *"Retirement and health
benefits for people who worked for the government."* A reader finishes that
sentence agreeing with the spending. The slice argued the other side's case, on
this page, in the government's favour, ten times over.

**A note names the job, then what that job costs now against what it cost
before.** Both halves, every slice. The second half comes from a publisher who
is not Treasury, so the slice's `source` is a list. What is on the page now:

| Slice | The cost case | Publisher |
| --- | --- | --- |
| Health | Individual premiums rose 105% in the four years after the ACA took effect | HHS ASPE, CMS |
| Social Security | $25.1tn short over 75 years, $2.5tn worse in one report | SSA Trustees |
| Treasury, most of it interest | On either interest figure, it now costs more than the whole military slice | Its own table |
| The military | Never audited; $49.3bn of weapon-program cost growth in one year | GAO-25-107569 |
| Veterans | 2.6% of federal spending in 2000, 4.4% in 2017, after inflation | CBO |
| Food and farm | 10.93% SNAP payment error rate; ~$10.5bn issued wrong | USDA FNS |
| Federal pensions | Benefits cost 43% more than the private sector, 93% at high-school level | CBO |
| Roads, rail and air | ~$1.5bn a km of subway in New York against a ~$220m global median | Transit Costs Project |
| Homeland Security | Doubled in real terms since 2003, faster than the budget around it | USAFacts |
| Everything else | Real spending per pupil more than doubled; 17-year-old scores did not move | NCES |

This rule is not machine-checkable and no validator enforces it. It is the
reason the slices read the way they do. Do not refresh a Treasury amount and
leave a note behind that only names the job.

The same rule governs the `good` group of `receipt.json`. That group holds the
programs a reader defends the tax with, so every card in it must state what the
program costs now against what it cost before. A card there that only describes
the program is the strongest argument against this whole page.

## The guard rails

An updater throws when the source looks wrong. A throw leaves the file alone and
sets exit code 1.

- `gold-spot` refuses a price outside $100 to $100,000, or a move over 25%.
- `zillow-zhvi` refuses a value under $10,000, a move over 40%, or a file that
  matches fewer than 45 states.

`--force` accepts the change when a real market move trips a guard.

## Adding an updater

1. Write the module in `scripts/sources/`. Follow the shape documented at the top
   of `scripts/sources/index.mjs`.
2. Add it to `UPDATERS` in `scripts/sources/index.mjs`.
3. Point the field's meta block at it: `"updateMode": "fetch"`, `"updater": "<name>"`.
4. Run `node scripts/update-data.mjs --only=<name> --dry-run`.

## The ladder groups

Section five used to be two sections: the ladder, then the give. Both answered
the same question, so they are now one ladder in three groups. A group sorts by
**who a rung is for**, never by what it costs. Within a group the rungs run
cheapest first.

`ladder.json` holds the groups. Every item names one with its `group` field.

```json
"groups": [
  { "id": "others", "title": "For someone else", "lede": "…", "includesCharity": true },
  { "id": "family", "title": "For your family",  "lede": "…" },
  { "id": "you",    "title": "For you",          "lede": "…" }
]
```

**`includesCharity` is how `charity.json` reaches the page.** Every item in that
file joins the group that sets the flag, and is priced in beside its rungs.
Exactly one group may set it. Set it nowhere and `charity.json` renders nowhere,
silently; set it twice and the same rungs print twice. `semanticErrors` refuses
both.

A group may carry a `footnote`, printed under its own rungs. The giving group
uses it for the GiveWell caveat, which belongs beside those prices rather than at
the foot of a section it does not describe.

## Adding a ladder item priced from another file

A ladder item takes a fixed `price`, or a `priceFrom` block:

```json
"priceFrom": { "ref": "metals.gold.usdPerTroyOz", "multiplier": 400 }
```

To add a new `ref`, add the case to `priceFromRef` in `src/lib/ladder.ts` and the
value to the enum in `schemas/ladder.schema.json`. Do both, or validation fails.

A `reader.*` ref prices a rung from the reader's own take-home, so the rung costs
them their own time rather than a shop price. A rung that resolves to zero is
dropped, which is what happens to every `reader.*` rung when the income box is
empty.

**Never price a rung from `charity.*`.** There used to be a `charity.life-amf`
ref, back when the give was its own section. Charity items are rungs of this same
ladder now, so such a ref would put one figure on the page twice. A rule refuses
it.

## The receipt card kinds

`src/data/receipt.json` holds one `kind` per card, and the kind decides which
field carries the number.

| Kind | Field | The card shows |
| --- | --- | --- |
| `duration` | `annualCost` | How long the reader's tax funds that yearly cost. The `scale` group only |
| `yearly` | `annualCost` | The reader's share of a yearly national cost, over their years |
| `unit` | `price` | How many of them the tax comes to |
| `lump` | `total` | The reader's share of one cumulative total, counted once |
| `fact` | `figure` | A finding on its own, with no arithmetic |
| `computed` | `compute` | A figure worked out in code from the reader's own numbers |

If a figure is not a sum of money at all, such as a count of failed audits or a
markup, it is a `fact` and no arithmetic applies.

### Two numbers on every money card

A money card prints the reader's share big, and the published figure it came from
underneath, in `.buy-sub`. `usdShort()` in `src/lib/format.ts` writes the second
one: `$7.01tn`, `$233bn`, `$42.7m`.

Leave the sub-line empty where the note already carries the same figure in the
item's own words. `unit`, `computed` and the whole of section two do exactly
that: every one of their notes opens with `{price}`.

### One definition of "your share"

`federalDollarShare()` in `src/lib/render.ts` is the part of every federal dollar
this reader pays: `breakdown.federalTotal` over `outlays.totalOutlays`. Every
money card divides by it, so every figure on the receipt moves when the reader
moves a slider.

- A **yearly** cost is multiplied by the years slider as well. Twenty years of
  work fund twenty years of that waste.
- A **lump** is counted once. The years slider must never multiply it. Nobody
  pays for the Afghanistan war twenty times.

**Both halves must describe the same government.** `federalTotal` is federal
income tax, both payroll taxes, and the employer's half when that box is on. It
is not `federal`, which is income tax alone, and it is not `total`, which adds
state, sales and property tax.

This once divided `total` by federal outlays. A Californian at $85,000 with all
three **Also count** boxes ticked saw every figure in sections three and six 53%
too high, because $12,123 a year that never left the state was credited against
Washington's spending. Under the old defaults the two numerators were equal, so
the fault was invisible until the reader touched a control. The defaults now
open with state, sales and property tax in `total`, so the two numerators differ
from the first paint. Keep them apart.

`total` stays the numerator everywhere that describes the whole bill and claims
nothing about federal spending: the hero, the ribbon, the ledger, section two,
`lifeCost`, section four and the ladder. Do not unify them.

**A lump is measured against a single year of current outlays.** $8tn of war was
run up over twenty-five years, when the government spent far less each year than
$7.01tn. Dividing by today's larger figure therefore reads an old bill low. It
bites on `afghan-waste`, `afghan-equipment` and `war-on-terror` only; the
pandemic lumps fell in years close to today's outlays, and the F-35 total runs
to 2088. The notes section says so on the page. Do not adjust it quietly.

**Print a lump's horizon with `duration()`, never `toFixed()`.** Four of these
bills are under a twentieth of a year. One decimal made every one of them read
"0.0 years of all federal spending", which is the same nothing-figure that got
the old `share` kind deleted. `duration()` gives 10 days, 5.2 days, 1.4 days and
8.9 hours instead.

### The history of this

There used to be a `share` kind: the reader's tax as a percentage of a national
lump sum. It printed figures like `0.0000041%`, which tells a reader nothing. A
`household` kind replaced it, dividing the lump sum evenly across 134,790,000 US
households and printing plain dollars.

`lump` replaces `household` in turn, and the top-level `households` count is gone
with it. The flat split barely moved when the reader changed their income, so half
the receipt responded to the sliders and half sat still. Worse, two neighboring
cards meant different things by "your share": one the reader's own tax, one a flat
national split. No reader could rank them against each other.

`duration` was cut back to the `scale` group at the same time. Elsewhere it
produced cards reading **"2.5 minutes of the money stolen from the government
every year"**, which parses as minutes of money and means nothing. In `scale` the
second is the unit the group lede declares, and the card is the strongest on the
page. `semanticErrors` refuses a `duration` card in any other group.

There used to be a `forfeiture` card, on civil asset forfeiture. It was removed on
27 August 2026. The money was never tax money, so no share of it belonged on a tax
receipt, and the card had to open by saying so.

A `computed` card names a function in `src/lib/render.ts`. Add the case there and
the value to the enum in `schemas/receipt.schema.json` together.

**Every receipt figure is a share, never a purchase.** Write card copy as "your
share of", never "you bought". Money is fungible and the notes section says so.

**Shares divide outlays, not receipts.** $1.8tn of the $7.01tn was borrowed. The
`deficit` card says so and names it deferred tax, which is the stronger claim
anyway. Do not quietly re-base the shares on revenue without changing that card.

**A card must not argue the other side's case.** There used to be a `congress-pay`
card. $93m is 0.0013% of $7.01tn, so it taught the reader that the graft is
trivial, and its own note said the salary had not moved since 2009 — which is
the argument a defender of Congress makes. It is gone. So is `high-speed-rail`,
because section six already drops California HSR as unrepresentative and one
project cannot be evidence in one section and not in the other.

## The roads comparison

Section six answers the objection every reader raises last: the government builds
the roads. `roads.json` holds one `kind` per card, and the kind decides which
field carries the number.

| Kind | Field | The card shows |
| --- | --- | --- |
| `multiple` | `publicPrice`, `privatePrice` | One unit bought twice. Prints how many times as much the state paid |
| `record` | `figure` | A count or share on its own, with no arithmetic |
| `reader` | `compute` | Worked out in code from the reader's own tax |

The first version of this section had only `multiple`. That shape could not hold
the strongest answers to the question, because they are not price comparisons at
all: private companies built America's first roads, Swedes still maintain two
thirds of theirs, and transportation is under two cents of the federal dollar. Those
are `record` cards.

```json
{
  "id": "astronaut-seat", "group": "air", "kind": "multiple",
  "label": "more, per astronaut carried to orbit and home again",
  "publicPrice": 170000000, "privatePrice": 55000000,
  "sameness": "One customer buying one thing: NASA putting a NASA astronaut into
               low Earth orbit and returning them alive. …",
  "note": "A seat on the Space Shuttle cost about {public} … about {private} …",
  "publicSource":  { "label": "…", "url": "…" },
  "privateSource": { "label": "…", "url": "…" }
}
```

### The sameness sentence

**Every `multiple` card must carry one, and it prints before the prices.**

There used to be a card claiming police cost 5.3× more per officer. Its own note
then said: *"These are not the same job: a guard cannot arrest you, investigate a
killing or answer a 911 call."* A critic reads that and answers **"exactly, it is
NOT the same job."** The card handed over the argument it was written to win.

Honesty was not the problem. The unit was. `sameness` forces the author to earn
the comparison before making it: one sentence naming what makes the two sides the
same job. Same statute. Same unit. Same buyer. Same beat. Same year.

If you cannot write that sentence, you do not have a card. Find a narrower unit
where the jobs really are identical, or drop it. That is how per-kilogram-to-orbit
became per-astronaut-carried, and how cost-per-police-officer became the price of
one hour of contracted patrol in one Houston neighborhood.

`sameness` says what makes the sides **alike**. The `note` is where the remaining
differences go. Both are still required.

### Rules `semanticErrors` enforces

Break any of them and `npm run build` refuses.

1. **Every `multiple` carries a `sameness`.** See above.
2. **On a `multiple`, `privatePrice` must be below `publicPrice`.** A card
   reading "0.8× more" contradicts the heading above it. If a real comparison
   comes out that way, it does not belong in this section.
3. **A `multiple` note must use both `{public}` and `{private}`.** The ratio is
   only checkable if the reader can see the two numbers it came from.
4. **A kind carries only its own fields.** A price on a `record` card is a number
   the reader can see no way to reach.
5. **The section lede must use `{transportShare}`.** It prints the transportation
   slice of `outlays.json`. Lose the token and the section opens by conceding.
6. **Every group an item names must exist.**

Every card names a publisher and links to it. A `multiple` names two, one for
each side. A reader who disbelieves this section will go and check.

### Two rules the code cannot check

- **Put the remaining weakness in the note, after the sameness sentence.** The
  $52m at LAX is an extrapolation, and the TSA's own accounting disagrees. The
  Shuttle carried cargo on the same flight as its crew. NAV CANADA is a
  non-profit. Say each one. A card that hides its weakness is worth less than no
  card. A card that leads with its weakness is worth nothing at all.
- **A comparison that fails like-for-like is dropped, not shaded.** The list of
  what was tried and thrown out is itself a guard rail; do not re-add these
  without new evidence.

  | Dropped | Why |
  | --- | --- |
  | Letter post | A stamp beats every courier. The market loses this one |
  | Courts against arbitration | One figure is the cost of the forum, the other is what the parties pay their lawyers |
  | Cost per police officer | No narrower unit rescued it; replaced by the patrol hour |
  | Subscription fire | Rural/Metro publishes no flat fee |
  | Housing | RAND's published ratios do not reconcile from the summaries |
  | California high-speed rail | One state's worst project proves nothing about the state as such |
  | Somali piracy | "No ship with an armed team was ever hijacked" traces only to unnamed officials |
  | Central Park Conservancy | The city owns the land and funds the rest under contract. A partnership, not a market |
  | Interstate cost overrun, as a ratio | $27bn in 1955 dollars over $114bn spent through 1991. Different dollars. The card now quotes the 16-year schedule slip, which needs no adjustment |

  There is no clean **military** defense comparison in this section. Airport
  screening and neighborhood patrol are security, not defense. Do not stretch
  one to cover the other.

`transportShare()` in `render.ts` reads `outlays.json`, never a number typed in
code, so the donut in section three and the lede in section six cannot disagree.
The `transport-share` card types the same share as a string, so a rule in
`semanticErrors` checks the typed figure against the computed one and refuses a
drift over a hundredth of a point.

### Say the ratio the right way round

A `multiple` label reads **"as much, per …"**, never "more, per …". 40 ÷ 24 is
1.7 times as much, which is 67% more. "1.7× more" means 2.7× and is simply
wrong. The label carries the wording; the code only prints the number.

### Property tax

`states.json` carries `propertyTaxRatePct`, the state's effective rate on
owner-occupied housing. The third **Also count** box charges it against the
median home in the chosen state. It is on by default, as is the sales tax box.
Only the employer's share starts off, because it never passes through the wage.

It earns its place because it is the one tax on the page that never ends. The
`home-owned` rung used to say *"Nobody takes it for a missed payment."* That is
false, and it denied the premise of the whole site on the site's own ladder. A
home bought outright still owes this tax every year, and the county sells the
house if it goes unpaid. Do not restore the old sentence.

The source publishes no national figure, so the US row carries the median of the
fifty-one published rates. That under-weights the populous high-rate states, so
the national default is the mild end of the range. Say so if you quote it.

### The national row

`states.json` opens with the US row and the page defaults to it. That row is a
stand-in for "no state picked", so every rate on it must describe a typical
state. `incomeTaxRatePct` therefore carries the median of the fifty-one
published rates, 4.4%, by the same rule `propertyTaxRatePct` already used. It
was 0% before, which charged a reader who never opened the picker no state tax
at all and read the whole bill low.

The median, not the mean. Nine states levy no income tax, which drags the mean
down to 3.84% and describes none of the fifty-one. The mode is 0% for the same
reason, so it is useless here.

Both medians are computed by hand and typed in. If you change a state's income
tax or property tax rate, recompute the US row. Nothing checks it for you.

## What the scheduled job will do

The job does not exist yet. When it is written, it needs these steps:

1. `npm ci`
2. `node scripts/update-data.mjs`
3. Commit `src/data/*.json` if anything changed, then rebuild and deploy.

The update command writes three values to `$GITHUB_OUTPUT` when that variable is
set, so the job can branch on them:

- `changed` — `true` when a file was written
- `values_changed` — how many values moved
- `manual_stale` — how many manual fields are past their age limit

A daily schedule suits `gold-spot`. A monthly schedule suits `zillow-zhvi`; Zillow
publishes once a month. Run `data:check` on the same schedule to catch the manual
fields going stale, and open an issue when `manual_stale` is above zero.

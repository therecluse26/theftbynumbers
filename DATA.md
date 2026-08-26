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
| `src/data/states.json` | State income tax rate and median home value | rate by a person; home value by `zillow-zhvi` |
| `src/data/metals.json` | Spot gold, dollars per troy ounce | `gold-spot` |
| `src/data/basket.json` | Everyday purchase prices, section two | a person |
| `src/data/ladder.json` | The unlock ladder, section four | a person |
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

## The commands

```
npm run data:validate     Check every file against its schema and rules
npm run data:check        Report which fields are stale. Exit 1 if any are
npm run data:update       Refresh every fetchable field
npm run data:update:dry   Fetch and report, write nothing
```

More options on the update command:

```
node scripts/update-data.mjs --only=gold-spot   Run one updater
node scripts/update-data.mjs --due-only         Skip fields not yet past maxAgeDays
node scripts/update-data.mjs --force            Accept a change a guard refused
```

`npm run build` runs `data:validate` first. A bad data commit cannot ship.

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

## Adding a ladder item priced from another file

A ladder item takes a fixed `price`, or a `priceFrom` block:

```json
"priceFrom": { "ref": "metals.gold.usdPerTroyOz", "multiplier": 400 }
```

To add a new `ref`, add the case to `priceFromRef` in `src/lib/ladder.ts` and the
value to the enum in `schemas/ladder.schema.json`. Do both, or validation fails.

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

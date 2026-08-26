# Withheld

A single-page calculator. It shows what one year of US tax costs a wage earner,
what that money would have bought, what the government spent it on, and what it
would be worth invested or given away instead.

Nothing the reader types leaves the page. The site is static.

## Run it

```
npm install
npm run dev        # http://localhost:4321
npm run build      # validates the data, then builds to dist/
npm run preview    # serve dist/
```

## How it is put together

```
src/data/          The numbers. Nine JSON files. See DATA.md
schemas/           A JSON Schema per data file
scripts/           Validate and refresh the data files
src/lib/           Tax arithmetic, formatting, and the HTML builders
src/components/    One Astro component per section of the page
src/pages/         index.astro composes the page
src/scripts/app.ts The browser half
original/          The single-file version this site was built from
```

**One source of truth for every figure.** `src/lib/render.ts` builds the HTML for
every part of the page that changes. Astro calls those functions at build time to
render the opening state. The browser calls the same functions on every keystroke.
The first paint and the first update can never disagree.

**The page works before the script runs.** The opening state is real HTML, not a
loading spinner.

**No number is written in the code.** Rates, thresholds, prices and slider ranges
all come from `src/data`. Read `DATA.md` before changing any of them.

## Keeping the data fresh

```
npm run data:check     Which fields are stale?
npm run data:update    Refresh every fetchable field
```

`DATA.md` explains the provenance blocks, the guard rails, and how to add a new
source. The scheduled GitHub Actions job is not written yet; `DATA.md` lists what
it has to call.

## Notes on the estimates

The page is not tax advice. State tax is a flat approximation. The sales tax line
is an editorial estimate. Every caveat is printed at the foot of the page.

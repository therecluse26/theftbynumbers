/**
 * The ladder, priced for one reader.
 *
 * The ladder has three groups, sorted by who the rung is for. Two of them are
 * filled from ladder.json. The third also takes every item in charity.json,
 * because giving the money away is one more thing the same balance buys.
 *
 * A ladder item either carries a fixed price or a priceFrom block. A
 * priceFrom block points at another data file, at the state the reader
 * picked, or at the reader's own take-home. Add a new ref here and in
 * schemas/ladder.schema.json together.
 */
import { CHARITY, LADDER, METALS, STATES, STATES_DATA, basketPrice, basketSource } from './data';
import { usd } from './format';
import type { LadderGroup, LadderItem, PriceRef } from './types';

export interface ResolvedLadderItem {
  id: string;
  group: string;
  singular: string;
  plural: string;
  price: number;
  note: string;
  source?: { label: string; url: string };
}

/** One group, with the rungs that belong to it, cheapest first. */
export interface ResolvedLadderGroup extends LadderGroup {
  items: ResolvedLadderItem[];
}

function priceFromRef(
  ref: PriceRef,
  stateIndex: number,
  annualTakeHome: number,
): number {
  switch (ref) {
    case 'metals.gold.usdPerTroyOz':
      return METALS.gold.usdPerTroyOz;
    case 'state.medianHomeValue':
      return (STATES[stateIndex] ?? STATES[0]!).medianHomeValue;
    case 'basket.college-year':
      return basketPrice('college-year');
    case 'basket.childcare-month':
      return basketPrice('childcare-month');
    case 'reader.annualTakeHome':
      return annualTakeHome;
  }
}

/**
 * Where the price of a `priceFrom` rung was published.
 *
 * The rung does not own its price, so it must not own its source either: it
 * cites whatever the file it prices from cites. Change the basket's college
 * source and the degree rung follows on the next build, with no second edit.
 *
 * A rung priced from the reader's own take-home has no source and never will.
 * That figure is the reader's own money, and no publisher states it.
 */
function sourceFromRef(ref: PriceRef) {
  switch (ref) {
    case 'metals.gold.usdPerTroyOz':
      return METALS.meta.fields['gold.usdPerTroyOz'];
    case 'state.medianHomeValue':
      return STATES_DATA.meta.fields['medianHomeValue'];
    case 'basket.college-year':
      return basketSource('college-year');
    case 'basket.childcare-month':
      return basketSource('childcare-month');
    case 'reader.annualTakeHome':
      return undefined;
  }
}

/** The rung's own source, or the one it inherits from the file it prices from. */
function sourceOf(item: LadderItem) {
  if (item.source) return item.source;
  return item.priceFrom ? sourceFromRef(item.priceFrom.ref) : undefined;
}

function priceOf(item: LadderItem, stateIndex: number, annualTakeHome: number): number {
  if (item.priceFrom) {
    return (
      priceFromRef(item.priceFrom.ref, stateIndex, annualTakeHome) *
      item.priceFrom.multiplier
    );
  }
  return item.price ?? 0;
}

/**
 * Every rung, cheapest first, with names and notes filled in.
 *
 * A rung priced off the reader's take-home costs nothing when the income box is
 * empty. A free rung would sit at the bottom of every ladder and divide by zero
 * in the counting, so drop it.
 */
export function resolveLadder(
  stateIndex: number,
  annualTakeHome: number,
): ResolvedLadderItem[] {
  const state = STATES[stateIndex] ?? STATES[0]!;
  const inState = !state.isNational;
  const giving = LADDER.groups.find((group) => group.includesCharity);

  const rungs: ResolvedLadderItem[] = LADDER.items.map((item) => {
    const price = priceOf(item, stateIndex, annualTakeHome);
    const singular =
      inState && item.singularInState
        ? item.singularInState.replace('{state}', state.name)
        : item.singular;
    const plural =
      inState && item.pluralInState
        ? item.pluralInState.replace('{state}', state.name)
        : item.plural;
    return {
      id: item.id,
      group: item.group,
      singular,
      plural,
      price,
      note: item.note.replace('{price}', usd(price)),
      source: sourceOf(item),
    };
  });

  // Charity items are rungs too. They carry no state wording and no priceFrom,
  // so they need none of the work above.
  if (giving) {
    for (const item of CHARITY.items) {
      rungs.push({
        id: item.id,
        group: giving.id,
        singular: item.singular,
        plural: item.plural,
        price: item.price,
        note: item.note.replace('{price}', usd(item.price)),
        source: item.source,
      });
    }
  }

  return rungs.filter((item) => item.price > 0).sort((a, b) => a.price - b.price);
}

/** The same rungs, split into the groups the section renders. */
export function resolveLadderGroups(
  stateIndex: number,
  annualTakeHome: number,
): ResolvedLadderGroup[] {
  const rungs = resolveLadder(stateIndex, annualTakeHome);
  return LADDER.groups
    .map((group) => ({
      ...group,
      items: rungs.filter((item) => item.group === group.id),
    }))
    .filter((group) => group.items.length > 0);
}

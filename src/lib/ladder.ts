/**
 * The ladder, priced for one reader.
 *
 * A ladder item either carries a fixed price or a priceFrom block. A
 * priceFrom block points at another data file, at the state the reader
 * picked, or at the reader's own take-home. Add a new ref here and in
 * schemas/ladder.schema.json together.
 */
import { LADDER, METALS, STATES, basketPrice, charityPrice } from './data';
import { usd } from './format';
import type { LadderItem, PriceRef } from './types';

export interface ResolvedLadderItem {
  id: string;
  singular: string;
  plural: string;
  price: number;
  note: string;
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
    case 'charity.life-amf':
      return charityPrice('life-amf');
    case 'reader.annualTakeHome':
      return annualTakeHome;
    case 'reader.monthlyTakeHome':
      return annualTakeHome / 12;
  }
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
 * Cheapest first. Names and notes have their tokens filled in.
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

  return LADDER.items
    .map((item) => {
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
        singular,
        plural,
        price,
        note: item.note.replace('{price}', usd(price)),
      };
    })
    .filter((item) => item.price > 0)
    .sort((a, b) => a.price - b.price);
}

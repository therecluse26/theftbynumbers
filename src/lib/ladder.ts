/**
 * The unlock ladder, priced for one reader.
 *
 * A ladder item either carries a fixed price or a priceFrom block. A
 * priceFrom block points at another data file, or at the state the reader
 * picked. Add a new ref here and in schemas/ladder.schema.json together.
 */
import { LADDER, METALS, STATES } from './data';
import { usd } from './format';
import type { LadderItem, PriceRef } from './types';

export interface ResolvedLadderItem {
  id: string;
  singular: string;
  plural: string;
  price: number;
  note: string;
}

function priceFromRef(ref: PriceRef, stateIndex: number): number {
  switch (ref) {
    case 'metals.gold.usdPerTroyOz':
      return METALS.gold.usdPerTroyOz;
    case 'state.medianHomeValue':
      return (STATES[stateIndex] ?? STATES[0]!).medianHomeValue;
  }
}

function priceOf(item: LadderItem, stateIndex: number): number {
  if (item.priceFrom) {
    return priceFromRef(item.priceFrom.ref, stateIndex) * item.priceFrom.multiplier;
  }
  return item.price ?? 0;
}

/** Cheapest first. Names and notes have their tokens filled in. */
export function resolveLadder(stateIndex: number): ResolvedLadderItem[] {
  const state = STATES[stateIndex] ?? STATES[0]!;
  const inState = !state.isNational;

  return LADDER.items
    .map((item) => {
      const price = priceOf(item, stateIndex);
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
    .sort((a, b) => a.price - b.price);
}

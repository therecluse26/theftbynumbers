/**
 * The single door to the JSON data files.
 *
 * Nothing else in the site reads src/data directly. Import from here.
 * Vite inlines the JSON at build time, so a data change needs a rebuild.
 */
import assumptionsJson from '../data/assumptions.json';
import basketJson from '../data/basket.json';
import charityJson from '../data/charity.json';
import federalTaxJson from '../data/federal-tax.json';
import ladderJson from '../data/ladder.json';
import metalsJson from '../data/metals.json';
import outlaysJson from '../data/outlays.json';
import receiptJson from '../data/receipt.json';
import roadsJson from '../data/roads.json';
import statesJson from '../data/states.json';

import type {
  AssumptionsData,
  BasketData,
  CharityData,
  FederalTaxData,
  LadderData,
  MetalsData,
  OutlaysData,
  ReceiptData,
  RoadsData,
  StatesData,
} from './types';

export const TAX = federalTaxJson as unknown as FederalTaxData;
export const STATES_DATA = statesJson as unknown as StatesData;
export const METALS = metalsJson as unknown as MetalsData;
export const BASKET = basketJson as unknown as BasketData;
export const LADDER = ladderJson as unknown as LadderData;
export const RECEIPT = receiptJson as unknown as ReceiptData;
export const OUTLAYS = outlaysJson as unknown as OutlaysData;
export const CHARITY = charityJson as unknown as CharityData;
export const ROADS = roadsJson as unknown as RoadsData;
export const ASSUMPTIONS = assumptionsJson as unknown as AssumptionsData;

export const STATES = STATES_DATA.states;

/** One basket price, by id. The ladder prices a rung off the college year. */
export function basketPrice(id: string): number {
  return BASKET.items.find((item) => item.id === id)?.price ?? 0;
}

/** The employer pays this share on top of your wage: 6.2% plus 1.45%. */
export const EMPLOYER_SHARE_RATE =
  TAX.payroll.socialSecurity.rate + TAX.payroll.medicare.rate;

/** Latest data day across every file. Shown in the notes. */
export function dataUpdatedAt(): string {
  return [TAX, STATES_DATA, METALS, BASKET, LADDER, RECEIPT, OUTLAYS, CHARITY, ROADS, ASSUMPTIONS]
    .map((file) => file.meta.updatedAt)
    .sort()
    .reverse()[0]!;
}

/** "26 August 2026" from "2026-08-26". Used in the prose. */
export function longDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

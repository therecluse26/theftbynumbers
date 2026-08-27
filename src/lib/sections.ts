/**
 * The six result sections, in page order.
 *
 * The intro map at the top of the page reads from this list. The six section
 * components still carry their own headings, so keep the two in step by hand
 * until they read from here too.
 */

export interface SectionEntry {
  /** The eyebrow above the heading, e.g. "Section one". */
  eyebrow: string;
  /** The heading itself, word for word as the section prints it. */
  title: string;
}

export const SECTIONS: SectionEntry[] = [
  { eyebrow: 'Section one', title: 'Line by line' },
  { eyebrow: 'Section two', title: 'What one year of it buys' },
  { eyebrow: 'Section three', title: 'What your money was actually spent on' },
  { eyebrow: 'Section four', title: 'If you had invested it instead' },
  { eyebrow: 'Section five', title: 'What it buys back' },
  { eyebrow: 'Section six', title: 'But what about the roads?' },
];

/**
 * Pairing a legend row with its slice.
 *
 * Every slice and every row carries the same two hooks, written by
 * `outlaysDonut` in ../lib/render: `data-slice` names the category, `data-mid`
 * is the angle at the middle of that slice. Holding either half lights both and
 * draws a connector between them.
 *
 * Nothing here is bound to a row or a slice. `update()` in app.ts replaces the
 * whole chart and the whole legend on every keystroke, so a listener on either
 * would die within a character. Everything is delegated to the host instead.
 */
import { DONUT_ANCHOR_R } from '../lib/render';

/** The viewBox of the chart is "-80 -80 160 160". Both numbers come from there. */
const VIEW_SIZE = 160;
const VIEW_ORIGIN = 80;

/** How far past the ring the connector runs before it turns for the legend. */
const STUB = 12;

/** Clearance the connector keeps from the chart, in pixels. */
const PAD = 10;

/** Above this width the legend sits beside the chart, so a connector is short. */
const WIDE = '(min-width:861px)';

/** A point in the host's own pixels, measured from its top left corner. */
type Point = [number, number];

interface Parts {
  host: HTMLElement;
  chart: SVGSVGElement;
  legend: HTMLElement;
  link: SVGSVGElement;
}

let parts: Parts | null = null;

/** The category the reader is holding, or null. */
let active: string | null = null;

/** True when a tap set the highlight, so it stays until a tap clears it. */
let held = false;

function sliceOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const owner = target.closest('[data-slice]');
  return owner ? owner.getAttribute('data-slice') : null;
}

function paint(): void {
  if (!parts) return;
  const { host, chart, legend } = parts;

  host.classList.toggle('is-live', active !== null);
  for (const node of chart.querySelectorAll('.dn-slice')) {
    node.classList.toggle('is-on', node.getAttribute('data-slice') === active);
  }
  for (const node of legend.querySelectorAll('.dn-row')) {
    node.classList.toggle('is-on', node.getAttribute('data-slice') === active);
  }
  drawLink();
}

/**
 * The connector, in the host's own pixels.
 *
 * Every measurement is read fresh, so a resize, a scroll or a re-render needs
 * no listener of its own. A slice too thin to draw has no path; its row still
 * lights, and it simply gets no connector.
 */
function drawLink(): void {
  if (!parts) return;
  const { host, chart, legend, link } = parts;

  link.textContent = '';
  if (active === null) return;
  if (!window.matchMedia(WIDE).matches) return;

  const escaped = CSS.escape(active);
  const path = chart.querySelector<SVGElement>('[data-slice="' + escaped + '"]');
  const row = legend.querySelector<HTMLElement>('[data-slice="' + escaped + '"]');
  const dotEl = row?.querySelector<HTMLElement>('.dn-dot');
  if (!path || !dotEl) return;

  const mid = Number(path.getAttribute('data-mid'));
  if (!isFinite(mid)) return;

  const hostBox = host.getBoundingClientRect();
  const chartBox = chart.getBoundingClientRect();
  const dotBox = dotEl.getBoundingClientRect();
  if (!chartBox.width || !hostBox.width) return;

  // The viewBox is square and the box is square, so one scale covers both axes.
  const k = chartBox.width / VIEW_SIZE;
  const angle = ((mid - 90) * Math.PI) / 180;

  const at = (radius: number): Point => [
    chartBox.left + (radius * Math.cos(angle) + VIEW_ORIGIN) * k - hostBox.left,
    chartBox.top + (radius * Math.sin(angle) + VIEW_ORIGIN) * k - hostBox.top,
  ];

  const anchor = at(DONUT_ANCHOR_R);
  const stub = at(DONUT_ANCHOR_R + STUB);
  const dot: Point = [
    dotBox.left - 6 - hostBox.left,
    dotBox.top + dotBox.height / 2 - hostBox.top,
  ];

  // The chart box, in the same host pixels, so the route can walk around it.
  const box = {
    top: chartBox.top - hostBox.top,
    bottom: chartBox.bottom - hostBox.top,
    right: chartBox.right - hostBox.left,
  };
  const gutter = Math.max((box.right + dot[0]) / 2, box.right + PAD);

  const route = [anchor, ...legOf(stub, box, gutter), dot];

  link.setAttribute(
    'viewBox',
    '0 0 ' + hostBox.width.toFixed(2) + ' ' + hostBox.height.toFixed(2),
  );
  link.innerHTML =
    '<path d="' +
    route.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ') +
    '"/>' +
    '<circle cx="' + anchor[0].toFixed(2) + '" cy="' + anchor[1].toFixed(2) + '" r="2"/>';
}

/**
 * The turns between the stub and the legend.
 *
 * Seven of the ten slices face left, so a straight run at the dot would cut
 * across the ring and over the total in the middle of it. The connector goes
 * around the chart instead: out of the ring, past its top or its bottom
 * whichever is nearer, then down the gutter beside the legend.
 */
function legOf(
  stub: Point,
  box: { top: number; bottom: number; right: number },
  gutter: number,
): Point[] {
  // Already past the legend edge: nothing can be in the way.
  if (stub[0] >= gutter) return [stub];

  // Clear of the chart above or below it: one turn into the gutter is enough.
  if (stub[1] <= box.top || stub[1] >= box.bottom) return [stub, [gutter, stub[1]]];

  // Beside the chart: leave by the nearer end of it first.
  const viaY =
    stub[1] - box.top < box.bottom - stub[1] ? box.top - PAD : box.bottom + PAD;
  return [stub, [stub[0], viaY], [gutter, viaY]];
}

function setActive(id: string | null): void {
  if (id === active) return;
  active = id;
  paint();
}

export function initDonutHover(
  host: HTMLElement,
  chart: SVGSVGElement,
  legend: HTMLElement,
  link: SVGSVGElement,
): void {
  parts = { host, chart, legend, link };

  host.addEventListener('pointerover', (event) => {
    if (held) return;
    const id = sliceOf(event.target);
    if (id) setActive(id);
  });

  host.addEventListener('pointerout', (event) => {
    if (held) return;
    // A re-render destroys the node under the cursor, and the browser reports
    // that as the pointer leaving. It did not. The target is detached; ignore
    // it and let refreshDonutHover put the highlight back on the new node.
    if (event.target instanceof Node && !host.contains(event.target)) return;
    // Moving between two children of the same row is not leaving it either.
    if (sliceOf(event.relatedTarget) === active) return;
    setActive(null);
  });

  // A touch has no hover. A tap picks a category and keeps it.
  host.addEventListener('click', (event) => {
    if ((event as PointerEvent).pointerType === 'mouse') return;
    const id = sliceOf(event.target);
    if (!id) return;
    if (held && id === active) {
      held = false;
      setActive(null);
      return;
    }
    held = true;
    setActive(id);
  });

  document.addEventListener('click', (event) => {
    if (!held) return;
    if (event.target instanceof Node && host.contains(event.target)) return;
    held = false;
    setActive(null);
  });

  // The rows are focusable, so the pairing is reachable without a pointer.
  host.addEventListener('focusin', (event) => {
    const id = sliceOf(event.target);
    if (id) {
      held = false;
      setActive(id);
    }
  });

  host.addEventListener('focusout', (event) => {
    const to = (event as FocusEvent).relatedTarget;
    if (to instanceof Node && host.contains(to)) return;
    setActive(null);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && active !== null) {
      held = false;
      setActive(null);
    }
  });
}

/**
 * Put the highlight back after app.ts has rewritten the chart and the legend.
 * If the category is gone, or the whole section is hidden, the state is dropped.
 */
export function refreshDonutHover(): void {
  if (!parts || active === null) return;

  const escaped = CSS.escape(active);
  const stillThere = parts.legend.querySelector('[data-slice="' + escaped + '"]');
  if (!stillThere || !parts.host.isConnected || parts.host.offsetParent === null) {
    held = false;
    active = null;
  }
  paint();
}

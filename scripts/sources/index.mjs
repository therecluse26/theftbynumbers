/**
 * Every updater the project has.
 *
 * An updater refreshes one or more fields of one data file. To add one:
 *   1. Write it in this folder, following the shape below.
 *   2. Add it to UPDATERS.
 *   3. Point the field's meta block at it: updateMode "fetch", updater "<name>".
 *
 * The shape:
 *   name      unique, matches meta.fields[...].updater
 *   fileId    which data file it writes, from scripts/lib/registry.mjs
 *   fields    the meta.fields keys it owns
 *   describe  one line, shown in the run log
 *   run({ data, log, force })  mutates data, returns [{ path, from, to }]
 *
 * An updater must throw when the source looks wrong. A throw leaves the file
 * untouched, which is the safe outcome for an unattended job.
 */
import goldSpot from './gold-spot.mjs';
import zillowZhvi from './zillow-zhvi.mjs';

export const UPDATERS = [goldSpot, zillowZhvi];

export function findUpdater(name) {
  return UPDATERS.find((u) => u.name === name);
}

/** Installs the hooks in ts-hooks.mjs. Load with `node --import`. */
import { register } from 'node:module';

register('./ts-hooks.mjs', import.meta.url);

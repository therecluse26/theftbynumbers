/**
 * Module hooks that let plain Node import the site's TypeScript.
 *
 * Node 24 strips the types on its own. It will not do the two things a
 * bundler does for free:
 *
 *   1. Resolve an extensionless import. `./data` has to become `./data.ts`.
 *   2. Import JSON without an explicit `with { type: 'json' }` attribute.
 *
 * Both are added here, so scripts/check-tax.mjs can import src/lib/tax.ts and
 * test the same arithmetic the page runs. No production file changes shape to
 * make itself testable.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXTENSIONS = ['.ts', '.mjs', '.js'];

export async function resolve(specifier, context, next) {
  // Vite inlines JSON at build time and needs no attribute. Node does.
  if (specifier.endsWith('.json')) {
    const resolved = await next(specifier, context);
    return { ...resolved, format: 'json', importAttributes: { type: 'json' } };
  }

  const relative = specifier.startsWith('.');
  const bare = !/\.[a-z]+$/i.test(specifier);
  if (relative && bare && context.parentURL) {
    for (const extension of EXTENSIONS) {
      const candidate = new URL(specifier + extension, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return next(specifier + extension, context);
      }
    }
  }

  return next(specifier, context);
}

// @ts-check
import { defineConfig } from 'astro/config';

// The site is fully static. Every number on the page is baked in at build
// time from the JSON files in src/data. A data update therefore needs a
// rebuild, which is what the scheduled job will trigger.
export default defineConfig({
  site: 'https://endthetheft.com',
  output: 'static',
  build: {
    inlineStylesheets: 'always',
  },
});

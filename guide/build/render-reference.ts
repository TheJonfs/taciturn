// Planner Content Reference render — emits the terse mechanical mirror.
//
// Runs under plain tsx (no Vite, no Paged.js): reference.ts imports only
// the data doorway and the two formatters, none of which pull a `?raw`
// SVG, so the whole thing resolves through tsconfig path aliases.
// Invoked standalone by `npm run build:reference` and folded into
// `npm run build:guide` after the PDF render.
//
// Output is `guide/output/planner-content-reference.md` — a gitignored
// build artifact (like the PDF), handed to the planner thread out of band.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildReference } from './reference.ts';

const OUTPUT = fileURLToPath(new URL('../output/planner-content-reference.md', import.meta.url));

try {
  writeFileSync(OUTPUT, buildReference(), 'utf8');
  console.log(`Planner reference rendered: ${OUTPUT}`);
} catch (err: unknown) {
  console.error(err);
  process.exit(1);
}

// Public API of src/content.
//
// Combines the per-kind stubs into the default Catalog. The app entry point
// calls `loadDefaultCatalog()` once at startup and threads the result
// through the engine per ADR-0004.

import { createCatalog, type Catalog } from '@engine/index.ts';
import { abilities } from './abilities/index.ts';
import { classes } from './classes/index.ts';
import { items } from './items/index.ts';
import { statusTypes } from './statuses/index.ts';

export function loadDefaultCatalog(): Catalog {
  return createCatalog({ statusTypes, abilities, classes, items });
}

// TABA M2 progression — the component cost catalog.
//
// The static "what does each unlockable cost, and where does its spend count"
// table. One entry per `UnlockToken` (every active, passive, item, and
// Calculator parameter/value a unit can buy).
//
// SUBSTRATE vs CONTENT split: this file ships the SHAPE (`ComponentMeta`), the
// lookup helpers, and an EMPTY production registry. The ~110 real JP costs
// (from `docs/TABADesign/m2-jp-costing-budget.md`) are entered in the content
// session. Every selector takes the catalog as a parameter (table-driven), so
// the substrate logic is fully testable against fixtures now and picks up the
// real numbers with zero code change when the content lands.
//
// A component's TIER/HALF for spend-accounting is NOT stored here — it is
// DERIVED from `nativeClass` via CLASS_TIER_MAP (rule 5: don't duplicate
// derivable data). Buying a Monk ability counts toward physical-Tier-1
// because Monk sits there; the catalog only needs to name the owning class.

import type { ClassId } from '@engine/index.ts';
import type { UnlockToken } from './tokens.ts';
import { tokenKey } from './tokens.ts';

export interface ComponentMeta {
  readonly token: UnlockToken;
  // JP price. For actives/items/math components this is the unlock-to-use
  // price; for R/S/M passives it is the export tax (free in the native class).
  readonly cost: number;
  // The class this component belongs to — determines which (half, tier) slot
  // its `cost` accumulates into for tier-gating. Also the "native class" for
  // passive export gating.
  readonly nativeClass: ClassId;
  // Passive export legality (R/S/M only). `false` marks a native-only passive
  // (Expert Former, Mathematician) that can NEVER be equipped off its class —
  // no export path at any price. Omitted / `true` → exportable at `cost`.
  // Ignored for actives / items / math components (those never equip as
  // passives). See `canEquipPassive`.
  readonly exportable?: boolean;
}

// tokenKey → meta. Built from an entry list so authors write one array and the
// key is derived (no hand-maintained keys to drift).
export type ComponentCatalog = ReadonlyMap<string, ComponentMeta>;

export function buildComponentCatalog(
  entries: ReadonlyArray<ComponentMeta>,
): ComponentCatalog {
  const map = new Map<string, ComponentMeta>();
  for (const entry of entries) {
    const key = tokenKey(entry.token);
    if (map.has(key)) {
      throw new Error(`buildComponentCatalog: duplicate component '${key}'`);
    }
    map.set(key, entry);
  }
  return map;
}

// Meta for a token. Throws loudly on an unknown token (an unlock the catalog
// doesn't price is an authoring error — fail loud, never charge 0 silently).
export function componentMetaOf(token: UnlockToken, catalog: ComponentCatalog): ComponentMeta {
  const meta = catalog.get(tokenKey(token));
  if (meta === undefined) {
    throw new Error(`componentMetaOf: no catalog entry for '${tokenKey(token)}'`);
  }
  return meta;
}

// The production registry. EMPTY until the content session enters the real
// per-class cost tables from the budget doc. Consumers pass this (or a
// fixture) into the selectors; nothing hard-codes it.
export const COMPONENT_CATALOG: ComponentCatalog = buildComponentCatalog([]);

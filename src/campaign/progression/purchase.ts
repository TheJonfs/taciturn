// TABA M2 progression — the purchase composition.
//
// Buying a component is two steps that belong together: spend (`unlockComponent`)
// then, if that spend crossed a tier threshold, hand each NEWLY-reclassable class
// its tier-scaled head-start grant (`grantOnClassUnlock`) — the brief's
// "whole tier opens; a freshly-unlocked class can afford its onboarding"
// (solves e.g. the Calculator's dead-until-three-components problem). Grants land
// per newly-opened class, sized by that class's tier (T1 100 / T2 200 / T3 300 +
// bounded random).
//
// Pure: same (unit, token, catalog, seed) → same result. The caller reports the
// `ignited` classes for the constellation's ignite animation + a toast.

import { deriveActionSeed, type ClassId } from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';
import type { ComponentCatalog } from './component-catalog.ts';
import type { UnlockToken } from './tokens.ts';
import { reclassableClasses } from './ledger.ts';
import { tierEntryOf } from './tier-map.ts';
import { grantOnClassUnlock, unlockComponent } from './unlock.ts';

export interface PurchaseResult {
  readonly unit: CampaignUnit;
  // Classes that became reclass-able *because of* this purchase (each granted a
  // head-start purse). Empty when the purchase opened nothing new.
  readonly ignited: ReadonlyArray<ClassId>;
}

// A stable per-(unit, class) seed for the grant's random bonus. The grant amount
// is stored (earnedByClass), so replay determinism isn't required — this only
// needs to vary the bonus per class without ambient RNG.
function grantSeed(unit: CampaignUnit, classId: ClassId): number {
  const s = `${String(unit.id)}:${String(classId)}:${unit.unlocks.length}`;
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function purchaseComponent(
  unit: CampaignUnit,
  token: UnlockToken,
  catalog: ComponentCatalog,
): PurchaseResult {
  const before = new Set(reclassableClasses(unit, catalog).map(String));
  let next = unlockComponent(unit, token, catalog); // throws if unaffordable / owned

  const ignited: ClassId[] = [];
  for (const cid of reclassableClasses(next, catalog)) {
    if (before.has(String(cid))) continue;
    ignited.push(cid);
    next = grantOnClassUnlock(next, cid, tierEntryOf(cid).tier, deriveActionSeed(grantSeed(next, cid), 0));
  }
  return { unit: next, ignited };
}

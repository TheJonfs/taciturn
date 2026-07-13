// TABA — class-innate passives auto-equipped at unit creation (S94, Chris).
//
// A class's `freeAbilities` are its identity kit: the basic attack plus its
// innate passives (cost 0 when equipped in their own class, so they never
// press on bucket capacity). Every campaign-CREATED unit — the Ch1 leads,
// the rolled generics, hires, skirmish and story enemies, guests — should
// arrive with those passives EQUIPPED, not merely equippable: a fresh
// Knight counters, a fresh Pyromancer smolders. Player edits after creation
// are untouched (this runs at build time only; unequipping later is a
// loadout choice like any other).

import { type AbilityId, type Catalog, type ClassId, type Loadout } from '@engine/index.ts';

// Merge the class's innate (free) passives into `loadout`'s passive
// buckets, each in its definition's own bucket, deduplicated against
// anything already authored there (e.g. a plot lead's signature innate).
// Authored order is preserved; innates append.
export function withInnatePassives(loadout: Loadout, classId: ClassId, catalog: Catalog): Loadout {
  const merged: Record<string, AbilityId[]> = Object.fromEntries(
    Object.entries(loadout.passiveBuckets).map(([bucket, ids]) => [bucket, [...ids]]),
  );
  for (const id of catalog.getClass(classId).freeAbilities) {
    const def = catalog.getAbility(id);
    if (def.kind !== 'passive') continue; // 'attack' and other actives
    const key = String(def.bucket);
    const bucket = (merged[key] ??= []);
    if (!bucket.includes(id)) bucket.push(id);
  }
  return { ...loadout, passiveBuckets: merged };
}

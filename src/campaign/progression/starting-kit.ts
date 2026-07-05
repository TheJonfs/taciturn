// TABA M2 progression — starting-kit seeding (gating-live migration).
//
// When JP-gating goes live the fold stamps each unit's usable-ability allowlist
// from its `unlocks`. Authored units carry a full loadout but no unlocks, so a
// naive flip would leave them unable to use any of their kit in battle. This
// derives a unit's STARTING unlocks from its loadout so the authored kit is
// pre-unlocked and playable; gating then bites only on what a unit trains
// BEYOND its starting kit (Chris's call).
//
// What gets seeded (matching "pre-unlock the actives/items in equipped command
// sets + equipped passives"):
//   - every ACTIVE / ITEM / MATH component native to the unit's class and to any
//     equipped secondary-command class (the wielded command sets, wholesale),
//   - every equipped NON-native passive (the export tax, so it's owned).
// Native-class passives are free-in-class — not seeded (unlocking one would
// wrongly charge JP).
//
// `earnedByClass` is set to EXACTLY the seeded spend per class, so
// `available = earned − spent = 0`: a starting veteran wields a full kit with no
// idle JP. (Consequence: the seeded spend counts toward tier thresholds, so a
// veteran may start with an adjacent reclass tier open — intended for level-25
// authored units; dial the seed scope if that's too generous.)

import { bucketId, type Catalog, type ClassId, type CommandSetId, type Loadout } from '@engine/index.ts';

const PASSIVE_BUCKETS = [bucketId('reaction'), bucketId('support'), bucketId('movement')];
import type { UnlockToken } from './tokens.ts';
import { tokenKey } from './tokens.ts';
import { COMPONENT_ENTRIES } from './component-catalog-data.ts';
import { componentMetaOf, type ComponentCatalog } from './component-catalog.ts';

export interface StartingKit {
  readonly unlocks: ReadonlyArray<UnlockToken>;
  readonly earnedByClass: Record<string, number>;
}

// Reverse of `class → firstActionCommandSet`: which class owns a command set.
function commandSetOwners(catalog: Catalog): Map<string, ClassId> {
  const map = new Map<string, ClassId>();
  for (const cls of catalog.classes()) map.set(String(cls.firstActionCommandSet), cls.id);
  return map;
}

function secondaryClasses(loadout: Loadout, catalog: Catalog): ReadonlyArray<ClassId> {
  const owners = commandSetOwners(catalog);
  const out: ClassId[] = [];
  for (const [bucket, sets] of Object.entries(loadout.actionBuckets)) {
    if (bucket === 'first_action') continue; // primary = the class itself
    for (const csId of sets as ReadonlyArray<CommandSetId>) {
      const owner = owners.get(String(csId));
      if (owner !== undefined) out.push(owner);
    }
  }
  return out;
}

export function seedStartingKit(
  classId: ClassId,
  loadout: Loadout,
  catalog: Catalog,
  componentCatalog: ComponentCatalog,
): StartingKit {
  const seedClasses = new Set<string>([String(classId), ...secondaryClasses(loadout, catalog).map(String)]);
  const tokens = new Map<string, UnlockToken>();

  // Wielded command sets, wholesale: every active/item/math component of the
  // primary + secondary classes. (Passives of those classes are handled below.)
  for (const meta of COMPONENT_ENTRIES) {
    if (!seedClasses.has(String(meta.nativeClass))) continue;
    // TABA Seam 3: unit-restricted components are NEVER seeded — they are
    // EARNED (buyable, paced), not part of any unit's starting kit (the brief's
    // "not auto-unlocked"). Skipping them here also stops a restricted component
    // leaking to a non-owner of the same native class.
    if (meta.restrictedToUnit !== undefined) continue;
    if (meta.token.kind === 'ability') {
      if (!catalog.hasAbility(meta.token.id) || catalog.getAbility(meta.token.id).kind !== 'active') continue;
    }
    tokens.set(tokenKey(meta.token), meta.token);
  }

  // Equipped NON-native passives — the export tax, so they read as owned.
  const equippedPassives = PASSIVE_BUCKETS.flatMap((b) => loadout.passiveBuckets[b] ?? []);
  for (const abilityId of equippedPassives) {
    const token: UnlockToken = { kind: 'ability', id: abilityId };
    const key = tokenKey(token);
    if (tokens.has(key) || !componentCatalog.has(key)) continue;
    if (componentMetaOf(token, componentCatalog).nativeClass === classId) continue; // native = free
    tokens.set(key, token);
  }

  // earned == spent per class → available 0.
  const earnedByClass: Record<string, number> = {};
  for (const token of tokens.values()) {
    const meta = componentMetaOf(token, componentCatalog);
    const cls = String(meta.nativeClass);
    earnedByClass[cls] = (earnedByClass[cls] ?? 0) + meta.cost;
  }

  return { unlocks: [...tokens.values()], earnedByClass };
}

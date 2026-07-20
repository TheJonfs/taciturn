// TABA S94 — the enemy kit framework: unlocks and gear as a function of level.
//
// Chris (playtest batch two): generated enemies arrived with the FULL class
// starting kit — an L2 Hydrologist casting Tidal Wave, an L2 Pyromancer with
// Inner Warmth. Generated enemies now "earn" like players do:
//
//   - KIT: a level-L enemy has a JP BUDGET (`level × ENEMY_JP_PER_LEVEL`,
//     the economy-config dial) and spends it down its class's ACTIVE-side
//     component list IN AUTHORING ORDER (the designed curriculum), stopping
//     at the first component it can't afford — a coherent PREFIX of the
//     class tree, sized to its level. Passive components are skipped (a
//     bought passive does nothing unequipped; innate passives already
//     arrive equipped via `withInnatePassives`); restricted (unit-
//     signature) components never spawn on generics.
//   - BRAVE/FAITH: the same 50–70 band the player's campaign-start
//     generics roll — DETERMINISTIC (hashed from level + slot index), so
//     the same inputs still build the same party (replay/authoring
//     safety; true per-encounter variance belongs to the M4 generator).
//   - GEAR: a basic weapon (Dagger) where the class may legally hold one
//     (the draft-legality resolver decides, like the hire kit) — no more
//     bare-handed lineups.
//
// Named story units (Theo, Wiegraf, the Ruk captain) stay hand-authored;
// this framework covers GENERATED lineups — skirmishes and the Ch1
// placeholder story lineups — and M4's real generator inherits the dial.

import {
  bucketId,
  EMPTY_UNIT_EQUIPMENT,
  itemId,
  slotIneligibilityReason,
  type Catalog,
  type ClassId,
  type EquipmentSlotId,
  type Loadout,
  type UnitEquipment,
} from '@engine/index.ts';
import { authoredEnemy } from './authored-enemy.ts';
import { ENEMY_JP_PER_LEVEL } from './economy-config.ts';
import { withInnatePassives } from './innate-passives.ts';
import { COMPONENT_ENTRIES, type UnlockToken } from './progression/index.ts';
import type { CampaignUnit } from './types.ts';

// The JP a generated level-L enemy may have "spent" on its kit.
export function enemyJpBudget(level: number): number {
  return Math.max(0, level) * ENEMY_JP_PER_LEVEL;
}

// The curriculum-prefix kit: the class's active-side components in
// authoring order, bought while the budget lasts.
export function enemyKitForLevel(
  cls: ClassId,
  level: number,
  catalog: Catalog,
): ReadonlyArray<UnlockToken> {
  let remaining = enemyJpBudget(level);
  const kit: UnlockToken[] = [];
  for (const meta of COMPONENT_ENTRIES) {
    if (meta.nativeClass !== cls || meta.restrictedToUnit !== undefined) continue;
    if (meta.token.kind === 'ability') {
      if (!catalog.hasAbility(meta.token.id) || catalog.getAbility(meta.token.id).kind !== 'active') {
        continue; // passives: skipped, not charged (see header)
      }
    }
    if (meta.cost > remaining) break; // stop at the first unaffordable — prefix, not knapsack
    remaining -= meta.cost;
    kit.push(meta.token);
  }
  return kit;
}

// Deterministic 50–70 roll for a generated enemy's Brave/Faith — hashed
// from (level, slot index, which stat), matching the player generics' band.
export function enemyBraveFaith(level: number, index: number): { brave: number; faith: number } {
  const roll = (salt: number): number => {
    let x = (level * 2654435761 + index * 40503 + salt * 69069) >>> 0;
    x = (x * 9301 + 49297) % 233280;
    return 50 + Math.floor((x / 233280) * 21);
  };
  return { brave: roll(1), faith: roll(2) };
}

// Basic generated-enemy gear: a Dagger where the class may legally hold
// one (legality-resolved, like the hire kit); bare slot otherwise.
export function basicEnemyGear(cls: ClassId, catalog: Catalog): UnitEquipment {
  const dagger = itemId('dagger');
  const slot: EquipmentSlotId = 'rightHand' as EquipmentSlotId;
  if (
    catalog.hasItem(dagger) &&
    slotIneligibilityReason(cls, slot, catalog.getItem(dagger), catalog) === null
  ) {
    return { ...EMPTY_UNIT_EQUIPMENT, rightHand: dagger };
  }
  return EMPTY_UNIT_EQUIPMENT;
}

// One fully-framed generated enemy: the class's first-action command set +
// innate passives, level-budgeted curriculum kit, deterministic Brave/Faith
// band roll, basic gear. Extracted from the skirmish stub (S98 Tier 2) so
// authored lineups (`enemiesFromLineup`) and generated skirmish parties
// build enemies through the SAME constructor — one framework, two callers.
export function generatedEnemyUnit(args: {
  readonly id: string;
  readonly name: string;
  readonly classId: ClassId;
  readonly level: number;
  // Slot index — salts the deterministic Brave/Faith roll so a party
  // doesn't share one statline.
  readonly index: number;
  readonly catalog: Catalog;
}): CampaignUnit {
  const { id, name, classId: cls, level, index, catalog } = args;
  const loadout: Loadout = withInnatePassives(
    {
      actionBuckets: { [bucketId('first_action')]: [catalog.getClass(cls).firstActionCommandSet] },
      passiveBuckets: {},
    },
    cls,
    catalog,
  );
  return authoredEnemy({
    id,
    name,
    classId: cls,
    level,
    loadout,
    equipment: basicEnemyGear(cls, catalog),
    unlocks: enemyKitForLevel(cls, level, catalog),
    ...enemyBraveFaith(level, index),
  });
}

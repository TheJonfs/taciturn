// Authored-lineup consumption (Cartographer unit mode, S98 Tier 2/3).
//
// A generated lineup module (src/content/battles/<key>-battle.ts) carries a
// `LineupSpec`: the SPATIAL half of the battle (ordered slots with position +
// facing) plus each enemy slot's authored class + level and, since Tier 3,
// optional per-enemy OVERRIDES (name/Brave/Faith/gender, kit budget or an
// explicit component list, secondary command set, equipped R/S/M passives,
// full equipment). The content layer consumes only the spatial half
// (`buildBattleFromLineup` restages fixture units). THIS module consumes the
// identity half: it turns each slot into a `NodeBattle.enemies` spec —
// composer defaults where no override is authored, authored values where
// one is (the same `AuthoredEnemySpec` surface named units use).
//
// Index alignment is the contract: `enemiesFromLineup(spec)[i]` re-skins the
// template slot built from `spec.enemies[i]` (the fold maps by order), so an
// authored lineup's classes stand exactly where the tool placed them. Named
// story units (Theo, the Ruk captain) stay hand-authored in node-content.ts —
// author them as `[theoRenault(...), ...enemiesFromLineup(spec, catalog).slice(1)]`
// style mixes, or let them re-skin the lead slot the tool ordered first.
//
// `composeLineupEnemyDraft` routes through the M4 unified composer
// (`composeEnemyBuild`): the Cartographer's live legality check builds the
// same loadout/equipment the fold will, so the tool validates exactly what
// ships. The per-slot SEED is derived from (lineup key, slot index) —
// stable across sessions, so an authored battle's generated halves never
// shift under the author.

import {
  abilityId,
  bucketId,
  classId,
  deriveActionSeed,
  EMPTY_UNIT_EQUIPMENT,
  itemId,
  commandSetId,
  type AbilityId,
  type Catalog,
  type Loadout,
  type MathSkillParameter,
  type MathSkillValue,
  type UnitEquipment,
} from '@engine/index.ts';
import type {
  EnemyLineupSlot,
  LineupSpec,
  LineupUnlockRef,
} from '@content/battles/lineup-format.ts';
import { authoredEnemy } from './authored-enemy.ts';
import { composeEnemyBuild, stringSeed } from './enemy-generation.ts';
import { enemyBraveFaith } from './enemy-kit.ts';
import type { UnlockToken } from './progression/index.ts';
import type { CampaignUnit } from './types.ts';

// Brand a structural component ref from the spec into a real UnlockToken.
// mathValue ids serialize as strings ('3', 'prime', 'square'); numeric ones
// brand back to numbers.
export function unlockRefToToken(ref: LineupUnlockRef): UnlockToken {
  switch (ref.kind) {
    case 'ability':
      return { kind: 'ability', id: abilityId(ref.id) };
    case 'item':
      return { kind: 'item', id: itemId(ref.id) };
    case 'mathParameter':
      return { kind: 'mathParameter', id: ref.id as MathSkillParameter };
    case 'mathValue': {
      const n = Number(ref.id);
      return { kind: 'mathValue', id: (Number.isFinite(n) ? n : ref.id) as MathSkillValue };
    }
  }
}

// The deterministic per-slot composition seed: FNV-1a over the lineup key,
// branched by slot index. Exported so the Cartographer's editor echo and
// validation derive EXACTLY the seed the fold will (drift here would show
// the author a different enemy than ships).
export function lineupSlotSeed(lineupKey: string, slotIndex: number): number {
  return deriveActionSeed(stringSeed(lineupKey), slotIndex);
}

// The overridable halves of an enemy, composed exactly as the fold will see
// them. Exported so the Cartographer's validation can run the engine's
// draft-legality resolver on the REAL composition (no tool-side rebuild to
// drift).
export interface LineupEnemyDraft {
  readonly loadout: Loadout;
  readonly equipment: UnitEquipment;
  readonly unlocks: ReadonlyArray<UnlockToken>;
}

export function composeLineupEnemyDraft(
  slot: EnemyLineupSlot,
  catalog: Catalog,
  seed: number,
): LineupEnemyDraft {
  const cls = classId(slot.classId);
  const o = slot.overrides;

  const passiveBuckets: Record<string, AbilityId[]> = {};
  if (o?.passives !== undefined) {
    for (const bucket of ['reaction', 'support', 'movement'] as const) {
      const ids = o.passives[bucket];
      if (ids !== undefined && ids.length > 0) {
        passiveBuckets[bucketId(bucket)] = ids.map((id) => abilityId(id));
      }
    }
  }

  const equipment: UnitEquipment | undefined =
    o?.equipment !== undefined
      ? {
          ...EMPTY_UNIT_EQUIPMENT,
          ...Object.fromEntries(
            Object.entries(o.equipment).map(([slotId, id]) => [slotId, itemId(id as string)]),
          ),
        }
      : undefined;

  const build = composeEnemyBuild({
    classId: cls,
    level: slot.level,
    seed,
    catalog,
    ...(o?.unlocks !== undefined
      ? { unlocks: o.unlocks.map(unlockRefToToken) }
      : o?.jpBudget !== undefined
        ? { jpBudget: o.jpBudget }
        : {}),
    ...(equipment !== undefined ? { equipment } : {}),
    ...(o?.passives !== undefined ? { passiveBuckets } : {}),
    ...(o?.secondaryCommandSet !== undefined
      ? { secondaryCommandSet: commandSetId(o.secondaryCommandSet) }
      : {}),
  });
  return { loadout: build.loadout, equipment: build.equipment, unlocks: build.unlocks };
}

export function enemiesFromLineup(
  spec: LineupSpec,
  catalog: Catalog,
): ReadonlyArray<CampaignUnit> {
  return spec.enemies.map((slot, i) => {
    const cls = classId(slot.classId);
    const o = slot.overrides;
    const draft = composeLineupEnemyDraft(slot, catalog, lineupSlotSeed(spec.key, i));
    const band = enemyBraveFaith(slot.level, i);
    return authoredEnemy({
      id: `${spec.key}-enemy-${i + 1}`,
      name: o?.name ?? catalog.getClass(cls).name,
      classId: cls,
      level: slot.level,
      loadout: draft.loadout,
      equipment: draft.equipment,
      unlocks: draft.unlocks,
      brave: o?.brave ?? band.brave,
      faith: o?.faith ?? band.faith,
      ...(o?.gender !== undefined ? { gender: o.gender } : {}),
    });
  });
}

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
// framework defaults where no override is authored, authored values where
// one is (the same `AuthoredEnemySpec` surface named units use).
//
// Index alignment is the contract: `enemiesFromLineup(spec)[i]` re-skins the
// template slot built from `spec.enemies[i]` (the fold maps by order), so an
// authored lineup's classes stand exactly where the tool placed them. Named
// story units (Theo, the Ruk captain) stay hand-authored in node-content.ts —
// author them as `[theoRenault(...), ...enemiesFromLineup(spec, catalog).slice(1)]`
// style mixes, or let them re-skin the lead slot the tool ordered first.
//
// `composeLineupEnemyDraft` is the shared composer: the Cartographer's live
// legality check builds the same loadout/equipment the fold will, so the
// tool validates exactly what ships.

import {
  abilityId,
  bucketId,
  classId,
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
import {
  basicEnemyGear,
  enemyBraveFaith,
  enemyKitForBudget,
  enemyKitForLevel,
  generatedEnemyUnit,
} from './enemy-kit.ts';
import { withInnatePassives } from './innate-passives.ts';
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
): LineupEnemyDraft {
  const cls = classId(slot.classId);
  const o = slot.overrides;

  const unlocks: ReadonlyArray<UnlockToken> =
    o?.unlocks !== undefined
      ? o.unlocks.map(unlockRefToToken)
      : o?.jpBudget !== undefined
        ? enemyKitForBudget(cls, o.jpBudget, catalog)
        : enemyKitForLevel(cls, slot.level, catalog);

  const passiveBuckets: Record<string, AbilityId[]> = {};
  for (const bucket of ['reaction', 'support', 'movement'] as const) {
    const ids = o?.passives?.[bucket];
    if (ids !== undefined && ids.length > 0) {
      passiveBuckets[bucketId(bucket)] = ids.map((id) => abilityId(id));
    }
  }
  const loadout = withInnatePassives(
    {
      actionBuckets: {
        [bucketId('first_action')]: [catalog.getClass(cls).firstActionCommandSet],
        ...(o?.secondaryCommandSet !== undefined
          ? { [bucketId('secondary_command_sets')]: [commandSetId(o.secondaryCommandSet)] }
          : {}),
      },
      passiveBuckets,
    },
    cls,
    catalog,
  );

  const equipment: UnitEquipment =
    o?.equipment !== undefined
      ? {
          ...EMPTY_UNIT_EQUIPMENT,
          ...Object.fromEntries(
            Object.entries(o.equipment).map(([slotId, id]) => [slotId, itemId(id as string)]),
          ),
        }
      : basicEnemyGear(cls, catalog);

  return { loadout, equipment, unlocks };
}

export function enemiesFromLineup(
  spec: LineupSpec,
  catalog: Catalog,
): ReadonlyArray<CampaignUnit> {
  return spec.enemies.map((slot, i) => {
    const cls = classId(slot.classId);
    const o = slot.overrides;
    if (o === undefined) {
      return generatedEnemyUnit({
        id: `${spec.key}-enemy-${i + 1}`,
        name: catalog.getClass(cls).name,
        classId: cls,
        level: slot.level,
        index: i,
        catalog,
      });
    }
    const draft = composeLineupEnemyDraft(slot, catalog);
    const band = enemyBraveFaith(slot.level, i);
    return authoredEnemy({
      id: `${spec.key}-enemy-${i + 1}`,
      name: o.name ?? catalog.getClass(cls).name,
      classId: cls,
      level: slot.level,
      loadout: draft.loadout,
      equipment: draft.equipment,
      unlocks: draft.unlocks,
      brave: o.brave ?? band.brave,
      faith: o.faith ?? band.faith,
      ...(o.gender !== undefined ? { gender: o.gender } : {}),
    });
  });
}

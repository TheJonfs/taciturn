// Battle setup — turn a BattleConfig into the immutable starting GameState.
// See docs/architecture/architecture-overview.md ("Rulesets and content")
// and ADR-0008.
//
// The construction is straightforward by design: BattleConfig declares
// what the battle is, the catalog supplies the static definitions, and
// `createInitialState` weaves them into the starting state. No
// reducer logic happens here — the result is what the action loop sees
// at sequence number 0.

import type { Catalog } from '../catalog/index.ts';
import {
  EMPTY_UNIT_EQUIPMENT,
  type BattleConfig,
  type GameState,
  type RulesetDefinition,
  type Unit,
  type UnitEquipment,
  type UnitId,
  type UnitPlacement,
} from '../types/index.ts';
import { validateLoadout } from '../abilities/validate.ts';
import { TRIGGER_THRESHOLD } from '../ct/constants.ts';
import { iterateEquippedItems, validateSlotItem } from '../items/equipment.ts';
import { runModifyStatQuery } from '../hooks/runners.ts';
import { applyStatus } from '../status/apply.ts';

export class BattleConfigError extends Error {
  override readonly name = 'BattleConfigError';
}

export function createInitialState(
  battleConfig: BattleConfig,
  catalog: Catalog,
): GameState {
  const ruleset = catalog.getRuleset(battleConfig.rulesetId);

  // Pre-build checks that don't need a constructed state.
  validateConfigStructure(battleConfig, catalog);

  const unitMap = new Map<UnitId, Unit>();
  for (const placement of battleConfig.units) {
    const unit = placementToUnit(placement, ruleset, battleConfig.masterSeed, catalog);
    unitMap.set(unit.id, unit);
  }

  let state: GameState = {
    battleId: battleConfig.battleId,
    map: battleConfig.map,
    teams: battleConfig.teams,
    ruleset: { id: battleConfig.rulesetId },
    units: unitMap,
    chargedActions: [],
    globalEffects: [],
    victoryConditions: battleConfig.victoryConditions,
    tick: 0,
    turnState: null,
    rng: { masterSeed: battleConfig.masterSeed, nextSeq: 0 },
    actionLog: [],
  };

  // Loadout validation runs against the constructed state, since the
  // canonical validateLoadout reads the unit through the state. Any
  // violation here is a battle-config authoring bug — fail loud.
  for (const unit of unitMap.values()) {
    const result = validateLoadout(state, unit.id, unit.loadout, catalog);
    if (!result.ok) {
      const summary = result.violations.map((v) => v.kind).join(', ');
      throw new BattleConfigError(
        `Unit ${JSON.stringify(unit.id)} has invalid loadout: ${summary}`,
      );
    }
  }

  // Apply equipment-granted statuses (per ADR-0028). Iterates each
  // unit's equipped items and applies any `statusGrants` with
  // `kind: 'equipment'` provenance — these instances become immune to
  // in-battle removal until the equipment itself is removed.
  state = applyEquipmentStatusGrants(state, catalog);

  // Fill current HP/MP from computed effective maxes when the
  // placement omitted explicit vitals. Reads through `modifyStatQuery`
  // so equipment / class / passive contributions to maxHp compose.
  // Per ADR-0028.
  state = fillVitalsFromComputedMaxes(state, battleConfig, catalog);

  return state;
}

function placementToUnit(
  placement: UnitPlacement,
  ruleset: RulesetDefinition,
  masterSeed: number,
  catalog: Catalog,
): Unit {
  const ct = placement.initialCT ?? resolveInitialCT(ruleset, placement, masterSeed);
  const equipment: UnitEquipment = placement.equipment ?? EMPTY_UNIT_EQUIPMENT;

  // Validate equipment placements against the class's permitted slots
  // and per-slot kind. Done here rather than in validateConfigStructure
  // because the class lookup + equipment-kind check needs the catalog
  // and is naturally per-unit.
  validateEquipmentPlacement(placement, equipment, catalog);

  // Vitals fill: when the placement omits vitals, leave hp/mp at 0
  // here and let `fillVitalsFromComputedMaxes` set them after equipment
  // statuses apply. Prevents the partial-state where HP is set from
  // base maxHp and then equipment bumps the cap (current HP would lag
  // the new max). Per ADR-0028.
  const vitals = placement.vitals ?? { hp: 0, mp: 0 };

  // Compose class-baseline resistances with the placement's explicit
  // overrides. Per-placement entries win over class-baseline entries for
  // the same tag (a hand-authored unit with a placement-side resistance
  // override takes precedence over the class baseline).
  const cls = catalog.getClass(placement.classId);
  const resistances = new Map(cls.baselineResistances ?? []);
  if (placement.resistances !== undefined) {
    for (const [tag, value] of placement.resistances) {
      resistances.set(tag, value);
    }
  }

  return {
    id: placement.id,
    team: placement.team,
    name: placement.name,
    classState: { currentClass: placement.classId },
    loadout: placement.loadout,
    equipment,
    position: placement.position,
    facing: placement.facing,
    ct,
    baseStats: placement.baseStats,
    vitals,
    resistances,
    statuses: placement.statuses ?? [],
  };
}

function validateEquipmentPlacement(
  placement: UnitPlacement,
  equipment: UnitEquipment,
  catalog: Catalog,
): void {
  const cls = catalog.getClass(placement.classId);
  for (const slot of ['leftHand', 'rightHand', 'headgear', 'armor', 'accessory'] as const) {
    const id = equipment[slot];
    if (id === null) continue;
    if (!cls.equipmentSlots[slot]) {
      throw new BattleConfigError(
        `Unit ${JSON.stringify(placement.id)}: class ${JSON.stringify(placement.classId)} ` +
          `does not permit ${slot}`,
      );
    }
    if (!catalog.hasItem(id)) {
      throw new BattleConfigError(
        `Unit ${JSON.stringify(placement.id)}: equipment id ${JSON.stringify(id)} not in catalog`,
      );
    }
    const item = catalog.getItem(id);
    try {
      validateSlotItem(slot, item);
    } catch (err) {
      throw new BattleConfigError(
        `Unit ${JSON.stringify(placement.id)}: ${(err as Error).message}`,
      );
    }
  }
}

function applyEquipmentStatusGrants(state: GameState, catalog: Catalog): GameState {
  let next = state;
  for (const unit of state.units.values()) {
    for (const { item } of iterateEquippedItems(unit, catalog)) {
      if (item.statusGrants === undefined) continue;
      for (const typeId of item.statusGrants) {
        const result = applyStatus(
          next,
          {
            targetId: unit.id,
            typeId,
            sourceUnitId: null,
            sourceActionSeq: null,
            sourceKind: 'equipment',
            sourceEquipmentId: item.id,
          },
          catalog,
        );
        next = result.newState;
      }
    }
  }
  return next;
}

function fillVitalsFromComputedMaxes(
  state: GameState,
  battleConfig: BattleConfig,
  catalog: Catalog,
): GameState {
  // Per ADR-0058: `maxMpBase` is a first-class stat; placements that
  // omit `vitals` fill BOTH hp and mp from the computed `maxHp` / `maxMp`
  // queries (so equipment contributions — Wizard's Robe +40 MP, Staff
  // of Abundance ×1.5 maxMp — compose before vitals land). Explicit
  // `placement.vitals` overrides still win when present.
  const explicitVitals = new Set<UnitId>();
  for (const p of battleConfig.units) {
    if (p.vitals !== undefined) explicitVitals.add(p.id);
  }
  if (explicitVitals.size === battleConfig.units.length) return state;

  const newUnits = new Map(state.units);
  for (const unit of state.units.values()) {
    if (explicitVitals.has(unit.id)) continue;
    const maxHp = runModifyStatQuery(state, catalog, {
      unit,
      statName: 'maxHp',
      baseValue: unit.baseStats.maxHpBase,
    });
    const maxMp = runModifyStatQuery(state, catalog, {
      unit,
      statName: 'maxMp',
      baseValue: unit.baseStats.maxMpBase,
    });
    newUnits.set(unit.id, {
      ...unit,
      vitals: {
        hp: Math.max(0, Math.floor(maxHp)),
        mp: Math.max(0, Math.floor(maxMp)),
      },
    });
  }
  return { ...state, units: newUnits };
}

// Resolve the ruleset's initial-CT formula. The exhaustive switch
// lights up when new kinds are added so the new variant is consciously
// handled.
function resolveInitialCT(
  ruleset: RulesetDefinition,
  placement: UnitPlacement,
  masterSeed: number,
): number {
  switch (ruleset.initialCT.kind) {
    case 'fixed':
      return ruleset.initialCT.value;
    case 'speed_with_variance': {
      const { speedFactor, variancePct } = ruleset.initialCT;
      const base = placement.baseStats.spd * speedFactor;
      // Stable per-unit variance: hash (masterSeed, unitId) into a unit
      // float, scale to ±(variancePct/2) of the threshold, add to base.
      const v = unitFloatFromKey(masterSeed, placement.id);
      const swing = (variancePct / 100) * TRIGGER_THRESHOLD;
      const offset = (v - 0.5) * swing;
      const raw = base + offset;
      // Floor at 0; ceil one below threshold so no unit starts pre-
      // triggered (the scheduler is the path that lifts CT to ≥ 100).
      return Math.max(0, Math.min(TRIGGER_THRESHOLD - 1, Math.round(raw)));
    }
    case 'uniform_int': {
      // Speed-independent uniform draw in `[min, max]` inclusive.
      // Stable per-unit: same (masterSeed, unitId) → same value.
      // Per ADR-0050.
      const { min, max } = ruleset.initialCT;
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      const span = hi - lo + 1;
      const v = unitFloatFromKey(masterSeed, placement.id);
      const draw = lo + Math.floor(v * span);
      // Floor at 0; ceil one below threshold so no unit starts pre-
      // triggered. Authoring `max >= 100` would be a content bug; clamp
      // defensively here rather than throw.
      return Math.max(0, Math.min(TRIGGER_THRESHOLD - 1, draw));
    }
  }
}

// mulberry32-style mixer over (masterSeed XOR string-hash(id)) → unit
// float in [0, 1). Stable by construction: same masterSeed + same
// unit id always produces the same value.
function unitFloatFromKey(masterSeed: number, key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  }
  let s = (masterSeed ^ h) >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Pre-build checks. Catches obvious authoring errors before state is
// constructed: duplicate unit ids, references to teams or classes that
// the BattleConfig / catalog doesn't carry. Loadout validation runs
// post-build (it reads through the state).
function validateConfigStructure(battleConfig: BattleConfig, catalog: Catalog): void {
  const declaredTeams = new Set(battleConfig.teams.map((t) => t.id));
  const seenUnitIds = new Set<UnitId>();

  for (const placement of battleConfig.units) {
    if (seenUnitIds.has(placement.id)) {
      throw new BattleConfigError(
        `BattleConfig has duplicate unit id ${JSON.stringify(placement.id)}`,
      );
    }
    seenUnitIds.add(placement.id);

    if (!declaredTeams.has(placement.team)) {
      throw new BattleConfigError(
        `Unit ${JSON.stringify(placement.id)} references team ${JSON.stringify(placement.team)} which is not declared in BattleConfig.teams`,
      );
    }

    if (!catalog.hasClass(placement.classId)) {
      throw new BattleConfigError(
        `Unit ${JSON.stringify(placement.id)} references class ${JSON.stringify(placement.classId)} which is not in the catalog`,
      );
    }
  }
}

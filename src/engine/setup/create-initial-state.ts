// Battle setup — turn a BattleConfig into the immutable starting GameState.
// See docs/architecture/architecture-overview.md ("Rulesets and content")
// and ADR-0008.
//
// The construction is straightforward by design: BattleConfig declares
// what the battle is, the catalog supplies the static definitions, and
// `createInitialState` weaves them into the starting state. No
// reducer logic happens here — the result is what the action loop sees
// at sequence number 0.
//
// Session 32 / ADR-0071: equipment status grants and ruleset-derived
// initial CT are no longer applied here. Instead, the orchestrator's
// pre-battle phase consumes `enumeratePreBattleActions(...)` and commits
// each as a logged action (`system_apply_status` /
// `system_set_ct`). Direct-state-mutation consumers that want the
// post-pre-battle-phase state can use `runPreBattlePhase` (commits each
// action through `commitAction`). Tests bypassing the orchestrator
// either call the helper or assert the pre-pre-battle-phase state.

import type { Catalog } from '../catalog/index.ts';
import {
  EMPTY_UNIT_EQUIPMENT,
  type BattleConfig,
  type GameState,
  type ProposedAction,
  type Unit,
  type UnitEquipment,
  type UnitId,
  type UnitPlacement,
} from '../types/index.ts';
import { validateLoadout } from '../abilities/validate.ts';
import { iterateEquippedItems, validateSlotItem } from '../items/equipment.ts';
import { runModifyStatQuery } from '../hooks/runners.ts';
import { commitAction } from '../actions/commit.ts';
import { resolveInitialCT } from './initial-ct.ts';

export class BattleConfigError extends Error {
  override readonly name = 'BattleConfigError';
}

export function createInitialState(
  battleConfig: BattleConfig,
  catalog: Catalog,
): GameState {
  // Pre-build checks that don't need a constructed state.
  validateConfigStructure(battleConfig, catalog);

  const unitMap = new Map<UnitId, Unit>();
  for (const placement of battleConfig.units) {
    const unit = placementToUnit(placement, catalog);
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

  // Fill current HP/MP from computed effective maxes when the
  // placement omitted explicit vitals. Reads through `modifyStatQuery`
  // so equipment / class / passive contributions to maxHp compose.
  // Equipment-derived `maxHp` / `maxMp` contributors fire here without
  // needing equipment-granted statuses applied first (the contributors
  // are registered by equipment slot, not by status). Per ADR-0028 /
  // ADR-0071.
  state = fillVitalsFromComputedMaxes(state, battleConfig, catalog);

  return state;
}

// Enumerate the pre-battle action queue: equipment-granted statuses
// authored as `system_apply_status` actions + ruleset-derived initial
// CT randomization as `system_set_ct` actions, one per unit lacking
// an explicit `placement.initialCT`. The orchestrator commits these
// before turn 0 fires so the action log captures the initial-state
// derivation from sequence 0 forward. Per ADR-0071.
//
// Pure: same `(state, battleConfig, catalog)` → same action sequence.
// Order: equipment grants first (unit iteration × equipped-item
// iteration × statusGrants iteration), then initial-CT settings (unit
// iteration). Stable enumeration order matters for action-log
// determinism across replays.
export function enumeratePreBattleActions(
  state: GameState,
  battleConfig: BattleConfig,
  catalog: Catalog,
): ReadonlyArray<ProposedAction> {
  const actions: ProposedAction[] = [];

  // (1) Equipment-granted statuses. Per ADR-0028 the instances become
  // permanent for the duration of the equipped item; the `system_apply_status`
  // reducer reads `customState` and the type's `composeApplyState` to
  // settle the magnitude/duration. We attribute via the new `context`
  // payload field for action-log formatting ("Tintinibar grants Regen").
  for (const unit of state.units.values()) {
    for (const { item } of iterateEquippedItems(unit, catalog)) {
      if (item.statusGrants === undefined) continue;
      for (const typeId of item.statusGrants) {
        actions.push({
          type: 'system_apply_status',
          source: 'system',
          payload: {
            targetId: unit.id,
            statusTypeId: typeId,
            sourceUnitId: null,
            context: { kind: 'pre_battle_equipment', itemId: item.id },
          },
        });
      }
    }
  }

  // (2) Initial-CT randomization. Skip units with an explicit
  // `placement.initialCT` — those are authoring choices, not formula
  // derivations, and the value already lives on `unit.ct`. The
  // remaining units get a `system_set_ct` action with the resolved CT.
  const ruleset = catalog.getRuleset(battleConfig.rulesetId);
  const explicitCtIds = new Set<UnitId>();
  for (const p of battleConfig.units) {
    if (p.initialCT !== undefined) explicitCtIds.add(p.id);
  }
  for (const placement of battleConfig.units) {
    if (explicitCtIds.has(placement.id)) continue;
    const ct = resolveInitialCT(ruleset, placement, battleConfig.masterSeed);
    actions.push({
      type: 'system_set_ct',
      source: 'system',
      payload: {
        targetId: placement.id,
        ct,
        source: { kind: 'initial_ct' },
      },
    });
  }

  return actions;
}

// Run the pre-battle phase against a freshly-constructed state. Commits
// each action from `enumeratePreBattleActions` through `commitAction` so
// the action log captures the sequence. Returns the post-pre-battle
// state. The orchestrator drives this step-by-step (one action per
// `step()` so the renderer can animate / pace); this helper is the
// one-shot convenience for tests + non-orchestrator callers.
//
// Failures throw — pre-battle actions are engine-emitted and should
// always validate against the constructed state. A failure here would
// be a programmer error.
export function runPreBattlePhase(
  state: GameState,
  battleConfig: BattleConfig,
  catalog: Catalog,
): GameState {
  let current = state;
  for (const action of enumeratePreBattleActions(current, battleConfig, catalog)) {
    const result = commitAction(current, action, catalog, {
      checkVictoryConditions: false,
    });
    if (!result.ok) {
      throw new Error(
        `runPreBattlePhase: pre-battle ${action.type} failed at ${result.stage}: ${result.reason}`,
      );
    }
    current = result.newState;
  }
  return current;
}

function placementToUnit(
  placement: UnitPlacement,
  catalog: Catalog,
): Unit {
  // Per ADR-0071 (Session 32): if the placement carries an explicit
  // `initialCT`, that value lands here. Otherwise CT starts at 0 and the
  // orchestrator's pre-battle phase emits a `system_set_ct` resolved via
  // `resolveInitialCT(ruleset, placement, masterSeed)`. Authoring
  // explicit `initialCT: 0` is functionally the same as omitting it
  // pre-S32 (no log entry either way for the zero value) — for the
  // formula-derived path, the orchestrator records the draw.
  const ct = placement.initialCT ?? 0;
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
    // Session 39a: fresh battle starts with empty stockpile, no
    // accumulated KO turns, and not yet removed. Field Kit (Alchemist
    // Support, S39b) populates a stockpile via the existing
    // statusGrants / battle-setup hook flow.
    stockpile: new Map(),
    turnsKOd: 0,
    removed: false,
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
    // Session 29: per-item class allowlist. Fails loud per CLAUDE.md
    // "don't catch errors silently."
    if (item.classRestrictions !== undefined && !item.classRestrictions.includes(placement.classId)) {
      throw new BattleConfigError(
        `Unit ${JSON.stringify(placement.id)}: class ${JSON.stringify(placement.classId)} ` +
          `cannot equip ${JSON.stringify(id)} (restricted to ${JSON.stringify([...item.classRestrictions])})`,
      );
    }
  }
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

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
  DEFAULT_SCENARIO_TIER,
  EMPTY_UNIT_EQUIPMENT,
  type BattleConfig,
  type GameState,
  type ItemId,
  type ProposedAction,
  type Unit,
  type UnitEquipment,
  type UnitId,
  type UnitPlacement,
} from '../types/index.ts';
import { validateLoadout } from '../abilities/validate.ts';
import { isEquipment, iterateEquippedItems, validateSlotItem } from '../items/equipment.ts';
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
    // Opaque scalar copied through (the campaign fills it with the chapter;
    // MW/demo/test omit it → DEFAULT_SCENARIO_TIER). Set explicitly so real
    // battles always carry a value; readers still default for hand-built states.
    scenarioTier: battleConfig.scenarioTier ?? DEFAULT_SCENARIO_TIER,
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

  // (2) Initial CT. Precedence (S74, ADR-0125):
  //   (a) equipment `battleStartCt` (Greaves of Seraphis → 100) — a
  //       costed, deliberate seed; wins over everything and emits a
  //       `system_set_ct` with `source: { kind: 'equipment' }`.
  //   (b) explicit `placement.initialCT` — an authoring choice; the
  //       value already lives on `unit.ct`, so no formula draw and no
  //       `system_set_ct` (existing behavior).
  //   (c) otherwise the ruleset formula draw, recorded as a
  //       `system_set_ct` with `source: { kind: 'initial_ct' }`.
  // The `system_set_ct` reducer clamps to [0, 99], so a 100-seed lands at
  // the pre-trigger ceiling (still "acts first").
  const ruleset = catalog.getRuleset(battleConfig.rulesetId);
  const explicitCtIds = new Set<UnitId>();
  for (const p of battleConfig.units) {
    if (p.initialCT !== undefined) explicitCtIds.add(p.id);
  }
  for (const placement of battleConfig.units) {
    const unit = state.units.get(placement.id);
    const seed = unit === undefined ? null : equipmentBattleStartCt(unit, catalog);
    if (seed !== null) {
      actions.push({
        type: 'system_set_ct',
        source: 'system',
        payload: {
          targetId: placement.id,
          ct: seed.ct,
          source: { kind: 'equipment', itemId: seed.itemId },
        },
      });
      continue;
    }
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

// The strongest battle-start CT seed across a unit's equipped items, or
// null if none declare one (S74, ADR-0125). When two items both declare
// `battleStartCt` (no v1 case), the larger value wins; ties break on the
// item id for determinism.
function equipmentBattleStartCt(
  unit: Unit,
  catalog: Catalog,
): { ct: number; itemId: ItemId } | null {
  let best: { ct: number; itemId: ItemId } | null = null;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.battleStartCt === undefined) continue;
    if (
      best === null ||
      item.battleStartCt > best.ct ||
      (item.battleStartCt === best.ct && item.id < best.itemId)
    ) {
      best = { ct: item.battleStartCt, itemId: item.id };
    }
  }
  return best;
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

  // Session 39b: passive abilities can grant starting stockpile entries
  // via the `stockpileGrants` field (Field Kit is the v1 consumer).
  // Walk the unit's equipped passives (any bucket) and merge their
  // grants into the starting stockpile. Done at construction time so
  // the substrate has the stockpile populated before the pre-battle
  // phase emits action-log entries — no action-log entry for the grant
  // itself (it's part of unit setup, not a turn event).
  const stockpile = new Map<ItemId, number>();
  for (const passiveIds of Object.values(placement.loadout.passiveBuckets)) {
    for (const abilityId of passiveIds ?? []) {
      if (!catalog.hasAbility(abilityId)) continue;
      const ability = catalog.getAbility(abilityId);
      if (ability.kind !== 'passive') continue;
      if (ability.stockpileGrants === undefined) continue;
      for (const grant of ability.stockpileGrants) {
        const have = stockpile.get(grant.itemId) ?? 0;
        stockpile.set(grant.itemId, have + grant.count);
      }
    }
  }

  return {
    id: placement.id,
    team: placement.team,
    name: placement.name,
    classState: { currentClass: placement.classId },
    loadout: placement.loadout,
    equipment,
    // Session 55: cosmetic gender (portrait variant). Omitted when the
    // placement doesn't specify it — the renderer then uses the class default.
    ...(placement.gender !== undefined ? { gender: placement.gender } : {}),
    // TABA (ADR-0136 completion): carry the enduring portrait override key
    // through, mirroring `gender` (opaque cosmetic field the engine never reads).
    ...(placement.portrait !== undefined ? { portrait: placement.portrait } : {}),
    // TABA M2: per-unit active allowlist. Omitted when the placement doesn't
    // set it → `usableActives` stays absent → every active usable (Mage War
    // default). The campaign fold stamps the array; store it as a Set for O(1)
    // membership at the menu / validation gates.
    ...(placement.usableActives !== undefined
      ? { usableActives: new Set(placement.usableActives) }
      : {}),
    ...(placement.usableItems !== undefined
      ? { usableItems: new Set(placement.usableItems) }
      : {}),
    ...(placement.usableMathParameters !== undefined
      ? { usableMathParameters: new Set(placement.usableMathParameters) }
      : {}),
    ...(placement.usableMathValues !== undefined
      ? { usableMathValues: new Set(placement.usableMathValues) }
      : {}),
    // Session 49: level defaults to 25 when the placement omits it
    // (demo / hand-authored configs). The team-builder pipeline
    // always sets it; `baseStats` should already reflect the level
    // modifier from `buildBaseStats(..., level)` upstream.
    level: placement.level ?? 25,
    position: placement.position,
    facing: placement.facing,
    ct,
    baseStats: placement.baseStats,
    vitals,
    // TABA M2 mid-battle XP: seed the carry (default 0); re-key the precomputed
    // next-level stats to an absolute-level Map (index i ⇒ level + 1 + i).
    xp: placement.xp ?? 0,
    ...(placement.statsByLevel !== undefined
      ? {
          statsByLevel: new Map(
            placement.statsByLevel.map((stats, i) => [(placement.level ?? 25) + 1 + i, stats]),
          ),
        }
      : {}),
    resistances,
    statuses: placement.statuses ?? [],
    // Session 53: fresh battle starts with an empty Worldcraft effect queue;
    // it fills only when a unit casts a Worldcraft ability (S54).
    worldcraftEffects: [],
    // Session 39a: fresh battle starts with no accumulated KO turns
    // and not yet removed. S39b: stockpile is populated from equipped
    // passives' `stockpileGrants` (Field Kit), computed just above.
    stockpile,
    turnsKOd: 0,
    removed: false,
    airborne: false,
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
    if (isEquipment(item) && item.classRestrictions !== undefined && !item.classRestrictions.includes(placement.classId)) {
      throw new BattleConfigError(
        `Unit ${JSON.stringify(placement.id)}: class ${JSON.stringify(placement.classId)} ` +
          `cannot equip ${JSON.stringify(id)} (restricted to ${JSON.stringify([...item.classRestrictions])})`,
      );
    }
  }
  // Session 45: two-handed weapons (the bow class) occupy both hands.
  // A two-handed weapon in one hand forbids any item — weapon or shield —
  // in the other. Because the off-hand is necessarily empty, a Two-Weapons
  // dual-wielder holding a bow collapses to a single swing (the swing loop
  // requires weapons in both hands).
  //
  // Session 62 (Monkeygrip, ADR-0100): a passive carrying
  // `relaxesTwoHandedGrip` lifts that rule — two-handers may share a hand
  // with an off-hand item (a shield, or with Two Weapons a second
  // two-hander). Read declaratively off the loadout's passives: equip
  // legality is a static property settled here at setup, not a runtime
  // behavior, so the validator reads the flag rather than the catalog
  // referencing any specific ability id (engine/content boundary).
  const relaxesTwoHandedGrip = Object.values(placement.loadout.passiveBuckets)
    .flat()
    .some((abId) => {
      if (!catalog.hasAbility(abId)) return false;
      const ab = catalog.getAbility(abId);
      return ab.kind === 'passive' && ab.relaxesTwoHandedGrip === true;
    });
  if (!relaxesTwoHandedGrip) {
    for (const [hand, other] of [
      ['rightHand', 'leftHand'],
      ['leftHand', 'rightHand'],
    ] as const) {
      const id = equipment[hand];
      if (id === null) continue;
      const item = catalog.getItem(id);
      if (item.kind === 'weapon' && item.twoHanded === true && equipment[other] !== null) {
        throw new BattleConfigError(
          `Unit ${JSON.stringify(placement.id)}: two-handed weapon ${JSON.stringify(id)} in ${hand} ` +
            `forbids an item in ${other}`,
        );
      }
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

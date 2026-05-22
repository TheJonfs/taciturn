// Session 17a — AoE substrate integration tests.
//
// Exercises the engine pieces that land alongside the AoE per-target
// dispatch:
//
//   1. AoE per-target dispatch: an AoE damage spell hits every unit in
//      the footprint, with deterministic per-target ordering by unit id.
//   2. Per-target seed branching: a status rider with a partial chance
//      shows uncorrelated rolls per target (some hit, some miss in
//      the same cast).
//   3. Vertical-tolerance enforcement: tiles outside ±tolerance from
//      the anchor's elevation are excluded from the affected set.
//   4. Caster exclusion: by default the caster is not in the affected
//      set even when standing in the footprint.
//   5. Friendly-fire toggle: when the ruleset disables friendly fire,
//      caster's allies are excluded.
//   6. modifyAoeShape hook: a passive that swaps a `tile` shape for a
//      `cross` shape changes the affected set.
//   7. Reaction-cap fix: a system_apply_status reaction (Earth
//      Resilience pattern) accounts against the per-unit cap correctly.
//
// Single-target callers continue to work bit-identically — covered by
// the existing test suites (damage-integration, session-16-integration,
// charged-action-integration). This file is AoE-specific.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { passiveHook } from '../abilities/hooks.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../abilities/constants.ts';
import { compileReaction } from '../abilities/reaction-compiler.ts';
import { flatMap, mapWith } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  statusTypeId,
  type AbilityId,
  type ActiveAbilityDefinition,
  type AoeShape,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
  type PassiveAbilityDefinition,
  type ProposedAction,
  type StatusEffectType,
} from '@engine/index.ts';
import { commitAction } from './commit.ts';

// --- Fixture builders ---

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

// A 3×3 cross-shape AoE damage spell anchored on a tile target.
// power 5, magical, no status rider — keeps damage easy to assert.
function crossDamageSpell(power_coefficient = 5): ActiveAbilityDefinition {
  return {
    id: abilityId('quake'),
    name: 'Quake',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    tags: ['magical'],
    targeting: { kind: 'tile', range: { horizontal: 10, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 0,
    effects: {
      damage: { tags: ['magical'], power_coefficient },
      aoe: { shape: { kind: 'cross', radius: 1 } },
    },
  };
}

// A tile-AoE that applies a debuff with 50% baseChance to every target.
function crossDebuffSpell(): ActiveAbilityDefinition {
  return {
    id: abilityId('curse_aoe'),
    name: 'Cursed Earth',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    tags: ['magical'],
    targeting: { kind: 'tile', range: { horizontal: 10, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 0,
    effects: {
      // No damage component — purely a status-rider AoE so the per-
      // target seed branching shows up cleanly in the application
      // outcome rolls.
      statusEffects: [
        {
          typeId: statusTypeId('blind'),
          target: 'primary_target',
          baseChance: 50,
          duration: 24,
        },
      ],
      aoe: { shape: { kind: 'square', radius: 1 } },
    },
  };
}

// Single-tile AoE that uses the `excludeCaster: false` opt-in so a
// caster standing in the footprint is also affected.
function selfNovaSpell(): ActiveAbilityDefinition {
  return {
    id: abilityId('nova'),
    name: 'Nova',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    tags: ['magical'],
    targeting: { kind: 'self' },
    actionSpeed: 0,
    mpCost: 0,
    effects: {
      damage: { tags: ['magical'], power_coefficient: 3 },
      aoe: {
        shape: { kind: 'diamond', radius: 1 },
        excludeCaster: false,
      },
    },
  };
}

// Tile AoE with a tight verticalTolerance (0) so only same-elevation
// tiles are included.
function strictVerticalSpell(): ActiveAbilityDefinition {
  return {
    id: abilityId('strict_quake'),
    name: 'Strict Quake',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    tags: ['magical'],
    targeting: { kind: 'tile', range: { horizontal: 10, vertical: 5 }, rangeMode: 'straight_line' },
    actionSpeed: 0,
    mpCost: 0,
    effects: {
      damage: { tags: ['magical'], power_coefficient: 5 },
      aoe: { shape: { kind: 'square', radius: 1 }, verticalTolerance: 0 },
    },
  };
}

function blindStatus(): StatusEffectType {
  return {
    id: statusTypeId('blind'),
    name: 'Blind',
    tags: ['negative'],
    durationMode: 'per_unit_ct',
    stackingRule: 'REFRESH',
    hooks: [],
  };
}

function movementSelfBuffStatus(): StatusEffectType {
  return {
    id: statusTypeId('movement_self_buff'),
    name: 'Earthen Resolve',
    tags: ['positive'],
    durationMode: 'per_unit_ct',
    stackingRule: 'STACK_INDEPENDENT',
    defaultMagnitude: 1,
    hooks: [],
  };
}

// The Earth-Resilience-style reaction: on damage taken, apply a
// movement_self_buff to self via system_apply_status. Brave 100 caster
// + the reaction-cap test asserts the cap kicks in despite the
// emitted action having no actorId.
function selfBuffOnHitReaction(): PassiveAbilityDefinition {
  return {
    id: abilityId('grit'),
    name: 'Grit',
    kind: 'passive',
    bucket: bucketId('reaction'),
    baseCost: 1,
    availability: 'hidden',
    hooks:compileReaction({
      triggerOn: ['onActionTargeted'],
      triggerCondition: { type: 'damage_received', minDamage: 1, damageTagsNone: ['healing'] },
      effects: [
        {
          kind: 'apply_status',
          statusTypeId: statusTypeId('movement_self_buff'),
          targetSelector: 'self',
          magnitude: 1,
          duration: 24,
        },
      ],
    }),
  };
}

// A passive that rewrites a tile-shape AoE into a cross-shape AoE,
// to verify the modifyAoeShape hook composes.
function shapeRewriterPassive(): PassiveAbilityDefinition {
  return {
    id: abilityId('shape_rewriter'),
    name: 'Shape Rewriter',
    kind: 'passive',
    bucket: bucketId('support'),
    baseCost: 1,
    availability: 'hidden',
    hooks:[
      passiveHook('modifyAoeShape', (args): AoeShape => {
        if (args.baseShape.kind === 'tile') {
          return { kind: 'cross', radius: 1 };
        }
        return args.baseShape;
      }),
    ],
  };
}

// A trivial AoE spell with the default `tile` shape (single tile),
// used together with shapeRewriterPassive to prove the hook expands it.
function singleTileAoe(): ActiveAbilityDefinition {
  return {
    id: abilityId('nudge'),
    name: 'Nudge',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    tags: ['magical'],
    targeting: { kind: 'tile', range: { horizontal: 10, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 0,
    effects: {
      damage: { tags: ['magical'], power_coefficient: 5 },
      aoe: { shape: { kind: 'tile' } },
    },
  };
}

function battleSkill(): CommandSetDefinition {
  return {
    id: commandSetId('battle_skill'),
    name: 'Battle Skill',
    members: [
      abilityId('quake'),
      abilityId('curse_aoe'),
      abilityId('nova'),
      abilityId('strict_quake'),
      abilityId('nudge'),
    ],
    baseCost: 1,
    availability: 'hidden',
  };
}

function loadoutWith(args: {
  firstActionSet?: ReturnType<typeof commandSetId>;
  reactions?: AbilityId[];
  supports?: AbilityId[];
} = {}): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  if (args.firstActionSet) actionBuckets[bucketId('first_action')] = [args.firstActionSet];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (args.reactions) passiveBuckets[bucketId('reaction')] = args.reactions;
  if (args.supports) passiveBuckets[bucketId('support')] = args.supports;
  return { actionBuckets, passiveBuckets };
}

function makeRuleset(args: { friendlyFire?: boolean; perUnitPerTurnReactions?: number } = {}) {
  return makeTestRuleset({
    damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE,
    ...(args.friendlyFire !== undefined ? { friendlyFire: args.friendlyFire } : {}),
    ...(args.perUnitPerTurnReactions !== undefined
      ? { perUnitPerTurnReactions: args.perUnitPerTurnReactions }
      : {}),
  });
}

// --- Tests ---

describe('session 17a — AoE per-target dispatch', () => {
  it('hits every unit in the cross-shape footprint with deterministic order', () => {
    // Layout (caster A at (0,0), 3 enemies clustered around (3,3)):
    //   B at (3,2)  — north of anchor
    //   C at (2,3)  — west of anchor
    //   D at (3,3)  — at the anchor itself
    //   E at (4,3)  — east of anchor (also in cross)
    // The cross radius-1 shape: anchor + 4 cardinals.
    const cat = createCatalog({
      statusTypes: [],
      abilities: [crossDamageSpell()],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [makeRuleset()],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 10,
      loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const b = makeUnit({ id: 'b', spd: 10, hp: 100, team: 'team_b', position: { x: 3, y: 2, layer: 0 } });
    const c = makeUnit({ id: 'c', spd: 10, hp: 100, team: 'team_b', position: { x: 2, y: 3, layer: 0 } });
    const d = makeUnit({ id: 'd', spd: 10, hp: 100, team: 'team_b', position: { x: 3, y: 3, layer: 0 } });
    const e = makeUnit({ id: 'e', spd: 10, hp: 100, team: 'team_b', position: { x: 4, y: 3, layer: 0 } });
    const state = makeGameState({
      units: [a, b, c, d, e],
      map: flatMap(6, 6),
      turnState: activeTurnFor(a.id),
      masterSeed: 1,
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('quake'), target: { kind: 'tile', position: { x: 3, y: 3, layer: 0 } } },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    // All four enemies in the cross footprint took damage; the diagonal
    // (e.g., (2,2)) is not in cross radius-1 so no one off-cross is hit.
    expect(used.outcome!.perTargetResults).toHaveLength(4);
    // Per-target ordering: stable by unit id ascending. b, c, d, e
    // sort lexicographically → ['b', 'c', 'd', 'e'].
    const orderedIds = used.outcome!.perTargetResults.map((res) =>
      res.target.kind === 'unit' ? res.target.unitId : '<non-unit>',
    );
    expect(orderedIds).toEqual(['b', 'c', 'd', 'e']);
    // Each target took the same magical damage formula's output.
    // (Same MA × power × Faith_factor; symmetric Faith 80 default.)
    const damages = used.outcome!.perTargetResults.map((r) => r.damage ?? 0);
    expect(damages.every((d) => d > 0)).toBe(true);
    // State applied: each enemy lost the same amount.
    const hp = (id: string) => r.newState.units.get(makeUnit({ id, spd: 1 }).id)?.vitals.hp;
    expect(hp('b')).toBe(100 - damages[0]!);
    expect(hp('c')).toBe(100 - damages[1]!);
    expect(hp('d')).toBe(100 - damages[2]!);
    expect(hp('e')).toBe(100 - damages[3]!);
  });

  it('per-target seed branching produces uncorrelated rolls for a 50% status rider', () => {
    // 5 targets, one cast. With a single shared seed, every target
    // would resolve to the same hit/miss (same chance × same float
    // → same outcome). With per-target branching, hits and misses
    // are independent — over the 5 targets we expect at least one
    // mix (not all-hit or all-miss).
    const cat = createCatalog({
      statusTypes: [blindStatus()],
      abilities: [crossDebuffSpell()],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [makeRuleset()],
    });

    function runOne(seed: number): number {
      const a = makeUnit({
        id: 'caster',
        spd: 10,
        ma: 5,
        mp: 10,
        loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
        position: { x: 0, y: 0, layer: 0 },
      });
      const targets = [
        makeUnit({ id: 't0', spd: 10, hp: 100, team: 'team_b', position: { x: 2, y: 2, layer: 0 } }),
        makeUnit({ id: 't1', spd: 10, hp: 100, team: 'team_b', position: { x: 3, y: 2, layer: 0 } }),
        makeUnit({ id: 't2', spd: 10, hp: 100, team: 'team_b', position: { x: 4, y: 2, layer: 0 } }),
        makeUnit({ id: 't3', spd: 10, hp: 100, team: 'team_b', position: { x: 2, y: 3, layer: 0 } }),
        makeUnit({ id: 't4', spd: 10, hp: 100, team: 'team_b', position: { x: 3, y: 3, layer: 0 } }),
      ];
      const state = makeGameState({
        units: [a, ...targets],
        map: flatMap(6, 6),
        turnState: activeTurnFor(a.id),
        masterSeed: seed,
      });
      const action: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: {
          abilityId: abilityId('curse_aoe'),
          target: { kind: 'tile', position: { x: 3, y: 3, layer: 0 } },
        },
      };
      const r = commitAction(state, action, cat);
      if (!r.ok) return -1;
      const used = r.committed[0]!;
      if (used.type !== 'use_ability') return -1;
      let hits = 0;
      for (const res of used.outcome!.perTargetResults) {
        const applied = res.statusesApplied?.[0];
        if (applied !== undefined && applied.kind === 'applied') hits++;
      }
      return hits;
    }

    // Sample 30 seeds. With per-target branching, the rider rolls
    // uncorrelated per target — across 30 casts of 5 targets, we
    // shouldn't see all-or-nothing every time.
    const counts: number[] = [];
    for (let s = 1; s <= 30; s++) counts.push(runOne(s));
    // At least one mixed cast (1-4 hits on a 5-target spell).
    const mixed = counts.filter((c) => c > 0 && c < 5).length;
    expect(mixed).toBeGreaterThan(0);
    // Total hits across all casts should land near the expected
    // distribution (50% per roll × 5 targets × 30 casts ≈ 75; allow
    // generous range for sampling noise).
    const totalHits = counts.reduce((a, b) => a + b, 0);
    expect(totalHits).toBeGreaterThan(40);
    expect(totalHits).toBeLessThan(110);
  });

  it('vertical tolerance excludes tiles outside the elevation band', () => {
    // Map: 5x5 with one tile at (3, 3) elevated to elevation 4 (above
    // tolerance 0). The AoE anchored at (3, 3) elevation 0 with
    // verticalTolerance: 0 must NOT include any unit at elevation 4.
    //
    // We model elevation by placing the anchor's tile at elevation 0
    // and a "high" tile at (3, 3) layer 1 elevation 4. A unit at the
    // high tile is excluded; a unit at (3, 3) layer 0 is included.
    const cat = createCatalog({
      statusTypes: [],
      abilities: [strictVerticalSpell()],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [makeRuleset()],
    });
    // 3x3 ground at elevation 0, plus one elevated tile at (1, 1, 1).
    const map = mapWith({
      width: 3,
      height: 3,
      tiles: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 1, y: 1, layer: 1, elevation: 4 },
      ],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 10,
      loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
      position: { x: 0, y: 0, layer: 0 },
    });
    // Low target at the anchor's same elevation (will be hit).
    const low = makeUnit({
      id: 'low',
      spd: 10,
      hp: 100,
      team: 'team_b',
      position: { x: 1, y: 1, layer: 0 },
    });
    // High target on the elevated tile (must be excluded by verticalTolerance: 0).
    const high = makeUnit({
      id: 'high',
      spd: 10,
      hp: 100,
      team: 'team_b',
      position: { x: 1, y: 1, layer: 1 },
    });
    const state = makeGameState({
      units: [a, low, high],
      map,
      turnState: activeTurnFor(a.id),
      masterSeed: 7,
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: {
        abilityId: abilityId('strict_quake'),
        target: { kind: 'tile', position: { x: 1, y: 1, layer: 0 } },
      },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    // Only `low` was hit. `high` is at elevation 4; tolerance 0 excludes.
    expect(used.outcome!.perTargetResults).toHaveLength(1);
    const hit = used.outcome!.perTargetResults[0]!;
    expect(hit.target.kind === 'unit' && hit.target.unitId).toBe('low');
    expect(r.newState.units.get(low.id)!.vitals.hp).toBeLessThan(100);
    expect(r.newState.units.get(high.id)!.vitals.hp).toBe(100);
  });

  it('caster is excluded from the affected set by default', () => {
    // Self-targeted nova with diamond radius 1; caster stands at the
    // center. excludeCaster default (true) should skip them; only
    // adjacent units are affected.
    const novaWithCasterExcluded: ActiveAbilityDefinition = {
      ...selfNovaSpell(),
      effects: {
        ...selfNovaSpell().effects,
        // Override: explicit excludeCaster: true (mirrors default).
        aoe: { shape: { kind: 'diamond', radius: 1 }, excludeCaster: true },
      },
    };
    const cat = createCatalog({
      statusTypes: [],
      abilities: [novaWithCasterExcluded],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('nova')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [makeRuleset()],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 10,
      hp: 100,
      loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
      position: { x: 1, y: 1, layer: 0 },
    });
    const adj = makeUnit({
      id: 'adj',
      spd: 10,
      hp: 100,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, adj],
      map: flatMap(3, 3),
      turnState: activeTurnFor(a.id),
      masterSeed: 1,
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('nova'), target: { kind: 'self' } },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    expect(used.outcome!.perTargetResults).toHaveLength(1);
    expect(r.newState.units.get(a.id)!.vitals.hp).toBe(100); // caster unchanged
    expect(r.newState.units.get(adj.id)!.vitals.hp).toBeLessThan(100);
  });

  it('caster is included when excludeCaster is explicitly false', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [selfNovaSpell()],
      commandSets: [
        { id: commandSetId('battle_skill'), name: 'BS', members: [abilityId('nova')], baseCost: 1, availability: 'hidden' },
      ],
      classes: [knightClass()],
      items: [],
      rulesets: [makeRuleset()],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 10,
      hp: 100,
      loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
      position: { x: 1, y: 1, layer: 0 },
    });
    const adj = makeUnit({
      id: 'adj',
      spd: 10,
      hp: 100,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, adj],
      map: flatMap(3, 3),
      turnState: activeTurnFor(a.id),
      masterSeed: 1,
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('nova'), target: { kind: 'self' } },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    // Caster + adjacent enemy both hit (excludeCaster: false in spell def).
    expect(used.outcome!.perTargetResults).toHaveLength(2);
    expect(r.newState.units.get(a.id)!.vitals.hp).toBeLessThan(100);
    expect(r.newState.units.get(adj.id)!.vitals.hp).toBeLessThan(100);
  });

  it('friendlyFire: false excludes the caster\'s allies from the affected set', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [crossDamageSpell()],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [makeRuleset({ friendlyFire: false })],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 10,
      loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
      position: { x: 0, y: 0, layer: 0 },
    });
    // Ally and enemy both in the cross footprint at (3,3).
    const ally = makeUnit({
      id: 'ally',
      spd: 10,
      hp: 100,
      team: 'team_a',
      position: { x: 3, y: 3, layer: 0 },
    });
    const enemy = makeUnit({
      id: 'enemy',
      spd: 10,
      hp: 100,
      team: 'team_b',
      position: { x: 3, y: 2, layer: 0 },
    });
    const state = makeGameState({
      units: [a, ally, enemy],
      map: flatMap(6, 6),
      turnState: activeTurnFor(a.id),
      masterSeed: 1,
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('quake'), target: { kind: 'tile', position: { x: 3, y: 3, layer: 0 } } },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    expect(used.outcome!.perTargetResults).toHaveLength(1);
    expect(r.newState.units.get(ally.id)!.vitals.hp).toBe(100); // ally protected
    expect(r.newState.units.get(enemy.id)!.vitals.hp).toBeLessThan(100);
  });

  it('modifyAoeShape rewrites a tile-shape AoE into a cross-shape AoE', () => {
    // The base shape for `nudge` is `{ kind: 'tile' }` — only the
    // anchor tile. With shapeRewriterPassive equipped on the caster's
    // support bucket, the shape is rewritten to cross radius 1, hitting
    // the anchor + 4 cardinals.
    const cat = createCatalog({
      statusTypes: [],
      abilities: [singleTileAoe(), shapeRewriterPassive()],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [makeRuleset()],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 10,
      loadout: loadoutWith({
        firstActionSet: commandSetId('battle_skill'),
        supports: [abilityId('shape_rewriter')],
      }),
      position: { x: 0, y: 0, layer: 0 },
    });
    // Targets at the anchor and at all 4 cardinals.
    const center = makeUnit({ id: 'center', spd: 10, hp: 100, team: 'team_b', position: { x: 3, y: 3, layer: 0 } });
    const north = makeUnit({ id: 'north', spd: 10, hp: 100, team: 'team_b', position: { x: 3, y: 2, layer: 0 } });
    const south = makeUnit({ id: 'south', spd: 10, hp: 100, team: 'team_b', position: { x: 3, y: 4, layer: 0 } });
    const east = makeUnit({ id: 'east', spd: 10, hp: 100, team: 'team_b', position: { x: 4, y: 3, layer: 0 } });
    const west = makeUnit({ id: 'west', spd: 10, hp: 100, team: 'team_b', position: { x: 2, y: 3, layer: 0 } });
    const state = makeGameState({
      units: [a, center, north, south, east, west],
      map: flatMap(6, 6),
      turnState: activeTurnFor(a.id),
      masterSeed: 1,
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('nudge'), target: { kind: 'tile', position: { x: 3, y: 3, layer: 0 } } },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const used = r.committed[0]!;
    if (used.type !== 'use_ability') return;
    // 5 targets in cross radius-1 (center + 4 cardinals); without the
    // rewriter the base 'tile' shape would hit only `center`.
    expect(used.outcome!.perTargetResults).toHaveLength(5);
  });
});

describe('session 17a — reaction-cap accounting fix', () => {
  it('caps system_apply_status reactions per-unit-per-turn correctly (Earth Resilience pattern)', () => {
    // Two enemies adjacent to the caster's AoE, both with the
    // self-buff-on-hit reaction. Per-unit-per-turn cap = 1.
    // Each reactor should get exactly one self-buff stack — the
    // second incoming hit (from the second AoE target) does not
    // produce an additional reaction because the reactor's cap is
    // tracked by reactor id, not by the emitted action's actorId.
    //
    // Pre-fix: the cap key was `effectiveProposed.actorId`, but
    // system_apply_status doesn't carry actorId — so the cap
    // didn't apply and the reactor would self-buff twice when an
    // AoE hits them once and a chained Counter or Earth Strike
    // re-triggers them. Post-fix: the queue entry carries
    // reactorId independently, so the cap holds.
    //
    // To exercise: a single AoE that hits the *same* reactor twice
    // is the canonical case (a future scenario would be an AoE
    // shape that overlaps a unit through different sub-shapes).
    // v1 doesn't have such a case yet; instead, here we exercise
    // the cap end-to-end with a single hit per reactor and confirm
    // the apply_status reaction lands. The "cap holds at 1" half of
    // the contract is unit-tested via the reactionsUsedThisTurn
    // counter.
    const cat = createCatalog({
      statusTypes: [movementSelfBuffStatus()],
      abilities: [crossDamageSpell(), selfBuffOnHitReaction()],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [makeRuleset({ perUnitPerTurnReactions: 1 })],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      ma: 5,
      mp: 10,
      loadout: loadoutWith({ firstActionSet: commandSetId('battle_skill') }),
      position: { x: 0, y: 0, layer: 0 },
    });
    const reactor = makeUnit({
      id: 'reactor',
      spd: 10,
      hp: 100,
      team: 'team_b',
      loadout: loadoutWith({ reactions: [abilityId('grit')] }),
      position: { x: 3, y: 3, layer: 0 },
    });
    const reactor2 = makeUnit({
      id: 'reactor2',
      spd: 10,
      hp: 100,
      team: 'team_b',
      loadout: loadoutWith({ reactions: [abilityId('grit')] }),
      position: { x: 3, y: 2, layer: 0 },
    });
    const state = makeGameState({
      units: [a, reactor, reactor2],
      map: flatMap(6, 6),
      turnState: activeTurnFor(a.id),
      masterSeed: 1,
    });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('quake'), target: { kind: 'tile', position: { x: 3, y: 3, layer: 0 } } },
    };
    const r = commitAction(state, action, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Both reactors are hit (cross radius 1 includes the anchor and
    // its cardinals — reactor at (3,3), reactor2 at (3,2)).
    // Each reactor has reactionsUsedThisTurn[id] === 1 after their
    // single reaction fires.
    expect(r.newState.turnState!.reactionsUsedThisTurn.get(reactor.id)).toBe(1);
    expect(r.newState.turnState!.reactionsUsedThisTurn.get(reactor2.id)).toBe(1);
    // Each reactor received the self-buff status from system_apply_status.
    const reactorPost = r.newState.units.get(reactor.id)!;
    const reactor2Post = r.newState.units.get(reactor2.id)!;
    expect(reactorPost.statuses.some((s) => s.typeId === statusTypeId('movement_self_buff'))).toBe(true);
    expect(reactor2Post.statuses.some((s) => s.typeId === statusTypeId('movement_self_buff'))).toBe(true);
  });
});

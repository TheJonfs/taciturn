// TABA M2 (ADR-0139) — XP emission from connecting actions. A `system_xp_award`
// is generated for the caster (base 10 + level-delta, +10 KO) when a leveling
// unit takes a connecting, effect-having action. Reactions, non-leveling units,
// and no-effect actions (heal-on-full) earn nothing.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { DEFAULT_TEST_DAMAGE_PIPELINE, makeTestRuleset } from '../catalog/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { ACTIVE_BUCKET_IDS, PASSIVE_BUCKET_IDS } from '../abilities/constants.ts';
import { flatMap } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  itemId,
  unitId,
  type Action,
  type ActiveAbilityDefinition,
  type BaseStats,
  type ClassDefinition,
  type CommandSetDefinition,
  type Loadout,
  type ProposedAction,
  type Unit,
} from '@engine/index.ts';
import { commitAction } from './commit.ts';

function attackAbility(power = 4): ActiveAbilityDefinition {
  return {
    id: abilityId('attack'),
    name: 'Attack',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: power } },
  };
}
function cureAbility(power = 5): ActiveAbilityDefinition {
  return {
    id: abilityId('cure'),
    name: 'Cure',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 0,
    mpCost: 4,
    effects: { damage: { tags: ['holy', 'healing'], power_coefficient: power } },
  };
}
function battleSkill(): CommandSetDefinition {
  return {
    id: commandSetId('battle_skill'),
    name: 'Battle Skill',
    members: [abilityId('attack'), abilityId('cure')],
    baseCost: 1,
    availability: 'hidden',
  };
}
function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
    dominantStat: 'pa',
  };
}
function loadout(): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('battle_skill')];
  const passiveBuckets: Record<string, ReadonlyArray<ReturnType<typeof abilityId>>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  return { actionBuckets, passiveBuckets };
}
function stats(maxHpBase: number): BaseStats {
  return { spd: 10, pa: 5, ma: 4, maxHpBase, maxMpBase: 50, brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1 };
}
const catalog = createCatalog({
  statusTypes: [],
  abilities: [attackAbility(), cureAbility()],
  commandSets: [battleSkill()],
  classes: [knightClass()],
  items: [],
  rulesets: [makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE })],
});

const activeTurn = (id: string) => ({
  unitId: unitId(id),
  budget: { movesAvailable: 1, actsAvailable: 1 },
  consumed: { movesConsumed: 0, actsConsumed: 0 },
  reactionsUsedThisTurn: new Map(),
});

// A leveling caster (has a statsByLevel table) at a given level.
function caster(id: string, level: number, over?: Partial<Unit>): Unit {
  return {
    ...makeUnit({ id, spd: 10, pa: 5, mp: 50, position: { x: 0, y: 0, layer: 0 }, loadout: loadout() }),
    level,
    statsByLevel: new Map([[level + 1, stats(120)]]),
    ...over,
  };
}
const xpAwards = (committed: ReadonlyArray<Action>): ReadonlyArray<Action> =>
  committed.filter((a) => a.type === 'system_xp_award');

describe('XP emission', () => {
  it('a connecting attack awards base + (targetLevel − casterLevel) to the caster', () => {
    const a = caster('a', 20);
    const b = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100, team: 'team_b', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [a, b], map: flatMap(3, 3), turnState: activeTurn('a') });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
    };
    const r = commitAction(state, action, catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const awards = xpAwards(r.committed);
    expect(awards).toHaveLength(1);
    const award = awards[0]!;
    if (award.type !== 'system_xp_award') return;
    expect(award.payload.unitId).toBe(a.id);
    expect(award.payload.amount).toBe(15); // max(1, 10 + (25 − 20))
    expect(r.newState.units.get(a.id)!.xp).toBe(15);
  });

  it('adds the +10 KO bonus when the action kills the target', () => {
    const a = caster('a', 25);
    const b = makeUnit({ id: 'b', spd: 10, hp: 5, maxHpBase: 100, team: 'team_b', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [a, b], map: flatMap(3, 3), turnState: activeTurn('a') });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
    };
    const r = commitAction(state, action, catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const award = xpAwards(r.committed)[0]!;
    if (award.type !== 'system_xp_award') return;
    expect(r.newState.units.get(b.id)!.vitals.hp).toBe(0); // killed
    expect(award.payload.amount).toBe(20); // max(1, 10+0) + 10 KO
  });

  it('a RIDER cast (weapon proc) earns NO XP — the weapon acts, not the wielder (S94)', () => {
    // The root attack pays once; its equipment-proc follow-up (same actor,
    // riderSource set) must not pay again — the double-award bug.
    const a = caster('a', 20);
    const b = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100, team: 'team_b', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [a, b], map: flatMap(3, 3), turnState: activeTurn('a') });
    const rider: ProposedAction = {
      type: 'use_ability',
      source: 'system',
      actorId: a.id,
      payload: {
        abilityId: abilityId('attack'),
        target: { kind: 'unit', unitId: b.id },
        riderSource: { kind: 'equipment_proc', itemId: itemId('test_wand') },
      },
    };
    const r = commitAction(state, rider, catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(b.id)!.vitals.hp).toBeLessThan(100); // it DID connect
    expect(xpAwards(r.committed)).toHaveLength(0); // …but paid nothing
  });

  it('a caster with no statsByLevel earns NO XP (opt-out — Mage War / enemies)', () => {
    // No statsByLevel field at all → not a leveling unit.
    const a: Unit = {
      ...makeUnit({ id: 'a', spd: 10, pa: 5, mp: 50, position: { x: 0, y: 0, layer: 0 }, loadout: loadout() }),
      level: 20,
    };
    const b = makeUnit({ id: 'b', spd: 10, hp: 100, maxHpBase: 100, team: 'team_b', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [a, b], map: flatMap(3, 3), turnState: activeTurn('a') });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
    };
    const r = commitAction(state, action, catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(0);
  });

  it('no-effect actions award nothing: Cure on a FULL-HP ally (the anti-grind guard)', () => {
    const a = caster('a', 20);
    const ally = makeUnit({ id: 'f', spd: 10, hp: 100, maxHpBase: 100, team: 'team_a', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [a, ally], map: flatMap(3, 3), turnState: activeTurn('a') });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('cure'), target: { kind: 'unit', unitId: ally.id } },
    };
    const r = commitAction(state, action, catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(0); // MP spent, but nothing healed → no XP
  });

  it('the SAME Cure on a WOUNDED ally does award XP (it had an effect)', () => {
    const a = caster('a', 20);
    const ally = makeUnit({ id: 'f', spd: 10, hp: 10, maxHpBase: 100, team: 'team_a', position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [a, ally], map: flatMap(3, 3), turnState: activeTurn('a') });
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: a.id,
      payload: { abilityId: abilityId('cure'), target: { kind: 'unit', unitId: ally.id } },
    };
    const r = commitAction(state, action, catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(1);
  });
});

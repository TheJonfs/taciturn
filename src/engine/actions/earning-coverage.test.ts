// S95 earning-coverage audit — the systematic sweep the S94 whack-a-mole
// asked for. One test per effect discriminant whose XP earning was never
// pinned, asserting the RULE Chris set for the sweep:
//
//   A connecting action earns iff it changed something OTHER than the
//   caster's own bookkeeping (MP cost, own position, own CT). Changes to
//   the WORLD count the same as changes to other units — a Worldcraft
//   terraform is the main thing a Terraformer does.
//
// Shapes already pinned elsewhere (see the coverage table in
// docs/design/ai-substrate.md): damage / heal / KO bonus / heal-on-full /
// knockback-rider displacement / rider procs / reactions / non-leveling
// opt-out (xp-emission.test.ts), Math Skill CT + status appliers + repeat
// casts of STACK_INDEPENDENT appliers (calculator-kit.test.ts), Compound
// (xp-emission.test.ts).
//
// Every cast here uses the REAL content catalog — the point of the audit
// is that shipped abilities earn, not that synthetic shapes would.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { makeGameState, makeUnit, activeTurnFor } from '../ct/test-fixtures.ts';
import { makeStatusInstance } from '../status/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { loadoutOf } from '../abilities/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  commandSetId,
  statusTypeId,
  unitId,
  type Action,
  type BaseStats,
  type GameState,
  type ProposedAction,
  type Unit,
} from '@engine/index.ts';
import { commitAction } from './commit.ts';

const catalog = loadDefaultCatalog();

function stats(maxHpBase: number): BaseStats {
  return {
    spd: 10,
    pa: 8,
    ma: 8,
    maxHpBase,
    maxMpBase: 60,
    brave: 100,
    faith: 100,
    crit_chance: 0,
    crit_multiplier: 1,
  };
}

// A leveling caster carrying the named first_action command set.
function caster(
  id: string,
  commandSet: string,
  over?: Partial<Unit> & { position?: { x: number; y: number; layer: number } },
): Unit {
  return {
    ...makeUnit({
      id,
      spd: 10,
      pa: 8,
      ma: 8,
      mp: 60,
      maxMpBase: 60,
      brave: 100,
      faith: 100,
      position: { x: 0, y: 0, layer: 0 },
      loadout: loadoutOf({
        active: [[bucketId('first_action'), commandSetId(commandSet)]],
      }),
    }),
    level: 20,
    statsByLevel: new Map([[21, stats(120)]]),
    ...over,
  };
}

const xpAwards = (committed: ReadonlyArray<Action>): ReadonlyArray<Action> =>
  committed.filter((a) => a.type === 'system_xp_award');

function cast(
  actorId: string,
  ability: string,
  target: Extract<ProposedAction, { type: 'use_ability' }>['payload']['target'],
): ProposedAction {
  return {
    type: 'use_ability',
    source: 'player',
    actorId: unitId(actorId),
    payload: { abilityId: abilityId(ability), target },
  };
}

// Commit a charged cast, then commit its charged_action_resolve directly
// (the session-18 pattern). Returns the resolve's commit result.
function castAndResolveCharged(
  state: GameState,
  action: ProposedAction,
): ReturnType<typeof commitAction> {
  const committed = commitAction(state, action, catalog);
  expect(committed.ok).toBe(true);
  if (!committed.ok) throw new Error('charged commit failed');
  expect(committed.newState.chargedActions.length).toBeGreaterThan(0);
  const ca = committed.newState.chargedActions[0]!;
  return commitAction(
    committed.newState,
    { type: 'charged_action_resolve', source: 'system', payload: { chargedActionId: ca.id } },
    catalog,
  );
}

describe('Earning coverage — Worldcraft (terrain changes are effects)', () => {
  it('Pillar (elevation) earns exactly one award', () => {
    const a = caster('terra', 'worldcraft');
    const state = makeGameState({
      units: [a],
      map: flatMap(6, 6),
      turnState: activeTurnFor(a.id),
    });
    const r = commitAction(state, cast('terra', 'pillar', { kind: 'tile', position: { x: 1, y: 0, layer: 0 } }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(1);
  });

  it('Barrier (tile_set wall) earns exactly one award', () => {
    const a = caster('terra', 'worldcraft');
    const state = makeGameState({
      units: [a],
      map: flatMap(6, 6),
      turnState: activeTurnFor(a.id),
    });
    const positions = [
      { x: 2, y: 0, layer: 0 },
      { x: 2, y: 1, layer: 0 },
      { x: 2, y: 2, layer: 0 },
    ];
    const r = commitAction(state, cast('terra', 'barrier', { kind: 'tile_set', positions }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(1);
  });

  it('a basic Attack that damages a barrier earns (destroying denial is an effect)', () => {
    // Plant the barrier by casting it, then a second unit attacks it.
    const terra = caster('terra', 'worldcraft');
    const knight = caster('kn', 'battle_skill', { position: { x: 3, y: 0, layer: 0 } } as Partial<Unit>);
    const state = makeGameState({
      units: [terra, knight],
      map: flatMap(6, 6),
      turnState: activeTurnFor(terra.id),
    });
    const positions = [
      { x: 2, y: 0, layer: 0 },
      { x: 2, y: 1, layer: 0 },
      { x: 2, y: 2, layer: 0 },
    ];
    const placed = commitAction(state, cast('terra', 'barrier', { kind: 'tile_set', positions }), catalog);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const s2: GameState = { ...placed.newState, turnState: activeTurnFor(knight.id) };
    const r = commitAction(s2, cast('kn', 'attack', { kind: 'tile', position: { x: 2, y: 0, layer: 0 } }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(1);
    const award = xpAwards(r.committed)[0]!;
    if (award.type !== 'system_xp_award') return;
    expect(award.payload.unitId).toBe(knight.id);
  });
});

describe('Earning coverage — grapple throw (the real Bear\'s Heave path)', () => {
  it('a zero-damage heave through resolveGrappleThrow earns, and a repeat heave earns again', () => {
    // The S94 displacement pin used a knockback RIDER; the shipped Bear\'s
    // Heave routes through resolveGrappleThrow — this pins the real path.
    const monk = caster('monk', 'martial_arts');
    const foe = makeUnit({
      id: 'foe',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [monk, foe],
      map: flatMap(6, 6),
      turnState: activeTurnFor(monk.id),
    });
    const r = commitAction(
      state,
      cast('monk', 'bears_heave', {
        kind: 'grapple_throw',
        unitId: unitId('foe'),
        destination: { x: 0, y: 1, layer: 0 }, // stays adjacent for the repeat heave
      }),
      catalog,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(1);

    // Second heave (stance already set — REFRESH; the displacement alone
    // must carry the earn).
    const s2: GameState = { ...r.newState, turnState: activeTurnFor(monk.id) };
    const r2 = commitAction(
      s2,
      cast('monk', 'bears_heave', {
        kind: 'grapple_throw',
        unitId: unitId('foe'),
        destination: { x: 1, y: 0, layer: 0 },
      }),
      catalog,
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(xpAwards(r2.committed)).toHaveLength(1);
  });
});

describe('Earning coverage — MP drain (Steal MP)', () => {
  it('draining a target with MP earns', () => {
    const thief = caster('th', 'thief_arts');
    const mark = makeUnit({
      id: 'mark',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      mp: 40,
      maxMpBase: 40,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [thief, mark],
      map: flatMap(4, 4),
      turnState: activeTurnFor(thief.id),
    });
    const r = commitAction(state, cast('th', 'steal_mp', { kind: 'unit', unitId: unitId('mark') }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(1);
  });

  it('draining an empty target (0 MP) earns nothing — no MP moved, no effect', () => {
    const thief = caster('th', 'thief_arts');
    const mark = makeUnit({
      id: 'mark',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      mp: 0,
      maxMpBase: 40,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [thief, mark],
      map: flatMap(4, 4),
      turnState: activeTurnFor(thief.id),
    });
    const r = commitAction(state, cast('th', 'steal_mp', { kind: 'unit', unitId: unitId('mark') }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(0);
  });
});

describe('Earning coverage — MP restore (Chakra)', () => {
  it('refueling a full-HP, MP-hungry ally earns (the ally\'s MP is an effect)', () => {
    const monk = caster('monk', 'martial_arts');
    const ally = makeUnit({
      id: 'ally',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      mp: 5,
      maxMpBase: 40,
      team: 'team_a',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [monk, ally],
      map: flatMap(4, 4),
      turnState: activeTurnFor(monk.id),
    });
    const r = commitAction(state, cast('monk', 'chakra', { kind: 'self' }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(1);
  });

  it('a solo Chakra with nothing to change earns nothing', () => {
    // Full HP, full MP, no stance to clear, nobody else in the footprint:
    // truly no effect.
    const monk = caster('monk', 'martial_arts', { vitals: { hp: 100, mp: 60 } } as Partial<Unit>);
    const state = makeGameState({
      units: [monk],
      map: flatMap(4, 4),
      turnState: activeTurnFor(monk.id),
    });
    const r = commitAction(state, cast('monk', 'chakra', { kind: 'self' }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(0);
  });

  it('a solo Chakra refueling only the caster\'s OWN MP earns nothing (self bookkeeping)', () => {
    const monk = caster('monk', 'martial_arts');
    const low: Unit = { ...monk, vitals: { ...monk.vitals, mp: 5 } };
    const state = makeGameState({
      units: [low],
      map: flatMap(4, 4),
      turnState: activeTurnFor(low.id),
    });
    const r = commitAction(state, cast('monk', 'chakra', { kind: 'self' }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(0);
  });
});

describe('Earning coverage — standalone ctEffects (Tide Surge, charged)', () => {
  it('a landed CT surge on an ally earns at the charged resolve', () => {
    // faith 100/100 → land chance is the full baseChance 80. The masterSeed
    // below rolls a landing push; the assertion cross-checks that the push
    // actually landed so a seed change can\'t silently invalidate the pin.
    const mage = caster('wm', 'water_spells');
    const ally = makeUnit({
      id: 'ally',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      faith: 100,
      team: 'team_a',
      position: { x: 1, y: 0, layer: 0 },
      ct: 10,
    });
    const state = makeGameState({
      units: [mage, ally],
      map: flatMap(4, 4),
      turnState: activeTurnFor(mage.id),
      masterSeed: 7,
    });
    const r = castAndResolveCharged(state, cast('wm', 'tide_surge', { kind: 'unit', unitId: unitId('ally') }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pushes = r.committed.filter((a) => a.type === 'system_ct_push');
    expect(pushes.length).toBeGreaterThan(0); // the surge landed
    expect(xpAwards(r.committed)).toHaveLength(1);
  });
});

describe('Earning coverage — cleanse (Esuna, charged)', () => {
  it('cleansing a poisoned ally earns at the charged resolve', () => {
    const ench = caster('en', 'auramancy');
    const ally = makeUnit({
      id: 'ally',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      team: 'team_a',
      position: { x: 1, y: 0, layer: 0 },
      statuses: [makeStatusInstance({ typeId: 'poison', remainingDuration: 5 })],
    });
    const state = makeGameState({
      units: [ench, ally],
      map: flatMap(4, 4),
      turnState: activeTurnFor(ench.id),
    });
    const r = castAndResolveCharged(state, cast('en', 'esuna', { kind: 'unit', unitId: unitId('ally') }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(1);
  });

  it('cleansing a clean ally earns nothing', () => {
    const ench = caster('en', 'auramancy');
    const ally = makeUnit({
      id: 'ally',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      team: 'team_a',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [ench, ally],
      map: flatMap(4, 4),
      turnState: activeTurnFor(ench.id),
    });
    const r = castAndResolveCharged(state, cast('en', 'esuna', { kind: 'unit', unitId: unitId('ally') }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(0);
  });
});

describe('Earning coverage — revive (Raise, charged)', () => {
  it('raising a KO\'d ally earns at the charged resolve', () => {
    const tem = caster('tem', 'templar_arts');
    const down = makeUnit({
      id: 'down',
      spd: 10,
      hp: 0,
      maxHpBase: 100,
      team: 'team_a',
      position: { x: 1, y: 0, layer: 0 },
      turnsKOd: 1,
    });
    const state = makeGameState({
      units: [tem, down],
      map: flatMap(4, 4),
      turnState: activeTurnFor(tem.id),
    });
    const r = castAndResolveCharged(state, cast('tem', 'raise', { kind: 'unit', unitId: unitId('down') }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.units.get(unitId('down'))!.vitals.hp).toBeGreaterThan(0);
    expect(xpAwards(r.committed)).toHaveLength(1);
  });
});

describe('Earning coverage — steal buffs (inline status transfer)', () => {
  it('a successful Steal Buffs earns exactly once', () => {
    // Contest chance: 33 + 3×PA(8) + 0.5×(100−0) = 95 (clamped). The
    // masterSeed rolls a success; the buff-transfer assertion cross-checks.
    const thief = caster('th', 'thief_arts');
    const mark = makeUnit({
      id: 'mark',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      brave: 0,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
      statuses: [makeStatusInstance({ typeId: 'haste', remainingDuration: 9 })],
    });
    const state = makeGameState({
      units: [thief, mark],
      map: flatMap(4, 4),
      turnState: activeTurnFor(thief.id),
      masterSeed: 3,
    });
    const r = commitAction(state, cast('th', 'steal_buffs', { kind: 'unit', unitId: unitId('mark') }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const thiefAfter = r.newState.units.get(thief.id)!;
    expect(thiefAfter.statuses.some((s) => s.typeId === statusTypeId('haste'))).toBe(true); // it landed
    expect(xpAwards(r.committed)).toHaveLength(1);
  });
});

describe('Earning coverage — self-reposition (Scramble) stays a non-earner', () => {
  it('Scramble earns nothing (the caster\'s own movement is bookkeeping)', () => {
    const hunter = caster('hu', 'marksmanship');
    const state = makeGameState({
      units: [hunter],
      map: flatMap(4, 4),
      turnState: activeTurnFor(hunter.id),
    });
    const r = commitAction(state, cast('hu', 'scramble', { kind: 'tile', position: { x: 1, y: 0, layer: 0 } }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(0);
  });
});

describe('Earning coverage — selfCtRefund + setStance do not double-earn', () => {
  it('a landed Serpent\'s Coil earns exactly once (damage; the refund and stance ride free)', () => {
    const monk = caster('monk', 'martial_arts');
    const foe = makeUnit({
      id: 'foe',
      spd: 10,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [monk, foe],
      map: flatMap(4, 4),
      turnState: activeTurnFor(monk.id),
    });
    const r = commitAction(state, cast('monk', 'serpents_coil', { kind: 'unit', unitId: unitId('foe') }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(xpAwards(r.committed)).toHaveLength(1);
  });
});

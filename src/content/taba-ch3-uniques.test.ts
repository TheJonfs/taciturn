// TABA Ch3 weapon uniques — the six compose items (Nandani's Wrath,
// Cremation, Shadowblade, Sline, Golden Rod, Excalibur), each driven
// through its real seam with the default catalog. The two seam weapons
// (Volley Bow, Del's Stave) land with their engine seams and test there.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from './index.ts';
import {
  abilityId,
  commitAction,
  itemId,
  statusTypeId,
  unitId,
  validateAction,
} from '@engine/index.ts';
import type { ProposedAction, UnitEquipment } from '@engine/index.ts';
import { runModifyStatQuery, runModifySwingsPerWeapon } from '../engine/hooks/runners.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { flatMap } from '../engine/map/test-fixtures.ts';
import { reduceStatusTick, reduceSystemMpRestore } from '../engine/actions/reducers.ts';
import { runDamagePipeline } from '../engine/damage/pipeline.ts';
import { defaultDamageHandlers } from '../engine/damage/default-handlers.ts';
import { attack } from './abilities/attack.ts';
import { waterStrike } from './abilities/water-strike.ts';
import { prospectiveMpDumpBonusSp } from '../engine/abilities/mp-dump.ts';
import { projectExpectedDamage } from '../ai/projection.ts';
import { advanceToNextEvent } from '../engine/turn/scheduler.ts';
import { nandanisWrath } from './items/nandanis-wrath.ts';
import { cremation } from './items/cremation.ts';
import { shadowblade } from './items/shadowblade.ts';
import { sline } from './items/sline.ts';
import { goldenRod } from './items/golden-rod.ts';
import { delsStave } from './items/dels-stave.ts';
import { volleyBow } from './items/volley-bow.ts';
import { excalibur } from './items/excalibur.ts';
import { cremationBurnProc } from './abilities/cremation-burn-proc.ts';

const cat = loadDefaultCatalog();

const EMPTY: UnitEquipment = {
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: null,
  accessory: null,
};
const holding = (id: string, slot: keyof UnitEquipment = 'rightHand'): UnitEquipment => ({
  ...EMPTY,
  [slot]: itemId(id),
});

const UNIQUES = [
  nandanisWrath,
  cremation,
  shadowblade,
  sline,
  goldenRod,
  delsStave,
  volleyBow,
  excalibur,
];

describe('Ch3 uniques — scoping invariant', () => {
  it("every unique is 'hidden' (TABA-scoped, invisible to Mage War)", () => {
    for (const item of UNIQUES) {
      expect(item.availability, String(item.id)).toBe('hidden');
    }
  });
});

describe("Nandani's Wrath — Brave +11 reaction-synergy sword", () => {
  it('raises the wielder Brave query by 11 (damage factor AND reaction rate read it)', () => {
    const bearer = makeUnit({ id: 'n', spd: 10, brave: 70, equipment: holding('nandanis_wrath') });
    const state = makeGameState({ units: [bearer] });
    const unit = state.units.get(unitId('n'))!;
    const brave = runModifyStatQuery(state, cat, {
      unit,
      statName: 'brave',
      baseValue: unit.baseStats.brave,
    });
    expect(brave).toBe(81);
  });

  it('content pin: plain sword (NOT knight_sword), WP 11 · 95', () => {
    expect(nandanisWrath.weaponType).toBe('sword');
    expect(nandanisWrath.wp).toBe(11);
    expect(nandanisWrath.accuracy).toBe(95);
    expect(nandanisWrath.twoHanded).toBeUndefined();
    expect(nandanisWrath.statMods).toEqual({ brave: 11 });
  });
});

describe('Cremation — guaranteed 2-stack Burn on hit', () => {
  it('content pin: axe chassis (WP 14 · 75, 0.9–1.3) with a chance-1.0 proc', () => {
    expect(cremation.weaponType).toBe('axe');
    expect(cremation.wp).toBe(14);
    expect(cremation.accuracy).toBe(75);
    expect(cremation.physicalVariance).toEqual({ kind: 'static', min: 0.9, max: 1.3 });
    expect(cremation.attackProcs).toEqual([
      { chance: 1.0, abilityId: abilityId('cremation_burn_proc') },
    ]);
  });

  it('the proc plants exactly 2 Burn stacks in one application', () => {
    const wielder = makeUnit({
      id: 'w', spd: 10, ma: 10,
      equipment: holding('cremation'),
      position: { x: 1, y: 1, layer: 0 },
    });
    const victim = makeUnit({
      id: 'v', spd: 10, hp: 100, maxHpBase: 100, team: 'team_b',
      position: { x: 1, y: 2, layer: 0 },
    });
    const state = makeGameState({
      units: [wielder, victim],
      map: flatMap(4, 4),
      turnState: activeTurnFor(unitId('w')),
      masterSeed: 5,
    });
    const proc: ProposedAction = {
      type: 'use_ability',
      source: 'system',
      actorId: unitId('w'),
      payload: {
        abilityId: abilityId('cremation_burn_proc'),
        target: { kind: 'unit', unitId: unitId('v') },
        riderSource: { kind: 'equipment_proc', itemId: itemId('cremation') },
      },
    };
    const r = commitAction(state, proc, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const burn = r.newState.units
      .get(unitId('v'))!
      .statuses.find((s) => s.typeId === statusTypeId('burn'));
    expect(burn).toBeDefined();
    // Burn's custom lifecycle: stackDamages holds one snapshot per stack.
    const cs = burn!.customState as { stackDamages?: ReadonlyArray<number> };
    expect(cs.stackDamages).toHaveLength(2);
    expect(cs.stackDamages).toEqual([6, 6]); // floor(MA 10 × 0.6) each
  });

  it('proc ability pin: hidden, MP-free, applyAlways, stackQuantity 2', () => {
    expect(cremationBurnProc.availability).toBe('hidden');
    expect(cremationBurnProc.mpCost).toBe(0);
    const eff = cremationBurnProc.effects.statusEffects?.[0];
    expect(eff?.typeId).toBe(statusTypeId('burn'));
    expect(eff?.applyAlways).toBe(true);
    expect(eff?.stackQuantity).toBe(2);
  });
});

describe('Shadowblade — Speed Steal: permanent bidirectional stacking', () => {
  it('content pin: knife chassis (WP 6 · 95, speed variance) with a flat 50% proc (Magebane convention)', () => {
    expect(shadowblade.weaponType).toBe('knife');
    expect(shadowblade.physicalVariance).toEqual({ kind: 'attacker_speed', spread: 0.05 });
    expect(shadowblade.attackProcs).toEqual([
      { chance: 0.5, abilityId: abilityId('shadowblade_proc') },
    ]);
  });

  it('two landed procs: wielder +2 Speed (one accumulating instance), victim −2 (independent stacks)', () => {
    const wielder = makeUnit({
      id: 'w', spd: 10,
      equipment: holding('shadowblade'),
      position: { x: 1, y: 1, layer: 0 },
    });
    const victim = makeUnit({
      id: 'v', spd: 10, hp: 100, maxHpBase: 100, team: 'team_b',
      position: { x: 1, y: 2, layer: 0 },
    });
    let state = makeGameState({
      units: [wielder, victim],
      map: flatMap(4, 4),
      turnState: activeTurnFor(unitId('w')),
      masterSeed: 5,
    });
    const proc: ProposedAction = {
      type: 'use_ability',
      source: 'system',
      actorId: unitId('w'),
      payload: {
        abilityId: abilityId('shadowblade_proc'),
        target: { kind: 'unit', unitId: unitId('v') },
        riderSource: { kind: 'equipment_proc', itemId: itemId('shadowblade') },
      },
    };
    for (let i = 0; i < 2; i++) {
      const r = commitAction(state, proc, cat);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      state = r.newState;
    }
    const w = state.units.get(unitId('w'))!;
    const v = state.units.get(unitId('v'))!;
    const wSpd = runModifyStatQuery(state, cat, { unit: w, statName: 'spd', baseValue: w.baseStats.spd });
    const vSpd = runModifyStatQuery(state, cat, { unit: v, statName: 'spd', baseValue: v.baseStats.spd });
    expect(wSpd).toBe(12); // 10 + 2 (STACK_ADDITIVE magnitude)
    expect(vSpd).toBe(8); // 10 − 2 (two independent Speed Down instances)
    expect(w.statuses.filter((s) => s.typeId === statusTypeId('speed_up'))).toHaveLength(1);
    expect(v.statuses.filter((s) => s.typeId === statusTypeId('speed_down'))).toHaveLength(2);
  });
});

describe('Sline — the basic attack strikes twice (Offering compose → 4)', () => {
  it('content pin: full Lance chassis (2H, reach 2, pierce, 0.9–1.1) + swing ×2', () => {
    expect(sline.weaponType).toBe('polearm');
    expect(sline.twoHanded).toBe(true);
    expect(sline.pierces).toBe(true);
    expect(sline.range).toEqual({ min: 1, max: 2, vertical: 4 });
    expect(sline.physicalVariance).toEqual({ kind: 'static', min: 0.9, max: 1.1 });
    expect(sline.attackSwingMultiplier).toBe(2);
  });

  it('swings-per-weapon: 2 with Sline alone, 4 with The Offering (D1: no rework, they compose)', () => {
    const alone = makeUnit({ id: 'a', spd: 10, equipment: holding('sline') });
    const paired = makeUnit({
      id: 'b', spd: 10,
      equipment: { ...holding('sline'), accessory: itemId('the_offering') },
    });
    const state = makeGameState({ units: [alone, paired] });
    const swings = (id: string): number =>
      runModifySwingsPerWeapon(state, cat, { unit: state.units.get(unitId(id))! });
    expect(swings('a')).toBe(2);
    expect(swings('b')).toBe(4);
  });
});

describe('Golden Rod — the Faustian countdown', () => {
  it('grants the pact via statusGrants (equipment lifecycle)', () => {
    expect(goldenRod.statusGrants).toEqual([statusTypeId('golden_rod_pact')]);
    expect(goldenRod.weaponType).toBe('wand');
    expect(goldenRod.wp).toBe(2);
  });

  it('one tick: +1 Gilded Focus, −10% MaxHP (system_damage), −10% MaxMP (negative mp_restore) — LINEAR of max', () => {
    const wielder = makeUnit({
      id: 'g', spd: 10, ct: 100, hp: 150, maxHpBase: 200, mp: 30, maxMpBase: 40,
      equipment: holding('golden_rod'),
      statuses: [
        {
          typeId: statusTypeId('golden_rod_pact'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: null,
        },
      ],
    });
    const state = makeGameState({
      units: [wielder],
      map: flatMap(3, 3),
      turnState: activeTurnFor(wielder.id),
    });
    const result = reduceStatusTick(
      state,
      {
        type: 'status_tick',
        sequenceNumber: 0,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: { unitId: wielder.id, statusTypeId: statusTypeId('golden_rod_pact') },
      },
      cat,
    );
    const types = result.generatedActions.map((a) => a.type);
    expect(types).toEqual(['system_apply_status', 'system_damage', 'system_mp_restore']);
    const [applyFocus, hpDrain, mpBurn] = result.generatedActions;
    expect(applyFocus).toMatchObject({
      payload: { statusTypeId: statusTypeId('gilded_focus'), targetId: wielder.id },
    });
    // LINEAR ruling: 10% of MAX (200 → 20), not of current (150).
    expect(hpDrain).toMatchObject({ payload: { amount: 20, targetId: wielder.id } });
    expect(mpBurn).toMatchObject({ payload: { amount: -4, targetId: wielder.id } });
  });

  it('the negative mp_restore burns MP and floors at 0', () => {
    const dry = makeUnit({ id: 'd', spd: 10, mp: 3, maxMpBase: 40 });
    const state = makeGameState({ units: [dry] });
    const r = reduceSystemMpRestore(
      state,
      {
        type: 'system_mp_restore',
        sequenceNumber: 0,
        source: 'system',
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
        payload: {
          targetId: unitId('d'),
          amount: -4,
          source: { kind: 'status_tick', statusTypeId: statusTypeId('golden_rod_pact'), unitId: unitId('d') },
        },
      },
      cat,
    );
    expect(r.outcome.applied).toBe(-3); // only 3 MP to burn
    expect(r.newState.units.get(unitId('d'))!.vitals.mp).toBe(0);
  });

  it('Gilded Focus stacks raise the MA query (+1 per stack)', () => {
    const focused = makeUnit({
      id: 'f', spd: 10, ma: 9,
      statuses: [
        {
          typeId: statusTypeId('gilded_focus'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: null,
          magnitude: 3,
        },
      ],
    });
    const state = makeGameState({ units: [focused] });
    const unit = state.units.get(unitId('f'))!;
    const ma = runModifyStatQuery(state, cat, { unit, statName: 'ma', baseValue: unit.baseStats.ma });
    expect(ma).toBe(12);
  });
});

describe("Del's Stave — the cast-time MP dump (dynamic SP seam)", () => {
  it('content pin: staff 5 · 80, castMpDump 10 MP per +1 SP', () => {
    expect(delsStave.weaponType).toBe('staff');
    expect(delsStave.wp).toBe(5);
    expect(delsStave.accuracy).toBe(80);
    expect(delsStave.castMpDump).toEqual({ mpPerBonusSp: 10 });
  });

  // Full charged flow: commit (dump + bank) → charge → resolve (bonus SP).
  // Water Lash: SP 8, mpCost 10, actionSpeed 30 (charged). Caster MA 10,
  // Faith 100 both sides, no variance on magical → exact numbers.
  const castThrough = (withStave: boolean): { mpAfterCommit: number; banked: number | undefined; damage: number } => {
    const caster = makeUnit({
      id: 'c', spd: 10, ma: 10, faith: 100, mp: 98, maxMpBase: 98,
      ...(withStave ? { equipment: holding('dels_stave') } : {}),
      position: { x: 0, y: 0, layer: 0 },
    });
    const target = makeUnit({
      id: 't', spd: 5, hp: 500, maxHpBase: 500, faith: 100, team: 'team_b',
      position: { x: 0, y: 2, layer: 0 },
    });
    let s = makeGameState({
      units: [caster, target],
      map: flatMap(5, 5),
      turnState: activeTurnFor(unitId('c')),
      masterSeed: 9,
    });
    const cast: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: unitId('c'),
      payload: {
        abilityId: abilityId('water_strike'),
        target: { kind: 'unit', unitId: unitId('t') },
      },
    };
    const committed = commitAction(s, cast, cat);
    expect(committed.ok).toBe(true);
    if (!committed.ok) throw new Error('commit failed');
    s = committed.newState;
    const mpAfterCommit = s.units.get(unitId('c'))!.vitals.mp;
    const banked = s.chargedActions[0]?.bonusSpellPower;

    // End the caster's turn so the scheduler can advance the charge.
    const ended = commitAction(
      s,
      { type: 'turn_end', source: 'system', payload: { unitId: unitId('c') } },
      cat,
    );
    if (!ended.ok) throw new Error('turn_end failed');
    s = ended.newState;

    // Drive the scheduler until the charge resolves.
    for (let i = 0; i < 60; i++) {
      const sched = advanceToNextEvent(s, cat);
      if (sched === null) break;
      s = sched.newState;
      const r = commitAction(s, sched.proposed, cat);
      if (!r.ok) throw new Error(`scheduler commit failed: ${JSON.stringify(r)}`);
      s = r.newState;
      if (sched.proposed.type === 'charged_action_resolve') break;
    }
    const damage = 500 - s.units.get(unitId('t'))!.vitals.hp;
    return { mpAfterCommit, banked, damage };
  };

  it('charged flow: commit dumps ALL MP, banks the bonus, resolve deals (SP + bonus) damage', () => {
    const bare = castThrough(false);
    expect(bare.mpAfterCommit).toBe(88); // normal cost 10
    expect(bare.banked).toBeUndefined();
    expect(bare.damage).toBe(80); // MA 10 × SP 8

    const nova = castThrough(true);
    expect(nova.mpAfterCommit).toBe(0); // ALL of it
    expect(nova.banked).toBe(8); // floor((98 − 10) / 10)
    expect(nova.damage).toBe(160); // MA 10 × (SP 8 + 8)
  });

  it('projection parity: the pre-commit forecast equals the live resolve (three-resolver discipline)', () => {
    const caster = makeUnit({
      id: 'c', spd: 10, ma: 10, faith: 100, mp: 98, maxMpBase: 98,
      equipment: holding('dels_stave'),
      position: { x: 0, y: 0, layer: 0 },
    });
    const target = makeUnit({
      id: 't', spd: 5, hp: 500, maxHpBase: 500, faith: 100, team: 'team_b',
      position: { x: 0, y: 2, layer: 0 },
    });
    const s = makeGameState({ units: [caster, target], map: flatMap(5, 5) });
    const projected = projectExpectedDamage({
      state: s,
      catalog: cat,
      attacker: s.units.get(unitId('c'))!,
      target: s.units.get(unitId('t'))!,
      ability: waterStrike,
      noEvasion: true,
    });
    expect(projected).toBe(160); // identical to the live charged resolve above
  });

  it('cheapest-spell incentive: lower cost → more leftover → more bonus SP', () => {
    const caster = makeUnit({
      id: 'c', spd: 10, mp: 98, maxMpBase: 98,
      equipment: holding('dels_stave'),
    });
    const s = makeGameState({ units: [caster] });
    const unit = s.units.get(unitId('c'))!;
    const cheap = prospectiveMpDumpBonusSp(s, cat, unit, waterStrike); // cost 10
    const dear = prospectiveMpDumpBonusSp(
      s, cat, unit,
      cat.getAbility(abilityId('maelstrom')) as typeof waterStrike, // cost 28
    );
    expect(cheap).toBe(8); // floor(88 / 10)
    expect(dear).toBe(7); // floor(70 / 10)
  });

  it('non-magical actions do not dump (the gate is the magical tag)', () => {
    const caster = makeUnit({
      id: 'c', spd: 10, mp: 50, maxMpBase: 50,
      equipment: holding('dels_stave'),
    });
    const s = makeGameState({ units: [caster] });
    expect(prospectiveMpDumpBonusSp(s, cat, s.units.get(unitId('c'))!, attack)).toBe(0);
  });
});

describe('Volley Bow — tile-aimed diamond-1 weapon-attack AoE', () => {
  it('content pin: bow 2H 8 · 40, opener range 2–4, diamond-1 attackAoe', () => {
    expect(volleyBow.weaponType).toBe('bow');
    expect(volleyBow.twoHanded).toBe(true);
    expect(volleyBow.wp).toBe(8);
    expect(volleyBow.accuracy).toBe(40);
    expect(volleyBow.range).toEqual({ min: 2, max: 4, vertical: 99 });
    expect(volleyBow.attackAoe).toEqual({ radius: 1 });
  });

  const volleyState = () => {
    const archer = makeUnit({
      id: 'a', spd: 10, pa: 10,
      equipment: holding('volley_bow'),
      position: { x: 0, y: 0, layer: 0 },
    });
    const enemy = makeUnit({
      id: 'e', spd: 10, hp: 300, maxHpBase: 300, team: 'team_b',
      position: { x: 0, y: 3, layer: 0 },
    });
    const ally = makeUnit({
      id: 'f', spd: 10, hp: 300, maxHpBase: 300,
      position: { x: 1, y: 3, layer: 0 }, // inside the diamond around (0,3)
    });
    const far = makeUnit({
      id: 'z', spd: 10, hp: 300, maxHpBase: 300, team: 'team_b',
      position: { x: 4, y: 4, layer: 0 }, // outside the blast
    });
    return makeGameState({
      units: [archer, enemy, ally, far],
      map: flatMap(6, 6),
      turnState: activeTurnFor(unitId('a')),
      masterSeed: 11,
    });
  };

  it('validation: the basic Attack accepts an EMPTY tile with the Volley Bow, not with a Longbow', () => {
    const state = volleyState();
    const aimAtEmpty: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: unitId('a'),
      payload: { abilityId: abilityId('attack'), target: { kind: 'tile', position: { x: 0, y: 2, layer: 0 } } },
    };
    expect(validateAction(state, aimAtEmpty, cat).valid).toBe(true);

    const longbowState = makeGameState({
      units: [
        makeUnit({ id: 'a', spd: 10, equipment: holding('longbow'), position: { x: 0, y: 0, layer: 0 } }),
      ],
      map: flatMap(6, 6),
      turnState: activeTurnFor(unitId('a')),
    });
    expect(validateAction(longbowState, aimAtEmpty, cat).valid).toBe(false);
  });

  it('resolution: a unit-aimed volley sweeps the diamond — enemy AND adjacent ally roll, far unit untouched', () => {
    const state = volleyState();
    const volley: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: unitId('a'),
      payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: unitId('e') } },
    };
    const r = commitAction(state, volley, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const root = r.committed[0]!;
    if (root.type !== 'use_ability' || root.outcome === undefined) {
      throw new Error('expected a use_ability outcome');
    }
    const resultIds = root.outcome.perTargetResults.map((t) =>
      t.target.kind === 'unit' ? String(t.target.unitId) : t.target.kind,
    );
    // Friendly fire: the ally shares the footprint with the enemy.
    expect(resultIds).toContain('e');
    expect(resultIds).toContain('f');
    expect(resultIds).not.toContain('z');
  });

  it('resolution: an EMPTY-tile volley still blasts the adjacent units (the opener shot)', () => {
    const state = volleyState();
    // Aim at (1,2): empty ground; diamond-1 covers... nothing there. Use
    // (0,2)? empty, diamond covers (0,3)=enemy and (1,2)... Aim at (1,3):
    // empty tile between enemy (0,3) and nothing — diamond covers enemy
    // AND ally (1,3 is ally's tile? no — ally IS at (1,3)). Aim at the
    // empty (0,2): diamond-1 = {(0,2),(0,1),(0,3),(1,2),(-1,2)} → enemy only.
    const volley: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: unitId('a'),
      payload: { abilityId: abilityId('attack'), target: { kind: 'tile', position: { x: 0, y: 2, layer: 0 } } },
    };
    const r = commitAction(state, volley, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const root = r.committed[0]!;
    if (root.type !== 'use_ability' || root.outcome === undefined) {
      throw new Error('expected a use_ability outcome');
    }
    const resultIds = root.outcome.perTargetResults.map((t) =>
      t.target.kind === 'unit' ? String(t.target.unitId) : t.target.kind,
    );
    expect(resultIds).toContain('e'); // caught in the blast off an empty anchor
    expect(resultIds).not.toContain('f');
  });

  it('projection: the AI/forecast resolver evaluates a volley target without throwing', () => {
    const state = volleyState();
    const projected = projectExpectedDamage({
      state,
      catalog: cat,
      attacker: state.units.get(unitId('a'))!,
      target: state.units.get(unitId('e'))!,
      ability: attack,
    });
    expect(Number.isFinite(projected)).toBe(true);
    expect(projected).toBeGreaterThanOrEqual(0);
  });
});

describe('Excalibur — Knight Sword capstone: Brave variance, Auto-Haste, Holy imbue', () => {
  it('content pin: knight_sword 2H, WP 16 · 95, Brave band, Haste grant, holy tag', () => {
    expect(excalibur.weaponType).toBe('knight_sword');
    expect(excalibur.twoHanded).toBe(true);
    expect(excalibur.wp).toBe(16);
    expect(excalibur.accuracy).toBe(95);
    expect(excalibur.physicalVariance).toEqual({ kind: 'attacker_brave', spread: 0.05 });
    expect(excalibur.statusGrants).toEqual([statusTypeId('haste')]);
    expect(excalibur.tags).toEqual(['sword', 'holy']);
  });

  it('Holy imbue resolves against the Holy resistance field (D2 payoff)', () => {
    const swing = (targetEquipment?: UnitEquipment): number => {
      const bearer = makeUnit({
        id: 'k', spd: 10, pa: 10, brave: 100, crit_chance: 0,
        equipment: holding('excalibur'),
      });
      const target = makeUnit({
        id: 't', spd: 10, hp: 900, maxHpBase: 900,
        position: { x: 1, y: 0, layer: 0 },
        ...(targetEquipment !== undefined ? { equipment: targetEquipment } : {}),
      });
      const state = makeGameState({ units: [bearer, target] });
      return (
        runDamagePipeline({
          state,
          catalog: cat,
          attacker: state.units.get(unitId('k'))!,
          target: state.units.get(unitId('t'))!,
          ability: attack,
          sourceActionSeq: 0,
          seed: 777,
          registry: defaultDamageHandlers,
        }).finalDamage ?? -1
      );
    };
    const vsPlain = swing();
    // Mantle of Protection carries the Holy-resistance vestige (+25) — the
    // tag merge (ADR-0028) must route Excalibur's strikes through it.
    const vsWarded = swing(holding('mantle_of_protection', 'accessory'));
    expect(vsPlain).toBeGreaterThan(0);
    expect(vsWarded).toBeLessThan(vsPlain);
  });
});

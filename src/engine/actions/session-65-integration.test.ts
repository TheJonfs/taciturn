// Session 65 — Knight content + equipment expansion + MP rebaseline +
// Barrier audit remedy. Mix of content-shape guards and behavioral tests:
//
//   1. Knight kit — Taunt suppressed, Bull Rush added (shape + Battle Skill).
//   2. Bull Rush knockback end-to-end — weapon damage + displacement + MP.
//   3. PA_factor formula (ADR-0108) + Lightning Stab's PA recalibration.
//   4. Assassin darts arc → straight_line (Barrier remedy A, ADR-0108).
//   5. Equipment — Barbut disable-resist, Circlet mana_font grant, Chain.
//   6. mana_font onTick → system_mp_restore = floor(MA / 2).
//   7. MP rebaseline values.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { commitAction } from './commit.ts';
import { reduceStatusTick } from './reducers.ts';
import { rollStatusChance } from '../status/chance.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { createInitialState } from '../setup/create-initial-state.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  itemId,
  rulesetId,
  statusTypeId,
  teamId,
  unitId,
  type BattleConfig,
  type ProposedAction,
} from '@engine/index.ts';
import { classBaselineStats } from '../../content/classes/baseline-stats.ts';
import { bullRush } from '../../content/abilities/bull-rush.ts';
import { lightningStab } from '../../content/abilities/lightning-stab.ts';
import { battleSkill } from '../../content/command-sets/battle-skill.ts';
import { blowdart } from '../../content/abilities/blowdart.ts';
import { shadowStitch } from '../../content/abilities/shadow-stitch.ts';
import { undermine } from '../../content/abilities/undermine.ts';
import { sowDoubt } from '../../content/abilities/sow-doubt.ts';
import { barbut } from '../../content/items/barbut.ts';
import { circlet } from '../../content/items/circlet.ts';
import { battlemagesChain } from '../../content/items/battlemages-chain.ts';
import { manaFont } from '../../content/statuses/mana-font.ts';

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');

// ===== 1. Knight kit — Taunt suppressed, Bull Rush added =====

describe('Knight Battle Skill — S65 Bull Rush / Taunt swap', () => {
  it('Battle Skill includes bull_rush and no longer includes taunt', () => {
    expect(battleSkill.members).toContain(abilityId('bull_rush'));
    expect(battleSkill.members).not.toContain(abilityId('taunt'));
  });

  it('Taunt stays registered in the catalog as a cross-class option', () => {
    const cat = loadDefaultCatalog();
    expect(cat.hasAbility(abilityId('taunt'))).toBe(true);
  });

  it('Bull Rush is a melee weapon attack: deals damage, costs MP, knocks back', () => {
    expect(bullRush.kind).toBe('active');
    if (bullRush.kind !== 'active') return;
    expect(bullRush.mpCost).toBe(6);
    const tg = bullRush.targeting;
    expect('rangeMode' in tg ? tg.rangeMode : undefined).toBe('melee');
    expect(bullRush.actionSpeed).toBe(0);
    expect(bullRush.hitRoll).toBeDefined();
    // Real weapon damage (the Taunt-audit lesson: the effect rides a hit).
    expect(bullRush.effects.damage?.tags).toEqual(
      expect.arrayContaining(['physical', 'weapon']),
    );
    expect(bullRush.effects.damage?.power_coefficient).toBe(1.0);
    // High-chance knockback, Brave × PA gated (the Knight's PA-driven shape).
    const kb = bullRush.effects.damage?.knockback;
    expect(kb?.distance).toBe(1);
    expect(kb?.chance).toBe(85);
    expect(kb?.factors).toEqual({ brave: true, pa: true });
  });
});

// ===== 2. Bull Rush knockback end-to-end =====

function buildBullRushBattle(): {
  state: ReturnType<typeof createInitialState>;
  catalog: ReturnType<typeof loadDefaultCatalog>;
} {
  const catalog = loadDefaultCatalog();
  const config: BattleConfig = {
    battleId: 'session_65_bull_rush',
    rulesetId: rulesetId('default'),
    map: flatMap(8, 8),
    teams: [
      { id: TEAM_A, name: 'A', control: 'human' },
      { id: TEAM_B, name: 'B', control: 'ai' },
    ],
    units: [
      {
        id: unitId('knight'),
        name: 'Knight',
        team: TEAM_A,
        classId: classId('knight'),
        position: { x: 1, y: 1, layer: 0 },
        facing: 'E',
        // Brave 100 (caster) × Brave 100 (target) → Brave_factor 1.0;
        // PA 10 → PA_factor 1.9; baseChance 0.85 → 1.615 clamps to 1.0 →
        // knockback fires deterministically when the hit lands.
        baseStats: {
          spd: 9, pa: 10, ma: 4, maxHpBase: 144, maxMpBase: 20,
          brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1,
        },
        vitals: { hp: 144, mp: 20 },
        equipment: {
          leftHand: null,
          rightHand: itemId('long_sword'),
          headgear: null,
          armor: null,
          accessory: null,
        },
        loadout: {
          actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
          passiveBuckets: {},
        },
      },
      {
        id: unitId('target'),
        name: 'Target',
        team: TEAM_B,
        classId: classId('knight'),
        position: { x: 2, y: 1, layer: 0 },
        // Faces East (away from the caster to the West) so the strike lands
        // on the back facing (evasion 0) — a deterministic hit.
        facing: 'E',
        baseStats: {
          spd: 9, pa: 10, ma: 4, maxHpBase: 144, maxMpBase: 20,
          brave: 100, faith: 80, crit_chance: 0, crit_multiplier: 1,
        },
        vitals: { hp: 144, mp: 0 },
        loadout: {
          actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
          passiveBuckets: {},
        },
      },
    ],
    victoryConditions: [
      { kind: 'defeat_all', side: TEAM_B, description: 'A wins' },
      { kind: 'defeat_all', side: TEAM_A, description: 'B wins' },
    ],
    masterSeed: 0xBEEF,
  };
  return { state: createInitialState(config, catalog), catalog };
}

describe('Bull Rush — knockback + weapon damage end-to-end', () => {
  it('deals weapon damage, shoves the target back one tile, and spends MP', () => {
    const { state, catalog } = buildBullRushBattle();
    const s = { ...state, turnState: activeTurnFor(unitId('knight')) };
    const proposed: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: unitId('knight'),
      payload: {
        abilityId: abilityId('bull_rush'),
        target: { kind: 'unit', unitId: unitId('target') },
      },
    };
    const result = commitAction(s, proposed, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const knightAfter = result.newState.units.get(unitId('knight'))!;
    const targetAfter = result.newState.units.get(unitId('target'))!;
    // MP spent (20 → 14).
    expect(knightAfter.vitals.mp).toBe(14);
    // Weapon damage landed (back facing → no evasion, deterministic hit).
    expect(targetAfter.vitals.hp).toBeLessThan(144);
    // Knocked one tile East (caster→target direction), from x=2 to x=3.
    expect(targetAfter.position.x).toBe(3);
    expect(targetAfter.position.y).toBe(1);
  });
});

// ===== 3. PA_factor + Lightning Stab recalibration =====

describe('Lightning Stab — S65 PA recalibration (ADR-0108)', () => {
  it('uses the PA-driven factor shape and the held-rate baseChance', () => {
    if (lightningStab.kind !== 'active') throw new Error('expected active');
    const silence = lightningStab.effects.statusEffects?.[0];
    expect(silence?.factors).toEqual({ brave: true, pa: true });
    // baseChance held at 50 through the MA → PA factor swap — a deliberate
    // uplift (PA 1.9 vs MA 1.3) making it solid anti-mage tech (ADR-0108).
    expect(silence?.baseChance).toBe(50);
  });
});

// ===== 4. Assassin darts arc → straight_line (Barrier remedy A) =====

describe('Assassin darts — arc → straight_line (S65 Barrier remedy A)', () => {
  it('all four darts are now LoS-gated (straight_line), not arc', () => {
    for (const dart of [blowdart, shadowStitch, undermine, sowDoubt]) {
      if (dart.kind !== 'active') throw new Error('expected active');
      const tg = dart.targeting;
      expect('rangeMode' in tg ? tg.rangeMode : undefined).toBe('straight_line');
    }
  });

  it('lobbed/area attacks stay arc (the cut is dart-only)', () => {
    const cat = loadDefaultCatalog();
    for (const id of ['earth_quake', 'tidal_wave', 'maelstrom']) {
      const ability = cat.getAbility(abilityId(id));
      if (ability.kind !== 'active') throw new Error('expected active');
      const tg = ability.targeting;
      expect('rangeMode' in tg ? tg.rangeMode : undefined).toBe('arc');
    }
  });
});

// ===== 5. Equipment =====

describe('Barbut — disable-status resistance (S65)', () => {
  it('halves incoming Stop / Don\'t Move / Don\'t Act chance for the wearer', () => {
    const cat = loadDefaultCatalog();
    const caster = makeUnit({ id: 'c', spd: 10, ma: 10, faith: 100, brave: 100 });
    const bare = makeUnit({ id: 'bare', spd: 10, faith: 100, brave: 100 });
    const barbutWearer = makeUnit({
      id: 'helm',
      spd: 10,
      faith: 100,
      brave: 100,
      equipment: {
        leftHand: null,
        rightHand: null,
        headgear: itemId('barbut'),
        armor: null,
        accessory: null,
      },
    });
    const state = makeGameState({ units: [caster, bare, barbutWearer] });
    for (const status of ['stop', 'dont_move', 'dont_act']) {
      const args = {
        state,
        catalog: cat,
        caster,
        statusType: cat.getStatusType(statusTypeId(status)),
        ability: null,
        baseChance: 50,
        seed: 0,
        // Stop uses brave+speed in content; force a stable factor set here so
        // the only difference between the two targets is the Barbut hook.
        factors: { brave: true } as const,
      };
      const bareChance = rollStatusChance({ ...args, target: bare }).chance;
      const helmChance = rollStatusChance({ ...args, target: barbutWearer }).chance;
      expect(helmChance).toBeCloseTo(bareChance * 0.5, 5);
    }
  });

  it('is restricted to Knight / Templar', () => {
    expect(barbut.classRestrictions).toEqual([classId('knight'), classId('templar')]);
  });
});

describe('Circlet — grants mana_font (S65)', () => {
  it('grants the mana_font status and is mage-restricted', () => {
    expect(circlet.statusGrants).toEqual([statusTypeId('mana_font')]);
    expect(circlet.classRestrictions).toContain(classId('lightning_mage'));
    expect(circlet.classRestrictions).toContain(classId('calculator'));
    expect(circlet.statMods).toEqual({ maxHpBase: 10, maxMpBase: 10 });
  });
});

describe("Battlemage's Chain — pure stat block (S65)", () => {
  it('is universal armor adding HP +80 / MP +10 / MA +1', () => {
    expect(battlemagesChain.kind).toBe('armor');
    expect(battlemagesChain.classRestrictions).toBeUndefined();
    expect(battlemagesChain.statMods).toEqual({ maxHpBase: 80, maxMpBase: 10, ma: 1 });
  });
});

// ===== 6. mana_font onTick → system_mp_restore floor(MA/2) =====

describe('mana_font — per-turn MP regen (S65 Circlet)', () => {
  it('emits system_mp_restore of floor(MA / 2) on tick', () => {
    const cat = loadDefaultCatalog();
    // MA 12 → floor(12/2) = 6 MP/turn. HP healthy, MP below max so there's room.
    const u = makeUnit({
      id: 'mage',
      spd: 10,
      ct: 100,
      ma: 12,
      hp: 80,
      mp: 10,
      maxMpBase: 48,
      statuses: [
        {
          typeId: statusTypeId('mana_font'),
          source: { unitId: null, actionSeq: null },
          remainingDuration: null,
        },
      ],
    });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
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
        payload: { unitId: u.id, statusTypeId: statusTypeId('mana_font') },
      },
      cat,
    );
    expect(result.generatedActions).toHaveLength(1);
    const emitted = result.generatedActions[0]!;
    expect(emitted.type).toBe('system_mp_restore');
    if (emitted.type !== 'system_mp_restore') return;
    expect(emitted.payload.amount).toBe(6);
    expect(emitted.payload.source.kind).toBe('status_tick');
  });

  it('is a battle-long permanent_per_unit_ct grant with an onTick hook', () => {
    expect(manaFont.durationMode).toBe('permanent_per_unit_ct');
    expect(manaFont.hooks.some((h) => h.name === 'onTick')).toBe(true);
  });
});

// ===== 7. MP rebaseline =====

describe('MP rebaseline (S65)', () => {
  it('drops the four elemental mages to 48 and the Calculator to 37', () => {
    const mp = (id: string) => classBaselineStats.get(classId(id))!.maxMpBase;
    expect(mp('earth_mage')).toBe(48);
    expect(mp('water_mage')).toBe(48);
    expect(mp('fire_mage')).toBe(48);
    expect(mp('lightning_mage')).toBe(48);
    expect(mp('calculator')).toBe(37);
  });

  it('leaves Terraformer (35) and the martials unchanged', () => {
    const mp = (id: string) => classBaselineStats.get(classId(id))!.maxMpBase;
    expect(mp('terraformer')).toBe(35);
    expect(mp('knight')).toBe(20);
    expect(mp('templar')).toBe(36);
    expect(mp('assassin')).toBe(24);
    expect(mp('alchemist')).toBe(36);
    expect(mp('hunter')).toBe(28);
  });
});

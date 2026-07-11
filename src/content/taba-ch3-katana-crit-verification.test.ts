// TABA Ch3 brief, work item 2b — the Katana crit verification (three
// ordered checks, each gating the next). VERIFICATION, not new
// mechanics: the brief asked whether the S85 crit-magnitude system
// actually produces damage, whether the three crit-CHANCE sources stack
// additively onto weapon attacks, and whether the Katana doubles the
// crit MULTIPLIER. All three pass against the shipped substrate — these
// tests pin the findings so a regression reopens the question loudly.
//
// Findings (reported to the planner):
//   1. A landed crit appends { source: 'crit', factor: crit_multiplier }
//      to the pipeline multipliers (critRoll, ADR-0032) — magnitude is
//      real, not chance-only. Default base crit_multiplier is 1.5.
//   2. Vicious Dagger +25 / Arcane Lens +10 / Keen Visor +5 are all
//      additive `statMods.crit_chance` read through one
//      modifyStatQuery chain (readCritChance), and the basic weapon
//      Attack runs `crit_roll` at the variance stage of the default
//      ruleset — chance sources stack and apply to weapon attacks.
//   3. Katana's statModsMultiplicative { crit_multiplier: 2 } composes
//      after the additive pass: 1.5 → 3.0 on a landed crit.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from './index.ts';
import { itemId, unitId } from '@engine/index.ts';
import type { UnitEquipment } from '@engine/index.ts';
import { runModifyStatQuery } from '../engine/hooks/runners.ts';
import { makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { runDamagePipeline } from '../engine/damage/pipeline.ts';
import { defaultDamageHandlers } from '../engine/damage/default-handlers.ts';
import { attack } from './abilities/attack.ts';
import { defaultRuleset } from './rulesets/default.ts';

const cat = loadDefaultCatalog();

const EMPTY: UnitEquipment = {
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: null,
  accessory: null,
};

// Basic weapon Attack through the full pipeline. `critChance` 100 forces
// the crit branch; 0 opts out. Returns the resolved pipeline ctx — the
// crit factor is asserted on `multipliers` directly (exact), since
// finalDamage rounds once at finalize and a speed-variance draw makes
// ratio assertions off-by-one.
function basicAttack(args: {
  readonly weapon: string;
  readonly critChance: number;
}): { finalDamage: number; critFactor: number | undefined } {
  const attacker = makeUnit({
    id: 'a',
    spd: 10,
    pa: 10,
    crit_chance: args.critChance,
    crit_multiplier: 1.5,
    equipment: { ...EMPTY, rightHand: itemId(args.weapon) },
  });
  const target = makeUnit({
    id: 't',
    spd: 10,
    hp: 900,
    maxHpBase: 900,
    position: { x: 1, y: 0, layer: 0 },
  });
  const state = makeGameState({ units: [attacker, target] });
  const ctx = runDamagePipeline({
    state,
    catalog: cat,
    attacker: state.units.get(unitId('a'))!,
    target: state.units.get(unitId('t'))!,
    ability: attack,
    sourceActionSeq: 0,
    seed: 4242,
    registry: defaultDamageHandlers,
  });
  return {
    finalDamage: ctx.finalDamage ?? -1,
    critFactor: ctx.multipliers.find((m) => m.source === 'crit')?.factor,
  };
}

describe('Katana crit verification — check 1: crit magnitude exists', () => {
  it('a landed crit on a basic weapon attack carries a ×1.5 crit multiplier and more damage', () => {
    const plain = basicAttack({ weapon: 'long_sword', critChance: 0 });
    const crit = basicAttack({ weapon: 'long_sword', critChance: 100 });
    expect(plain.finalDamage).toBeGreaterThan(0);
    expect(plain.critFactor).toBeUndefined();
    expect(crit.critFactor).toBe(1.5); // base crit_multiplier — magnitude is real
    expect(crit.finalDamage).toBeGreaterThan(plain.finalDamage);
  });
});

describe('Katana crit verification — check 2: chance sources stack additively on weapon attacks', () => {
  it('Vicious Dagger +25, Arcane Lens +10, Keen Visor +5 sum onto base crit chance', () => {
    const stacked = makeUnit({
      id: 's',
      spd: 10,
      crit_chance: 5,
      equipment: {
        ...EMPTY,
        rightHand: itemId('vicious_dagger'),
        accessory: itemId('arcane_lens'),
        headgear: itemId('keen_visor'),
      },
    });
    const state = makeGameState({ units: [stacked] });
    const unit = state.units.get(unitId('s'))!;
    const chance = runModifyStatQuery(state, cat, {
      unit,
      statName: 'crit_chance',
      baseValue: unit.baseStats.crit_chance,
    });
    expect(chance).toBe(5 + 25 + 10 + 5);
  });

  it('the chain feeds the basic weapon attack (crit fires at 100 through the same read)', () => {
    // Check 1 already drove a forced crit through the real `attack`
    // ability + default ruleset, so the chance read demonstrably gates
    // weapon attacks, not just ability casts. This pins the ruleset
    // wiring itself.
    expect(defaultRuleset.damagePipeline.stages.variance).toContain('crit_roll');
  });
});

describe('Katana crit verification — check 3: Katana doubles the crit multiplier', () => {
  it('crit_multiplier query: 1.5 → 3.0 with the Katana equipped', () => {
    const swordsman = makeUnit({
      id: 'k',
      spd: 10,
      crit_multiplier: 1.5,
      equipment: { ...EMPTY, rightHand: itemId('katana') },
    });
    const state = makeGameState({ units: [swordsman] });
    const unit = state.units.get(unitId('k'))!;
    const mult = runModifyStatQuery(state, cat, {
      unit,
      statName: 'crit_multiplier',
      baseValue: unit.baseStats.crit_multiplier,
    });
    expect(mult).toBe(3);
  });

  it('full pipeline: a Katana crit carries a ×3.0 multiplier (chance and size stay separate axes)', () => {
    const plain = basicAttack({ weapon: 'katana', critChance: 0 });
    const crit = basicAttack({ weapon: 'katana', critChance: 100 });
    expect(plain.critFactor).toBeUndefined();
    expect(crit.critFactor).toBe(3);
    expect(crit.finalDamage).toBeGreaterThan(plain.finalDamage);
    // …and the Katana does NOT touch the chance axis.
    const holder = makeUnit({
      id: 'h',
      spd: 10,
      crit_chance: 5,
      equipment: { ...EMPTY, rightHand: itemId('katana') },
    });
    const state = makeGameState({ units: [holder] });
    const unit = state.units.get(unitId('h'))!;
    const chance = runModifyStatQuery(state, cat, {
      unit,
      statName: 'crit_chance',
      baseValue: unit.baseStats.crit_chance,
    });
    expect(chance).toBe(5);
  });
});

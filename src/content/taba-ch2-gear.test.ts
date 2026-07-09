// TABA M3 Stage 2b — Ch2 second-pass gear (the demotion-hole restock).
//
// Covers the two new engine capabilities end-to-end through their first
// consumers, plus lineup conformance for the flat pieces:
//   - `modifyOutgoingStatusDuration` (the fourth quadrant of incoming/
//     outgoing × magnitude/duration) via Choir Staff: +1 duration on
//     finite positive statuses the wearer applies, self-casts included,
//     negatives and non-wearers untouched.
//   - equipment-driven `modifyAoeShape` growth via Wand of Expanse:
//     +1 shape-step on magical casts (the equipment-side Aether Bloom).
//   - the action-speed tag-gate union-read fix (Chris's M3 call): buff
//     casts (ability tags only, no damage spec) now match `['magical']`
//     riders — surfaced by Choir Staff, retroactively fixing Livre of
//     Urgency's documented-but-inert buff-cast bonus.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from './index.ts';
import { itemId, statusTypeId, unitId } from '@engine/index.ts';
import type { UnitEquipment } from '@engine/index.ts';
import { applyStatus } from '../engine/status/apply.ts';
import { runModifyActionSpeed, runModifyAoeShape } from '../engine/hooks/runners.ts';
import { makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { choirStaff } from './items/choir-staff.ts';
import { keenVisor } from './items/keen-visor.ts';
import { meditantsCowl } from './items/meditants-cowl.ts';
import { runecrown } from './items/runecrown.ts';
import { runicStaff } from './items/runic-staff.ts';
import { wandOfExpanse } from './items/wand-of-expanse.ts';
import { warmagesEdge } from './items/warmages-edge.ts';
import { attack } from './abilities/attack.ts';
import { enchantProtect } from './abilities/enchant-protect.ts';

const cat = loadDefaultCatalog();

const holding = (id: string): UnitEquipment => ({
  leftHand: null,
  rightHand: itemId(id),
  headgear: null,
  armor: null,
  accessory: null,
});

function buffScenario(equipment?: UnitEquipment) {
  const caster = makeUnit({ id: 'caster', spd: 10, ...(equipment ? { equipment } : {}) });
  const ally = makeUnit({ id: 'ally', spd: 10, position: { x: 1, y: 0, layer: 0 } });
  const state = makeGameState({ units: [caster, ally] });
  return { state, caster, ally };
}

describe('TABA Ch2 gear — scoping invariant', () => {
  it("every Ch2-new item is 'hidden' (TABA-scoped, invisible to Mage War)", () => {
    for (const item of [runicStaff, wandOfExpanse, choirStaff, warmagesEdge, runecrown, meditantsCowl, keenVisor]) {
      expect(item.availability, String(item.id)).toBe('hidden');
    }
  });
});

describe('Choir Staff — modifyOutgoingStatusDuration (first consumer)', () => {
  it('extends a finite positive buff the wearer applies by +1', () => {
    const { state } = buffScenario(holding('choir_staff'));
    const applied = applyStatus(
      state,
      {
        targetId: unitId('ally'),
        typeId: statusTypeId('protect_cast'),
        sourceUnitId: unitId('caster'),
        sourceActionSeq: 0,
        duration: 6,
        seed: 42,
      },
      cat,
    );
    const buff = applied.newState.units
      .get(unitId('ally'))!
      .statuses.find((s) => s.typeId === statusTypeId('protect_cast'))!;
    expect(buff.remainingDuration).toBe(7);
  });

  it('extends self-cast buffs too ("buffs you cast" includes yourself)', () => {
    const { state } = buffScenario(holding('choir_staff'));
    const applied = applyStatus(
      state,
      {
        targetId: unitId('caster'),
        typeId: statusTypeId('protect_cast'),
        sourceUnitId: unitId('caster'),
        sourceActionSeq: 0,
        duration: 6,
        seed: 42,
      },
      cat,
    );
    const buff = applied.newState.units
      .get(unitId('caster'))!
      .statuses.find((s) => s.typeId === statusTypeId('protect_cast'))!;
    expect(buff.remainingDuration).toBe(7);
  });

  it('does not extend negative statuses the wearer applies (positive-tag gate)', () => {
    const { state } = buffScenario(holding('choir_staff'));
    const applied = applyStatus(
      state,
      {
        targetId: unitId('ally'),
        typeId: statusTypeId('stop'),
        sourceUnitId: unitId('caster'),
        sourceActionSeq: 0,
        duration: 3,
        seed: 42,
      },
      cat,
    );
    const debuff = applied.newState.units
      .get(unitId('ally'))!
      .statuses.find((s) => s.typeId === statusTypeId('stop'))!;
    expect(debuff.remainingDuration).toBe(3);
  });

  it('does nothing for a caster without the staff (baseline sanity)', () => {
    const { state } = buffScenario();
    const applied = applyStatus(
      state,
      {
        targetId: unitId('ally'),
        typeId: statusTypeId('protect_cast'),
        sourceUnitId: unitId('caster'),
        sourceActionSeq: 0,
        duration: 6,
        seed: 42,
      },
      cat,
    );
    const buff = applied.newState.units
      .get(unitId('ally'))!
      .statuses.find((s) => s.typeId === statusTypeId('protect_cast'))!;
    expect(buff.remainingDuration).toBe(6);
  });
});

describe('Wand of Expanse — equipment-driven modifyAoeShape (first consumer)', () => {
  it('grows a magical AoE one shape-step (diamond r1 → r2)', () => {
    const { state, caster } = buffScenario(holding('wand_of_expanse'));
    const grown = runModifyAoeShape(state, cat, {
      unit: state.units.get(caster.id)!,
      ability: enchantProtect, // tags: ['magical']
      baseShape: { kind: 'diamond', radius: 1 },
    });
    expect(grown).toEqual({ kind: 'diamond', radius: 2 });
  });

  it('leaves non-magical AoE shapes untouched (tag gate)', () => {
    const { state, caster } = buffScenario(holding('wand_of_expanse'));
    const grown = runModifyAoeShape(state, cat, {
      unit: state.units.get(caster.id)!,
      ability: attack, // weapon strike — no 'magical' tag anywhere
      baseShape: { kind: 'diamond', radius: 1 },
    });
    expect(grown).toEqual({ kind: 'diamond', radius: 1 });
  });
});

describe('action-speed tag-gate union read (the Livre fix)', () => {
  it('a magical buff cast (no damage spec) now gets the +5 rider', () => {
    const { state, caster } = buffScenario(holding('choir_staff'));
    const speed = runModifyActionSpeed(state, cat, {
      unit: state.units.get(caster.id)!,
      ability: enchantProtect,
      baseActionSpeed: enchantProtect.actionSpeed,
    });
    expect(speed).toBe(enchantProtect.actionSpeed + 5);
  });
});

describe('TABA Ch2 flat pieces — lineup conformance', () => {
  it('Runic Staff: WP 4 · 80, MA +5, Speed −2', () => {
    expect(runicStaff.wp).toBe(4);
    expect(runicStaff.statMods).toEqual({ ma: 5, spd: -2 });
  });

  it("Warmage's Edge: WP 6 · 95 sword, PA +1 / MA +2 (first dual-stat weapon)", () => {
    expect(warmagesEdge.wp).toBe(6);
    expect(warmagesEdge.weaponType).toBe('sword');
    expect(warmagesEdge.statMods).toEqual({ pa: 1, ma: 2 });
  });

  it('Runecrown: MP +20 / MA +2 / +1 SP, mage lane', () => {
    expect(runecrown.statMods).toEqual({ maxMpBase: 20, ma: 2 });
    expect(runecrown.spellPowerModifiers).toEqual([{ delta: 1 }]);
    expect(runecrown.classRestrictions?.length).toBe(7);
  });

  it("Meditant's Cowl: MP +40 + magical charge speed", () => {
    expect(meditantsCowl.statMods).toEqual({ maxMpBase: 40 });
    expect(meditantsCowl.actionSpeedModifiers).toEqual([{ delta: 5, tagFilter: ['magical'] }]);
  });

  it('Keen Visor: Hit ×1.1 / Crit +5, universal', () => {
    expect(keenVisor.outgoingHitChanceMultipliers).toEqual([1.1]);
    expect(keenVisor.statMods).toEqual({ crit_chance: 5 });
    expect(keenVisor.classRestrictions).toBeUndefined();
  });
});

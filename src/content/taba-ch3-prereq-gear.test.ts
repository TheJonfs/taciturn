// TABA M3 Stage 3 — the three engine-prerequisite items, each the first
// consumer of its seam:
//   3a. Healer's Staff — `attackResolvesAsHeal`: weapon strikes flip to
//       healing at pipeline entry (heal = MA × WP × Faith; always lands).
//   3b. Battle Staff — `attackStat: 'ma'`: strikes read MA in the
//       physical formula (MA × WP × coefficient).
//   3c. Channeler's Hat — `conditionalIncomingDamageMods`: incoming
//       damage ×0.5 while the wearer carries the charging status.
// All driven through runDamagePipeline with the DEFAULT catalog + real
// items + the real `attack` ability.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from './index.ts';
import { itemId, unitId } from '@engine/index.ts';
import type { UnitEquipment } from '@engine/index.ts';
import { runDamagePipeline } from '../engine/damage/pipeline.ts';
import { defaultDamageHandlers } from '../engine/damage/default-handlers.ts';
import { makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { makeStatusInstance } from '../engine/status/test-fixtures.ts';
import { attack } from './abilities/attack.ts';
import { battleStaff } from './items/battle-staff.ts';
import { channelersHat } from './items/channelers-hat.ts';
import { healersStaff } from './items/healers-staff.ts';

describe('Stage 3 items — scoping + definition sanity', () => {
  it("all three are 'hidden' and declare their seam fields", () => {
    expect(healersStaff.availability).toBe('hidden');
    expect(healersStaff.attackResolvesAsHeal).toBe(true);
    expect(battleStaff.availability).toBe('hidden');
    expect(battleStaff.attackStat).toBe('ma');
    expect(channelersHat.availability).toBe('hidden');
    expect(channelersHat.conditionalIncomingDamageMods?.[0]?.factor).toBe(0.5);
  });
});

const cat = loadDefaultCatalog();

const holding = (id: string): UnitEquipment => ({
  leftHand: null,
  rightHand: itemId(id),
  headgear: null,
  armor: null,
  accessory: null,
});

describe("Healer's Staff — attack resolves as heal (Stage 3a)", () => {
  const build = () => {
    const wielder = makeUnit({
      id: 'w', spd: 10, pa: 3, ma: 10, faith: 100,
      equipment: holding('healers_staff'),
    });
    const ally = makeUnit({
      id: 'ally', spd: 10, faith: 100, hp: 10, maxHpBase: 300,
      position: { x: 1, y: 0, layer: 0 },
    });
    return { state: makeGameState({ units: [wielder, ally] }), wielder, ally };
  };

  it('flips the strike to healing: tags swap, magnitude = MA × WP × Faith', () => {
    const { state, wielder, ally } = build();
    const ctx = runDamagePipeline({
      state, catalog: cat, attacker: wielder, target: ally,
      ability: attack, sourceActionSeq: 0, seed: 7,
      registry: defaultDamageHandlers,
    });
    expect(ctx.damageTags.has('healing')).toBe(true);
    expect(ctx.damageTags.has('physical')).toBe(false);
    expect(ctx.hit).toBe(true); // no 'physical' tag → evasion roll skipped
    // heal = composed MA (10 + the staff's own +3) × WP 6 × Faith 1.0
    // = 78 pre-variance; attack's variance band [0.9, 1.1] → [70, 85].
    expect(ctx.finalDamage).toBeGreaterThanOrEqual(70);
    expect(ctx.finalDamage).toBeLessThanOrEqual(85);
  });

  it('a Long Sword wielder is untouched (the flag lives on the weapon)', () => {
    const wielder = makeUnit({ id: 'w', spd: 10, pa: 3, ma: 10, equipment: holding('long_sword') });
    const target = makeUnit({ id: 't', spd: 10, hp: 100, maxHpBase: 100, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [wielder, target] });
    const ctx = runDamagePipeline({
      state, catalog: cat, attacker: wielder, target,
      ability: attack, sourceActionSeq: 0, seed: 7,
      registry: defaultDamageHandlers,
    });
    expect(ctx.damageTags.has('healing')).toBe(false);
    expect(ctx.damageTags.has('physical')).toBe(true);
  });
});

describe('Battle Staff — attack-stat swap to MA (Stage 3b)', () => {
  it('strikes read MA, not PA: base = MA × WP × coefficient', () => {
    const wielder = makeUnit({
      id: 'w', spd: 10, pa: 3, ma: 12,
      equipment: holding('battle_staff'),
    });
    const target = makeUnit({ id: 't', spd: 10, hp: 200, maxHpBase: 200, position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({ units: [wielder, target] });
    // base = composed MA (12 + the staff's own +2) × WP 5 = 70 (the PA
    // path would be 3 × 5 = 15). Accuracy 80 means some seeds miss —
    // sample and check every landed hit's band.
    const finals = [1, 2, 3, 5, 8, 13, 21, 34].map(
      (seed) =>
        runDamagePipeline({
          state, catalog: cat, attacker: wielder, target,
          ability: attack, sourceActionSeq: 0, seed,
          registry: defaultDamageHandlers,
        }).finalDamage ?? 0,
    );
    const landed = finals.filter((f) => f > 0);
    expect(landed.length).toBeGreaterThan(0);
    for (const f of landed) {
      expect(f).toBeGreaterThanOrEqual(63); // 70 × 0.9
      expect(f).toBeLessThanOrEqual(77); // 70 × 1.1
    }
  });
});

describe("Channeler's Hat — ×0.5 incoming while charging (Stage 3c)", () => {
  const scenario = (charging: boolean) => {
    const wearer = makeUnit({
      id: 'w', spd: 10, hp: 200, maxHpBase: 200,
      equipment: { leftHand: null, rightHand: null, headgear: itemId('channelers_hat'), armor: null, accessory: null },
      statuses: charging ? [makeStatusInstance({ typeId: 'charging', remainingDuration: null })] : [],
    });
    const attacker = makeUnit({ id: 'a', spd: 10, pa: 10, equipment: holding('long_sword'), position: { x: 1, y: 0, layer: 0 } });
    return makeGameState({ units: [attacker, wearer] });
  };

  const hitFor = (state: ReturnType<typeof makeGameState>, seed: number) =>
    runDamagePipeline({
      state, catalog: cat,
      attacker: state.units.get(unitId('a'))!,
      target: state.units.get(unitId('w'))!,
      ability: attack, sourceActionSeq: 0, seed,
      registry: defaultDamageHandlers,
    });

  it('halves incoming damage while the wearer is charging', () => {
    // Same seed both ways → identical variance/evasion rolls; the only
    // delta is the ×0.5 charging multiplier.
    for (const seed of [1, 2, 3, 5, 8]) {
      const whileCharging = hitFor(scenario(true), seed);
      const whileIdle = hitFor(scenario(false), seed);
      if ((whileIdle.finalDamage ?? 0) === 0) continue; // missed — no comparison
      expect(whileCharging.finalDamage).toBe(Math.floor((whileIdle.finalDamage ?? 0) * 0.5));
    }
  });
});

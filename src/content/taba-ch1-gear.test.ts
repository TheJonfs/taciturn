// TABA M3 Stage 2a — Ch1 gear-generation content sanity.
//
// The ten Ch1 buyables are flat-compose items (no new engine work); this
// pins each definition to the lineup doc's numbers and the TABA-scoping
// invariant (all `hidden` — the Mage War frozen-pool pin is the other
// half of that contract). The Dagger's Vulnerable rider reuses the
// attackProcs substrate (session 30/31 tests own the mechanism); here we
// pin the content wiring: 50% chance → apply_vulnerable_proc, which
// lands `applyAlways` on the existing one-shot Vulnerable status.

import { describe, expect, it } from 'vitest';
import { abilityId, statusTypeId } from '@engine/index.ts';
import { applyVulnerableProc } from './abilities/apply-vulnerable-proc.ts';
import { arcaneRobe } from './items/arcane-robe.ts';
import { chainShirt } from './items/chain-shirt.ts';
import { cutlass } from './items/cutlass.ts';
import { dagger } from './items/dagger.ts';
import { ironSword } from './items/iron-sword.ts';
import { linenRobe } from './items/linen-robe.ts';
import { paddedJacket } from './items/padded-jacket.ts';
import { paddedVest } from './items/padded-vest.ts';
import { shortBow } from './items/short-bow.ts';
import { woodmansAxe } from './items/woodmans-axe.ts';

const CH1_ITEMS = [
  ironSword,
  cutlass,
  woodmansAxe,
  shortBow,
  dagger,
  paddedVest,
  paddedJacket,
  chainShirt,
  linenRobe,
  arcaneRobe,
];

describe('TABA Ch1 gear — scoping invariant', () => {
  it("every Ch1-new item is 'hidden' (TABA-scoped, invisible to Mage War)", () => {
    for (const item of CH1_ITEMS) {
      expect(item.availability, String(item.id)).toBe('hidden');
    }
  });
});

describe('TABA Ch1 weapons — lineup conformance', () => {
  it('Iron Sword: WP 5 · 95, vanilla', () => {
    expect(ironSword.wp).toBe(5);
    expect(ironSword.accuracy).toBe(95);
    expect(ironSword.attackProcs).toBeUndefined();
    expect(ironSword.evasionMods).toBeUndefined();
  });

  it('Cutlass: WP 4 · 95, Front +5 / Side +2 evade', () => {
    expect(cutlass.wp).toBe(4);
    expect(cutlass.evasionMods).toEqual({ front: 5, side: 2 });
  });

  it("Woodman's Axe: WP 7 · 75, static [0.9, 1.3] band", () => {
    expect(woodmansAxe.wp).toBe(7);
    expect(woodmansAxe.accuracy).toBe(75);
    expect(woodmansAxe.physicalVariance).toEqual({ kind: 'static', min: 0.9, max: 1.3 });
  });

  it('Short Bow: WP 3 · 40, full bow package (range 2–5, height variance + reach)', () => {
    expect(shortBow.wp).toBe(3);
    expect(shortBow.accuracy).toBe(40);
    expect(shortBow.twoHanded).toBe(true);
    expect(shortBow.range).toEqual({ min: 2, max: 5, vertical: 99 });
    expect(shortBow.physicalVariance).toEqual({ kind: 'height_delta', falloffPerHeight: 0.2 });
    expect(shortBow.rangeFromHeightBonus).toEqual({ perDeltaVertical: 2, deltaHorizontal: 1 });
  });

  it('Dagger: WP 2 · 95, speed variance, 50% Vulnerable proc', () => {
    expect(dagger.wp).toBe(2);
    expect(dagger.physicalVariance).toEqual({ kind: 'attacker_speed', spread: 0.05 });
    expect(dagger.attackProcs).toEqual([
      { chance: 0.5, abilityId: abilityId('apply_vulnerable_proc') },
    ]);
  });

  it('apply_vulnerable_proc: hidden, MP-free, applyAlways onto the existing Vulnerable', () => {
    expect(applyVulnerableProc.availability).toBe('hidden');
    expect(applyVulnerableProc.mpCost).toBe(0);
    const effect = applyVulnerableProc.effects.statusEffects?.[0];
    expect(effect?.typeId).toBe(statusTypeId('vulnerable'));
    expect(effect?.applyAlways).toBe(true);
  });
});

describe('TABA Ch1 armor — lineup conformance', () => {
  it('Padded Vest: HP +50 universal (no class restriction)', () => {
    expect(paddedVest.statMods).toEqual({ maxHpBase: 50 });
    expect(paddedVest.classRestrictions).toBeUndefined();
  });

  it('Padded Jacket: HP +30 / MP +15 universal', () => {
    expect(paddedJacket.statMods).toEqual({ maxHpBase: 30, maxMpBase: 15 });
    expect(paddedJacket.classRestrictions).toBeUndefined();
  });

  it('Chain Shirt: HP +80, +15 all-element res, Heavy lane (Knight/Templar)', () => {
    expect(chainShirt.statMods).toEqual({ maxHpBase: 80 });
    expect([...(chainShirt.resistanceMods ?? new Map())]).toEqual([
      ['fire', 15],
      ['water', 15],
      ['earth', 15],
      ['lightning', 15],
    ]);
    expect(chainShirt.classRestrictions?.map(String).sort()).toEqual(['knight', 'templar']);
  });

  it('Linen Robe: HP +20 / MP +20 / MA +2, mage lane', () => {
    expect(linenRobe.statMods).toEqual({ maxHpBase: 20, maxMpBase: 20, ma: 2 });
    expect(linenRobe.classRestrictions?.length).toBe(7);
  });

  it('Arcane Robe: HP +10 / MP +20, +25 all-element res, mage lane', () => {
    expect(arcaneRobe.statMods).toEqual({ maxHpBase: 10, maxMpBase: 20 });
    expect([...(arcaneRobe.resistanceMods ?? new Map())].every(([, v]) => v === 25)).toBe(true);
    expect(arcaneRobe.classRestrictions?.length).toBe(7);
  });
});

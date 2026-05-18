// apply_silence_proc — Session 40. Hidden single-target Silence
// application fired by Magebane's `attackProcs`.
//
// Follows the same convention as `apply_burn_proc` (Session 31): the
// weapon-side `attackProcs[].chance` is a flat percentage (Magebane:
// 50%) — decoupling weapon riders from the wielder's casting prowess.
// A Knight wielding Magebane procs Silence at the same rate as an
// Alchemist wielding Magebane. Per Chris's design call (matching
// FFT weapon-effect mechanics): "flat rate for triggering the effect,
// which can be modified by future status-application boosting effects."
//
// Once the proc lands, the Silence application short-circuits the BMG
// formula via `applyAlways: true` — the application always lands modulo
// the modifier hook chain (Pointy Hat × 0.5, Focus Band × 0.75, future
// Brave-gated content). The hook chain runs against the pre-applyAlways
// chance of 1.0; multiplicative modifiers reduce from there.
//
// `actionSpeed: 0` is the explicit-instant authoring choice; the rider
// bypass path (ADR-0068) short-circuits charge regardless, but keeping
// the field at 0 keeps the ability self-coherent if it ever surfaces
// outside a rider context.
//
// MP-free, hidden. The ability never appears in a command menu — only
// fired from the attackProcs substrate via riderSource.
//
// Silence duration: 4 turns. Matches Earth Curse's Silence duration
// (the only other Silence-applying ability in v1). Per the S40 brief's
// D3, 4 turns sits in the existing status-duration palette (3 / 4 / 6
// / 10) and is decisive without being game-ending.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const applySilenceProc: ActiveAbilityDefinition = {
  id: abilityId('apply_silence_proc'),
  name: 'Silence',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  // No damage tags — pure status-application rider. Magebane's physical
  // hit carries 'physical' / 'weapon' / 'knife'; this ability runs
  // outside the damage pipeline and only declares its own effect tags.
  tags: [],
  targeting: {
    kind: 'single_unit',
    // Range is irrelevant for rider-fired emission (the proc handler
    // emits against `ctx.target.id` directly); declared 1H/1V so the
    // ability self-describes a "melee" reach if it ever surfaces in a
    // non-rider context.
    range: { horizontal: 1, vertical: 1 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 0,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('silence'),
        target: 'primary_target',
        applyAlways: true,
        duration: 4,
      },
    ],
  },
};

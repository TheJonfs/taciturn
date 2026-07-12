// Blind — multiplicative reduction on physical hit chance.
//
// Per session 16 plaintext review: magnitude 0.5 (× 0.5 to hit chance).
// Hooks the new `modifyHitChance` chain (per ADR-0024); evasion_check
// in the damage pipeline collects the chain product against the target
// and folds it into the BMG hit_chance formula:
//   hit_chance = weapon_accuracy × (1 - evasion/100) × elevation × ∏modifiers
// before clamping to [0.05, 1.0]. So Blind always cuts hit chance in
// half; the engine clamp guarantees at least 5% hit chance even on a
// fully-Blind target.
//
// Magical-only attacks aren't gated by hit chance (per BMG, magical
// damage always lands). Blind has no effect on Earth Strike's
// magical damage — only the status rider can be resisted; the damage
// itself lands on hit. This is BMG-faithful.
//
// Resistance tag: none today. Blind is a "mental"-flavored status; if
// session 17+ adds a 'mental' resistance tag, this status would adopt
// it. For now, Blind can't be resisted via tag — only via the Faith /
// MA / modifier path of the application formula.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

const BLIND_HIT_MULTIPLIER = 0.5;

export const blind: StatusEffectType = {
  id: statusTypeId('blind'),
  name: 'Blind',
  tags: ['negative', 'mental'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  aiHints: { polarity: 'debuff', value: 18 },
  hooks: [
    statusHook('modifyHitChance', (args) => args.baseHitChance * BLIND_HIT_MULTIPLIER),
  ],
};

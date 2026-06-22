// regen_auto — Session 31 battle-long sibling of Regen.
//
// Same heal-per-tick formula as `regen` (shares `regenOnTick`); differs
// only in lifecycle. `'permanent_per_unit_ct'` (no expiry by time)
// supports equipment-driven Auto-Regen — first consumer is Tintinibar.
//
// Sibling pattern matches Shell / future cast-Shell: type carries
// behavior, lifecycle semantics differentiate the sibling. The cast
// `regen` keeps `'per_unit_ct'` with `duration 36` for Earth Blessing
// and any future timed Regen.
//
// Per Tintinibar's prior watch-for comment (resolved this session):
// the equipment statusGrants pipeline applies grants without a
// duration argument, which `'per_unit_ct'` types reject. Splitting the
// type by lifecycle is the cleaner fix than introducing per-grant
// duration overrides in `statusGrants`.

import { statusTypeId, type StatusEffectType } from '@engine/index.ts';
import { regenOnTick } from './regen.ts';

export const regenAuto: StatusEffectType = {
  id: statusTypeId('regen_auto'),
  // Per Session 31.5 bug 1: display name matches the cast Regen ability
  // for player readability. The two statuses are distinguished by their
  // type id (`regen_auto` vs `regen`) and their durations — Auto-Regen
  // displays as "Regen ∞" while cast Regen displays as "Regen N" — but
  // the name shown to the player is the same.
  name: 'Regen',
  tags: ['positive'],
  durationMode: 'permanent_per_unit_ct',
  stackingRule: 'REFRESH',
  // Coefficient scalar (default 1). NOT `amplifiable` — equipment Auto-Regen
  // (Tintinibar) is outside the Aura-Mastery curation, so it stays at 1×.
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [regenOnTick],
};

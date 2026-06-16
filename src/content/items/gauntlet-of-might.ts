// Gauntlet of Might — Session 68. Accessory, PA +3. The contested
// physical-power accessory: a flat additive `statMods.pa` (the Diamond
// Bracelet / Strength Ring pattern, scaled up). +3 PA is potent across
// every PA-scaled effect — basic-attack damage, the Thief's PA-gated
// charm / Steal MP, status-application PA_factor — so the existing
// unique-per-team rule gates it to a single unit, making it a real
// allocation decision rather than a freebie.
//
// Shipped at +3 per the brief; +2 is the flagged fallback if it reads
// too strong in the feel pass (see docs/playtest-watch.md).

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const gauntletOfMight: AccessoryEquipment = {
  id: itemId('gauntlet_of_might'),
  name: 'Gauntlet of Might',
  availability: 'available',
  kind: 'accessory',
  statMods: { pa: 3 },
};

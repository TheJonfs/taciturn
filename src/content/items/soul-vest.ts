// Soul Vest — universal body armor (any class). Mental/conviction body:
// modest HP cushion (+50) paired with +10 Brave and +10 Faith. Brave
// gates reaction firing probability (Counter, Smolder, Discharge, Speed
// Save, Updraft, Cornered Focus, Earth Resilience, etc. all roll
// against it); Faith × MA scales magical damage / heal output and
// status application chance via the BMG application formula.
//
// Different axis from the existing universal body pool: Battle Gear
// trades stat-up for raw HP, Silvered Vest is the magical-defensive
// pick, Travel Garb is mobility, Shimmer Cloak is evasion. Soul Vest
// lifts the unit's psychological and spiritual stats — the first
// universal piece to touch Brave/Faith (Tricorn does +10 Brave but is
// Mage-only; Crusader's Helm does +10 Faith but is Knight-only). Pairs
// strongly with reaction-heavy Knights, Hunter Brave-gated bow procs,
// Alchemist magic-secondary builds, and hybrid Mages running cross-
// class debuffs at higher application rate.

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const soulVest: ArmorEquipment = {
  id: itemId('soul_vest'),
  name: 'Soul Vest',
  availability: 'available',
  kind: 'armor',
  statMods: { maxHpBase: 50, brave: 10, faith: 10 },
};

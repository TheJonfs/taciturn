// Talisman of Endurance — TABA Ch3 universal off-hand (M3 equipment
// expansion). Incoming negative statuses land at ×(1 − max(PA, MA)/100).
//
// The stat-scaled status shrug: a hero with 30 in their prime stat
// shrugs 30% of incoming ailment chance. Multiplicative (mirroring
// Focus Band's ×0.75), so the stack approaches but can never reach
// immunity — the lineup's settled anti-immunity guarantee. Universal
// via max(PA, MA): fighters and mages endure equally. First consumer
// of `incomingStatusStatShrugs` (composed PA/MA — buffs count).
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type ShieldEquipment } from '@engine/index.ts';

export const talismanOfEndurance: ShieldEquipment = {
  id: itemId('talisman_of_endurance'),
  name: 'Talisman of Endurance',
  availability: 'hidden',
  kind: 'shield',
  incomingStatusStatShrugs: [{ statusTag: 'negative' }],
};

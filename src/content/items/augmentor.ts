// Augmentor — capacity expansion accessory. +1 Support-bucket capacity
// lets the wearer add another cost-1 Support ability or upgrade to a
// higher-cost Support ability than would otherwise fit. Sister
// mechanic to Steel Helm's +1 Reaction-capacity.

import { bucketId, itemId, type AccessoryEquipment } from '@engine/index.ts';

export const augmentor: AccessoryEquipment = {
  id: itemId('augmentor'),
  name: 'Augmentor',
  availability: 'available',
  kind: 'accessory',
  bucketCapacityMods: new Map([[bucketId('support'), 1]]),
};

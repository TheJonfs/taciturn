// Haste — placeholder stub used to verify the catalog loader end-to-end.
// Real status content (with hooks, magnitude, duration mode, stacking)
// arrives in session 3 and the status-catalog expansion pass.

import { statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const haste: StatusEffectType = {
  id: statusTypeId('haste'),
  name: 'Haste',
};

// Team — a side in a battle.
// See docs/design/core-types.md.

import type { TeamId } from './ids.ts';

export interface Team {
  readonly id: TeamId;
  readonly name: string;
}

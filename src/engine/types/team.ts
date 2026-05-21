// Team — a side in a battle.
// See docs/design/core-types.md.

import type { TeamId } from './ids.ts';

// Who drives a team's turns: a human at the keyboard (UI controller) or
// the AI. Read by the app when wiring the orchestrator's per-team
// ControllerMap and by the battle HUD's active-team signaling. The pure
// engine never reads `control` — it's carried as battle-setup data, not
// a rules input. See ADR-0082.
export type TeamControl = 'human' | 'ai';

export interface Team {
  readonly id: TeamId;
  readonly name: string;
  readonly control: TeamControl;
}

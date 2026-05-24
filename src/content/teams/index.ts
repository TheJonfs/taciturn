// Public API of src/content/teams.
//
// The team builder's default templates and the `BuiltTeam` shape they
// (and the builder's output) conform to. The team builder's "Load
// Default" affordance enumerates `defaultTeamTemplates`.

export {
  buildBaseStats,
  BRAVE_FAITH_MIN,
  BRAVE_FAITH_MAX,
  MAX_TEAM_SIZE,
  MIN_TEAM_SIZE,
  type BuiltTeam,
  type BuiltUnit,
} from './built-team.ts';
export { buildTeamBattleConfig } from './build-team-battle-config.ts';
import type { BuiltTeam } from './built-team.ts';
import { currentTestTeam } from './current-test-team.ts';
import { defensiveFront } from './defensive-front.ts';
import { highlandHunters } from './highland-hunters.ts';
import { mageVarietyPack } from './mage-variety-pack.ts';
import { shadowAndSteel } from './shadow-and-steel.ts';

export { currentTestTeam } from './current-test-team.ts';
export { defensiveFront } from './defensive-front.ts';
export { highlandHunters } from './highland-hunters.ts';
export { mageVarietyPack } from './mage-variety-pack.ts';
export { shadowAndSteel } from './shadow-and-steel.ts';

// A loadable template: a stable id (for React keys / selection state)
// paired with its `BuiltTeam`. The display label is the team's `name`.
export interface TeamTemplate {
  readonly id: string;
  readonly team: BuiltTeam;
}

// Three Phase-E close templates (Session 38). The id of the first entry
// is retained as `current-test-team` for state-key continuity even
// though the display label is "Aggro Knight Squad" — the file path
// lives at `current-test-team.ts` for the same reason.
//
// Eliminating `pure-mage-team` (replaced by `mage-variety-pack`).
export const defaultTeamTemplates: ReadonlyArray<TeamTemplate> = [
  { id: 'current-test-team', team: currentTestTeam },
  { id: 'mage-variety-pack', team: mageVarietyPack },
  { id: 'defensive-front', team: defensiveFront },
  { id: 'shadow-and-steel', team: shadowAndSteel },
  { id: 'highland-hunters', team: highlandHunters },
];

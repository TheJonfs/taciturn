// Public API of src/content/teams.
//
// The team builder's default templates and the `BuiltTeam` shape they
// (and the builder's output) conform to. The team builder's "Load
// Default" affordance enumerates `defaultTeamTemplates`.

export {
  buildBaseStats,
  BRAVE_FAITH_MIN,
  BRAVE_FAITH_MAX,
  type BuiltTeam,
  type BuiltUnit,
} from './built-team.ts';
export { buildTeamBattleConfig } from './build-team-battle-config.ts';
import type { BuiltTeam } from './built-team.ts';
import { currentTestTeam } from './current-test-team.ts';
import { pureMageTeam } from './pure-mage-team.ts';

export { currentTestTeam } from './current-test-team.ts';
export { pureMageTeam } from './pure-mage-team.ts';

// A loadable template: a stable id (for React keys / selection state)
// paired with its `BuiltTeam`. The display label is the team's `name`.
export interface TeamTemplate {
  readonly id: string;
  readonly team: BuiltTeam;
}

export const defaultTeamTemplates: ReadonlyArray<TeamTemplate> = [
  { id: 'current-test-team', team: currentTestTeam },
  { id: 'pure-mage-team', team: pureMageTeam },
];

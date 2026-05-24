// Public API of src/content/teams.
//
// The team builder's default templates and the `BuiltTeam` shape they
// (and the builder's output) conform to. The team builder's "Load
// Default" affordance enumerates `defaultTeamTemplates`; tests and
// scenarios that referenced the pre-S48 set continue to import via the
// preserved `legacyTeamTemplates` collection.

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
// S38 templates — kept for tests + any scenario configs that still
// reference them. Surfaced under `legacyTeamTemplates`, NOT the
// user-facing picker. Re-exported individually below so test files
// can import a specific template by symbol (same as pre-S48).
import { currentTestTeam } from './current-test-team.ts';
import { defensiveFront } from './defensive-front.ts';
import { highlandHunters } from './highland-hunters.ts';
import { mageVarietyPack } from './mage-variety-pack.ts';
import { shadowAndSteel } from './shadow-and-steel.ts';
// S48 templates — the user-facing "Load Default" set under
// `defaultTeamTemplates`. Author one file per template; add new ones
// to the array below.
import { gravityWell } from './gravity-well.ts';
import { highGround } from './high-ground.ts';
import { mageWar } from './mage-war.ts';

export { currentTestTeam } from './current-test-team.ts';
export { defensiveFront } from './defensive-front.ts';
export { highlandHunters } from './highland-hunters.ts';
export { mageVarietyPack } from './mage-variety-pack.ts';
export { shadowAndSteel } from './shadow-and-steel.ts';
export { gravityWell } from './gravity-well.ts';
export { highGround } from './high-ground.ts';
export { mageWar } from './mage-war.ts';

// A loadable template: a stable id (for React keys / selection state)
// paired with its `BuiltTeam`. The display label is the team's `name`.
export interface TeamTemplate {
  readonly id: string;
  readonly team: BuiltTeam;
}

// S48 default templates — the set surfaced in the team-builder's "Load
// Default…" picker. Authored by Chris using the S48 team-export modal;
// any combination of team-size (1–MAX_TEAM_SIZE) is valid under the
// variable-length BuiltTeam shape.
export const defaultTeamTemplates: ReadonlyArray<TeamTemplate> = [
  { id: 'gravity-well', team: gravityWell },
  { id: 'high-ground', team: highGround },
  { id: 'mage-war', team: mageWar },
];

// S38 templates retained for tests + scenario configs that reference
// them by symbol. NOT shown in the team-builder picker. Pre-S48 these
// were the entire `defaultTeamTemplates` set; S48 split them off so
// the user-facing picker shows the new authored teams without losing
// the fixture / regression surface the old templates back.
export const legacyTeamTemplates: ReadonlyArray<TeamTemplate> = [
  { id: 'current-test-team', team: currentTestTeam },
  { id: 'mage-variety-pack', team: mageVarietyPack },
  { id: 'defensive-front', team: defensiveFront },
  { id: 'shadow-and-steel', team: shadowAndSteel },
  { id: 'highland-hunters', team: highlandHunters },
];

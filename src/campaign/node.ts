// TABA campaign — the battle-node graph (M0: linear A → B).
//
// A node is authored as "a partial BattleConfig" (taba-m0-brief): map +
// enemy team + player deploy zones + K. The snapshot-fold drops the player
// roster into the template's player slots — the node IS "(BattleConfig −
// player team)" with the player slots standing in as placeholders.
//
// M0 populates enemies the lazy way (brief): reference existing battle
// templates + existing maps. The durable-roster machinery is player-side
// ONLY — the template's enemy team is ordinary battle-local placements that
// never persist. Win/loss defaults to the templates' standard rout.
// Authored/generated encounters are M4; branching is M1. This array is the
// whole graph; the loop walks it by index.

import { teamId } from '@engine/index.ts';
import type { BattleConfig, DeploymentZoneConfig, TeamId } from '@engine/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { stonebridgeBattle } from '@content/battles/stonebridge-battle.ts';
import { deploymentZonesFor } from '@content/deployment/index.ts';

export interface CampaignNode {
  readonly id: string;
  readonly name: string;
  // Map + enemy team + placeholder player slots. The fold replaces the
  // `playerTeam` placements; everything else (enemies, victory conditions)
  // is consumed as-authored.
  readonly template: BattleConfig;
  readonly playerTeam: TeamId;
  readonly zones: DeploymentZoneConfig;
  // K — the per-node deploy cap. The Formation screen selects up to this
  // many `active` roster units. (N — roster size — is a campaign property.)
  readonly deployCap: number;
}

const PLAYER: TeamId = teamId('team_a');
const M0_DEPLOY_CAP = 5;

// Node A — River Ridge. Node B — Stonebridge. Both reuse the shipped
// battle templates (player = team_a placeholders, enemy = team_b authored)
// and their default deployment zones. Two different maps so "carry the same
// units to a new battlefield" is visible.
export const M0_NODE_GRAPH: ReadonlyArray<CampaignNode> = [
  {
    id: 'node-a-river-ridge',
    name: 'River Ridge',
    template: riverRidgeBattle,
    playerTeam: PLAYER,
    zones: deploymentZonesFor('river_ridge'),
    deployCap: M0_DEPLOY_CAP,
  },
  {
    id: 'node-b-stonebridge',
    name: 'Stonebridge',
    template: stonebridgeBattle,
    playerTeam: PLAYER,
    zones: deploymentZonesFor('stonebridge'),
    deployCap: M0_DEPLOY_CAP,
  },
];

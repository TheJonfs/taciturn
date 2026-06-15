// effectiveController — the team that currently *controls* a unit's actions.
//
// Normally a unit's own `team`. While a `controlOverride` status is active on
// it (the Thief's Steal Heart charm, `enthralled`), control passes to the team
// named in that status instance's `customState.charmerTeam` — the unit acts
// for the charmer while its `team` (roster / win-loss membership) is unchanged.
//
// Computed, never stored (ground rule 5): when the charm expires or breaks,
// the status leaves and control reverts automatically with no separate
// mutation to unwind. This is the reusable control-override substrate — future
// Confusion (controller → none / random) and Berserk (controller → forced
// attack) consume the same `controlOverride` flag with different customState
// and a branch here.
//
// v1 scope (ADR-0111): control-only redirection. A charmed unit's *team* is
// unchanged, so friend/foe (targeting, AoE coloring, the other side's AI
// threat assessment) and win/loss still key off `team`; the charmer directs
// the puppet against its old allies via the ruleset's friendlyFire allowance.

import type { Catalog } from '../catalog/index.ts';
import type { TeamId, Unit } from '../types/index.ts';

export function effectiveController(unit: Unit, catalog: Catalog): TeamId {
  for (const inst of unit.statuses) {
    if (catalog.getStatusType(inst.typeId).controlOverride !== true) continue;
    const charmer = inst.customState?.['charmerTeam'];
    // The charmer's team is stored as the raw branded string at apply time.
    if (typeof charmer === 'string') return charmer as TeamId;
  }
  return unit.team;
}

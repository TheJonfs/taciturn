// TABA campaign — the canonical vitals/stat probe battlefield.
//
// Several campaign reads fold a unit into a throwaway battle state just to
// read numbers out (effective max vitals, effective stats): the campaign-
// start bootstrap, the hire flow, the Formation stat probes. The probe never
// fights — the template only has to pass structural checks (player slots to
// stand on, a valid ruleset) — so WHICH battlefield is used cannot change
// the result (pinned by probe-battle.test.ts). This module fixes ONE
// canonical template for every such read, which is what frees a location
// from needing a battlefield of its own: a PURE MARKET TOWN (isHub, no
// beats) can size a hire against the canonical field.
//
// Node-local preference stays: where a node HAS a battle beat, callers keep
// probing against it via `probeBattleFor` — same numbers, but the probe
// rides the exact template a deploy there would use.

import { teamId, type BattleConfig, type TeamId } from '@engine/index.ts';
import { trainingFieldBattle } from '@content/battles/training-field-battle.ts';
import type { CampaignNode } from './graph.ts';
import { firstBattleBeat } from './sequence.ts';

// The minimal shape a stat/vitals probe needs.
export interface VitalsProbeBattle {
  readonly template: BattleConfig;
  readonly playerTeam: TeamId;
}

// The canonical probe field: the Training Field (a stable content constant,
// deliberately independent of campaign-graph authoring — the graph's start
// node no longer has to carry a battle beat).
export const CANONICAL_PROBE_BATTLE: VitalsProbeBattle = {
  template: trainingFieldBattle,
  playerTeam: teamId('team_a'),
};

// The probe battlefield for work AT a node: its own first battle beat when
// it has one, the canonical field otherwise (the market-town case).
export function probeBattleFor(node: CampaignNode): VitalsProbeBattle {
  const beat = firstBattleBeat(node.beats);
  if (beat === undefined) return CANONICAL_PROBE_BATTLE;
  return { template: beat.battle.template, playerTeam: beat.battle.playerTeam };
}

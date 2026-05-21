// Deployment → battle-config bridge.
//
// Session 35 (Phase E). The deployment phase is engine-blind: it
// produces a `DeploymentResult` (the player's chosen positions +
// facings for one team), and this module folds that result into the
// authored `BattleConfig` template, replacing that team's authored
// placements while leaving every other team's authored placements
// intact.
//
// The output is an ordinary `BattleConfig` — `createInitialState`
// consumes it unchanged, and the orchestrator's pre-battle phase
// (`enumeratePreBattleActions` / `runPreBattlePhase`) runs as it always
// has. The engine never learns that a deployment phase happened; per
// the Session 35 audit, deployment is strictly upstream of
// `createInitialState`.
//
// Team-parameterized by design: `result.team` decides which units get
// re-placed. This session only ever deploys Blue, but the future
// pass-and-play extension folds in a second `DeploymentResult` for Red
// by calling `buildDeployedBattleConfig` again on the already-folded
// config — no special-casing needed.

import { createInitialState, type BattleConfig, type Catalog, type TeamId, type UnitId } from '@engine/index.ts';
import { planAiDeployment } from '@ai/index.ts';
import type { DeploymentPlacement } from '@ui/index.ts';

export interface DeploymentResult {
  // Whose placements these are. Only units on this team are re-placed.
  readonly team: BattleConfig['teams'][number]['id'];
  // unitId → chosen position + facing. Must cover every unit on `team`
  // in the template (the "Start Battle" affordance gates on this).
  readonly placements: ReadonlyMap<UnitId, DeploymentPlacement>;
}

// Fold a `DeploymentResult` into a `BattleConfig` template. Units on
// `result.team` take their position + facing from the result; all other
// units keep their authored placement. Throws if a unit on the deployed
// team has no placement in the result — an incomplete deployment is a
// programmer error here (the UI gates commit on completeness), and a
// silent fallback to the authored position would hide the bug.
export function buildDeployedBattleConfig(
  template: BattleConfig,
  result: DeploymentResult,
): BattleConfig {
  const units = template.units.map((placement) => {
    if (placement.team !== result.team) return placement;
    const deployed = result.placements.get(placement.id);
    if (deployed === undefined) {
      throw new Error(
        `buildDeployedBattleConfig: unit ${JSON.stringify(placement.id)} ` +
          `on deployed team ${JSON.stringify(result.team)} has no placement ` +
          `in the deployment result`,
      );
    }
    return {
      ...placement,
      position: deployed.position,
      facing: deployed.facing,
    };
  });

  return { ...template, units };
}

// Compute an AI-controlled team's deployment via the heuristic (S43),
// shaped as a `DeploymentResult` so it folds through the same
// `buildDeployedBattleConfig` path human deployments use. Reads each
// unit's maxHP from a fresh initial state (at battle start `vitals.hp`
// equals the computed effective max) — the heuristic's sort key.
//
// A `unplaced` non-empty result means the map's zone is smaller than the
// team; this is a content-authoring problem, surfaced as a console
// warning here (the boundary where I/O is acceptable — `planAiDeployment`
// itself stays pure).
export function computeAiDeploymentResult(
  config: BattleConfig,
  catalog: Catalog,
  team: TeamId,
): DeploymentResult {
  const state = createInitialState(config, catalog);
  const units = [...state.units.values()]
    .filter((u) => u.team === team)
    .map((u) => ({
      id: u.id,
      maxHP: u.vitals.hp,
      classId: u.classState.currentClass,
    }));
  const { placements, unplaced } = planAiDeployment({ map: config.map, team, units });
  if (unplaced.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `computeAiDeploymentResult: ${unplaced.length} unit(s) on team ` +
        `${JSON.stringify(team)} could not be placed — deployment zone is ` +
        `smaller than the team. Unplaced: ${unplaced.map(String).join(', ')}`,
    );
  }
  return { team, placements };
}

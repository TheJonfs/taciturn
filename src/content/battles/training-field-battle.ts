// Training Field battle — the playable battle config the React/Pixi
// shell loads at runtime in the Phase A battle UI (Session 22+).
//
// This is a derived config: it shares the 6 demo units (identities,
// loadouts, equipment, base stats, vitals, masterSeed) with `demoBattle`
// but stages them on the 14×14 Training Field instead of the legacy 6×6
// flat-ground board the engine tests still use.
//
// Why a separate file rather than mutating `demoBattle`? Two tests
// (`src/app/demo/orchestrator.test.ts` and `src/app/controllers/
// ai-controller.integration.test.ts`) consume `demoBattle` for their
// AI-vs-greedy / termination smoke checks. Those tests aren't shape-
// dependent but they ARE behaviorally calibrated to the 6×6 board:
// switching the underlying map could perturb the AI-vs-greedy delta.
// Keeping `demoBattle` stable for tests and pointing the runtime
// `BattleView` at this new config is the lowest-risk path.
//
// The unit roster is intentionally preserved verbatim — same six demo
// units with the same loadouts and stats, restaged in left/right
// triangle formations facing each other across the field. When demo
// content evolves (e.g., a future session swaps a class), this config
// inherits that change automatically through the spread.
//
// Loader-interface stability: per the Session 22 brief's deferred-
// wiring note, this is the shape that team-builder (Sessions 36-37)
// will eventually emit. The runtime can keep loading `BattleConfig`
// objects through the same surface; the producer changes from
// hand-authored content to team-builder output later.

import type { BattleConfig, Position, UnitId } from '@engine/index.ts';
import { unitId } from '@engine/index.ts';
import { trainingField } from '../maps/training-field.ts';
import { demoBattle } from './demo.ts';

// Starting positions on the 14×14 Training Field. Blue (team_a) on the
// west side facing east, Red (team_b) on the east side facing west.
// Triangle layout: front-line in the middle column, back ranks flanking.
// The mid-board gap (~7 tiles) gives both sides a "feel-out" turn or
// two before contact — natural for a battle whose AI uses approach
// scoring rather than instant alpha strikes.
const STARTING_POSITIONS: ReadonlyMap<UnitId, Position> = new Map([
  // Blue / team_a — west deployment.
  [unitId('blue_knight_n'), { x: 3, y: 7, layer: 0 }],
  [unitId('blue_water_mage'), { x: 1, y: 5, layer: 0 }],
  [unitId('blue_lightning_mage'), { x: 1, y: 9, layer: 0 }],
  // Red / team_b — east deployment.
  [unitId('red_earth_mage'), { x: 12, y: 5, layer: 0 }],
  [unitId('red_lightning_mage'), { x: 12, y: 9, layer: 0 }],
  [unitId('red_fire_mage'), { x: 10, y: 7, layer: 0 }],
]);

export const trainingFieldBattle: BattleConfig = {
  ...demoBattle,
  battleId: 'training_field_v1',
  map: trainingField,
  units: demoBattle.units.map((u) => {
    const next = STARTING_POSITIONS.get(u.id);
    return next === undefined ? u : { ...u, position: next };
  }),
};

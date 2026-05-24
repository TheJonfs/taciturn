// Team builder integration — the Session 36 output contract end to end.
//
// Two halves:
//   1. The screen: render `TeamBuilderScreen`, load a default template,
//      confirm "Continue to Deployment" enables and hands back a valid
//      `BuiltTeam`.
//   2. The data path: that `BuiltTeam` flows through
//      `buildTeamBattleConfig` → `buildDeployedBattleConfig` →
//      `createInitialState` → `runPreBattlePhase` without throwing —
//      the full Team Builder → Deployment → Battle pipeline.
//
// The deployment phase and battle themselves mount Pixi (not headless-
// friendly); this test covers the team builder (pure DOM) plus the
// engine-side config pipeline those screens drive.

import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { loadDefaultCatalog } from '@content/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import {
  buildTeamBattleConfig,
  gravityWell,
  type BuiltTeam,
} from '@content/teams/index.ts';
import {
  createInitialState,
  runPreBattlePhase,
  teamId,
} from '@engine/index.ts';
import {
  buildDeployedBattleConfig,
  type DeploymentResult,
} from './deployment-config.ts';
import { TeamBuilderScreen } from './TeamBuilderScreen.tsx';

const catalog = loadDefaultCatalog();
const BLUE = teamId('team_a');

describe('TeamBuilderScreen — load default and continue', () => {
  it('loads a default template and hands a valid BuiltTeam to onContinue', () => {
    const onContinue = vi.fn<(team: BuiltTeam) => void>();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TeamBuilderScreen
          onContinue={onContinue}
          onBack={vi.fn()}
          teamLabel="Team A (Blue)"
          control="human"
          continueLabel="Continue to Deployment"
        />,
      );
    });

    // The only <select> on a fresh (all-classless) screen is the
    // "Load Default" dropdown — the equipment dropdowns appear only once
    // a unit has a class.
    const loader = container.querySelector('select');
    expect(loader).not.toBeNull();

    act(() => {
      loader!.value = 'gravity-well';
      loader!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const continueButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Continue to Deployment'),
    );
    expect(continueButton).toBeDefined();
    // A loaded valid template clears the validity gate.
    expect(continueButton!.disabled).toBe(false);

    act(() => continueButton!.click());

    expect(onContinue).toHaveBeenCalledTimes(1);
    const team = onContinue.mock.calls[0]![0];
    // S48: the loaded Gravity Well template is a 4-unit BuiltTeam;
    // loading it into the (now 5-slot) builder pads with one empty
    // slot, and the empty slot is filtered out on export. So the team
    // coming through the Continue gate has the template's original 4
    // units.
    expect(team.units).toHaveLength(gravityWell.units.length);
    expect(team.units.map((u) => String(u.classId))).toEqual(
      gravityWell.units.map((u) => String(u.classId)),
    );

    act(() => root.unmount());
    container.remove();
  });
});

describe('team builder output → deployment → battle pipeline', () => {
  it('a BuiltTeam folds through to a running battle config', () => {
    // 1. Team builder output → map config (team_a built, team_b authored).
    const teamConfig = buildTeamBattleConfig(
      riverRidgeBattle,
      gravityWell,
      BLUE,
    );
    expect(teamConfig.units.filter((u) => u.team === BLUE)).toHaveLength(
      gravityWell.units.length,
    );

    // 2. Deployment phase output — place each Blue unit (here, at the
    //    placeholder positions; the real screen lets the player choose).
    const blueUnits = teamConfig.units.filter((u) => u.team === BLUE);
    const result: DeploymentResult = {
      team: BLUE,
      placements: new Map(
        blueUnits.map((u) => [
          u.id,
          { position: u.position, facing: u.facing },
        ]),
      ),
    };
    const deployed = buildDeployedBattleConfig(teamConfig, result);

    // 3. Engine consumes it unchanged — createInitialState +
    //    pre-battle phase both succeed.
    const initial = createInitialState(deployed, catalog);
    // S48: 4-unit Gravity Well + 5-unit Red template = 9 total. The
    // trailing Blue template slot (blue_earth_mage) is dropped when
    // the built team is shorter than the template.
    const expectedSize =
      gravityWell.units.length +
      riverRidgeBattle.units.filter((u) => u.team !== BLUE).length;
    expect(initial.units.size).toBe(expectedSize);
    const postPreBattle = runPreBattlePhase(initial, deployed, catalog);
    expect(postPreBattle.units.size).toBe(expectedSize);
  });
});

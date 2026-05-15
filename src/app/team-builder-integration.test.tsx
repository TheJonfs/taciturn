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
  currentTestTeam,
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
        <TeamBuilderScreen onContinue={onContinue} onBack={vi.fn()} />,
      );
    });

    // The only <select> on a fresh (all-classless) screen is the
    // "Load Default" dropdown — the equipment dropdowns appear only once
    // a unit has a class.
    const loader = container.querySelector('select');
    expect(loader).not.toBeNull();

    act(() => {
      loader!.value = 'current-test-team';
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
    expect(team.units).toHaveLength(4);
    expect(team.units.map((u) => String(u.classId))).toEqual(
      currentTestTeam.units.map((u) => String(u.classId)),
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
      currentTestTeam,
      BLUE,
    );
    expect(teamConfig.units.filter((u) => u.team === BLUE)).toHaveLength(4);

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
    expect(initial.units.size).toBe(8);
    const postPreBattle = runPreBattlePhase(initial, deployed, catalog);
    expect(postPreBattle.units.size).toBe(8);
  });
});

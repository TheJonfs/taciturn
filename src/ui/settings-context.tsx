// Settings context — in-memory user preferences for the battle UI.
//
// Per `docs/twentyOneDesign/battle-ui-architecture.md` §"Settings Menu",
// v1 settings are:
//   - Default animation speed (1× / 2×)
//   - Confirm-step preference (confirm-by-default / skip-confirm)
//   - Status icon density preference (standard / minimal)
//
// Persistence: in-memory only for first playable; settings revert to
// defaults on app reload. localStorage persistence is a future feature.
//
// Active wires (Session 23):
//   - animationSpeed → animator tween-duration multiplier (renderer).
//   - confirmStep → gates whether target-select transitions through an
//     `await-confirm` state before commit (turn-flow state machine).
//
// Wired-but-not-yet-effective (Session 23 placeholders):
//   - statusIconDensity → renderer reads this in Session 24 once the
//     "minimal composite indicator" alternative ships.

import { createContext, useContext, useMemo, useState, type ReactElement, type ReactNode } from 'react';

export type AnimationSpeed = '1x' | '2x';
export type ConfirmStepPreference = 'confirm' | 'skip';
export type StatusIconDensity = 'standard' | 'minimal';

export interface Settings {
  readonly animationSpeed: AnimationSpeed;
  readonly confirmStep: ConfirmStepPreference;
  readonly statusIconDensity: StatusIconDensity;
  // Active-team signaling (S43). Three complementary cues that make it
  // unmistakable whose turn it is — especially for pass-and-play. Each
  // toggles independently so a playtester can keep the combination that
  // reads best and switch off the rest. All default on.
  //   - banner:        persistent strip below the terrain bar, in team color.
  //   - menuHighlight:  team-color glow on the active-unit action menu.
  //   - transitionAlert: brief fading "<Team>'s turn" on each handoff.
  readonly activeTeamBanner: boolean;
  readonly activeTeamMenuHighlight: boolean;
  readonly turnTransitionAlert: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  animationSpeed: '1x',
  confirmStep: 'confirm', // design doc's confirm-by-default
  statusIconDensity: 'standard',
  activeTeamBanner: true,
  activeTeamMenuHighlight: true,
  turnTransitionAlert: true,
};

export interface SettingsApi {
  readonly settings: Settings;
  setAnimationSpeed(value: AnimationSpeed): void;
  setConfirmStep(value: ConfirmStepPreference): void;
  setStatusIconDensity(value: StatusIconDensity): void;
  setActiveTeamBanner(value: boolean): void;
  setActiveTeamMenuHighlight(value: boolean): void;
  setTurnTransitionAlert(value: boolean): void;
}

const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { readonly children: ReactNode }): ReactElement {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const api = useMemo<SettingsApi>(
    () => ({
      settings,
      setAnimationSpeed: (value) => setSettings((s) => ({ ...s, animationSpeed: value })),
      setConfirmStep: (value) => setSettings((s) => ({ ...s, confirmStep: value })),
      setStatusIconDensity: (value) => setSettings((s) => ({ ...s, statusIconDensity: value })),
      setActiveTeamBanner: (value) => setSettings((s) => ({ ...s, activeTeamBanner: value })),
      setActiveTeamMenuHighlight: (value) =>
        setSettings((s) => ({ ...s, activeTeamMenuHighlight: value })),
      setTurnTransitionAlert: (value) =>
        setSettings((s) => ({ ...s, turnTransitionAlert: value })),
    }),
    [settings],
  );
  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (ctx === null) {
    throw new Error('useSettings: must be used within a <SettingsProvider>');
  }
  return ctx;
}

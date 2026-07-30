// useEscapeBack — ESC as the universal "back one level" key (S100).
//
// The Ch1 iteration audit found ESC inconsistent across menus: the battle
// flow cancels (BattleView + `escCancelsFrom`), the deployment screen owns
// its own two-stage ESC, the detail panels close — but the campaign's
// screen-level menus (Shop, Recruit, Manage Roster) bound nothing, so ESC
// silently died there. This hook is the screen-level binding: one listener,
// bubble-phase (the capture-phase panel/picker handlers keep winning when
// they're open above a screen), preventDefault so the browser doesn't act.
//
// Pass `enabled: false` (or a null handler) to release the binding — e.g.
// while a child surface with its own ESC semantics is mounted.

import { useEffect } from 'react';

export function useEscapeBack(onBack: (() => void) | null): void {
  useEffect(() => {
    if (onBack === null) return undefined;
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onBack();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onBack]);
}

// DeploymentFacingPicker — the keyboard half of the facing picker
// (Session 35 / Phase E). The on-canvas cardinal arrows (the mouse
// surface) are drawn by the renderer's `DeploymentFacingLayer`; this
// component is the keyboard parallel plus a small on-screen hint.
//
// Active only while the deployment flow is in `unit_selected`: it
// installs a window `keydown` listener mapping the arrow keys to a
// facing commit. Escape is intentionally NOT handled here — the
// `DeploymentScreen` owns Escape (cancel-selection vs. back-to-setup)
// so there's a single owner, mirroring `BattleView`'s ESC handler.

import { useEffect, type CSSProperties, type ReactElement } from 'react';
import type { Direction } from '@engine/index.ts';
import type { DeploymentFlow } from './use-deployment-flow.ts';

export interface DeploymentFacingPickerProps {
  readonly flow: DeploymentFlow;
}

const ARROW_KEY_FACING: Readonly<Record<string, Direction>> = {
  ArrowUp: 'N',
  ArrowDown: 'S',
  ArrowLeft: 'W',
  ArrowRight: 'E',
};

export function DeploymentFacingPicker({
  flow,
}: DeploymentFacingPickerProps): ReactElement | null {
  const active = flow.state.phase.kind === 'unit_selected';

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      const facing = ARROW_KEY_FACING[e.key];
      if (facing === undefined) return;
      e.preventDefault();
      flow.pickFacing(facing);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, flow]);

  if (!active) return null;

  return (
    <div style={hintStyle}>
      Pick a facing — <kbd style={kbdStyle}>↑</kbd>
      <kbd style={kbdStyle}>↓</kbd>
      <kbd style={kbdStyle}>←</kbd>
      <kbd style={kbdStyle}>→</kbd> or click an arrow on the map
      <span style={escHintStyle}>• Esc to cancel</span>
    </div>
  );
}

const hintStyle: CSSProperties = {
  position: 'absolute',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '8px 16px',
  background: 'rgba(20, 22, 27, 0.96)',
  border: '1px solid #2c2f36',
  borderRadius: 8,
  fontSize: 12,
  color: '#e7e9ee',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
  zIndex: 6,
};

const kbdStyle: CSSProperties = {
  display: 'inline-block',
  minWidth: 16,
  padding: '1px 4px',
  background: '#2a3140',
  border: '1px solid #3a4150',
  borderRadius: 3,
  fontSize: 11,
  textAlign: 'center',
};

const escHintStyle: CSSProperties = {
  marginLeft: 8,
  opacity: 0.6,
};

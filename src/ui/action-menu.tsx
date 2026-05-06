// ActionMenu — Move / Attack / Cure / Wait buttons for the active unit.
//
// Buttons are gated on:
//   - `waiting`: engine is busy (animations playing or scheduler
//     advancing) — entire menu is disabled.
//   - `isOurTurn`: the active unit belongs to a non-UI team — menu is
//     hidden.
//   - per-button budget checks: Move requires movesAvailable > 0,
//     Attack and Cure require actsAvailable > 0.
//   - per-ability availability: Cure only renders if the active unit
//     has it equipped (`hasCure`).
//
// While the user is in a sub-mode (`picking-move` / `picking-attack` /
// `picking-cure`) the corresponding button reads as the "active" one,
// and a Cancel button appears to back out without committing.
//
// v1 only — Attack and Cure are each hardcoded against their ability
// id. The full FFT-style command menu (read class.firstActionCommandSet,
// list each ability) lands during the class/ability content-expansion
// pass.

import type { CSSProperties, ReactElement } from 'react';
import type { TurnState } from '@engine/index.ts';
import type { UiMode } from './use-battle-ui.ts';

export interface ActionMenuProps {
  readonly mode: UiMode;
  readonly isOurTurn: boolean;
  readonly waiting: boolean;
  readonly turnState: TurnState;
  readonly hasCure: boolean;
  readonly onMove: () => void;
  readonly onAttack: () => void;
  readonly onCure: () => void;
  readonly onWait: () => void;
  readonly onCancel: () => void;
}

export function ActionMenu(props: ActionMenuProps): ReactElement {
  const {
    mode,
    isOurTurn,
    waiting,
    turnState,
    hasCure,
    onMove,
    onAttack,
    onCure,
    onWait,
    onCancel,
  } = props;

  const movesAvail = turnState?.budget.movesAvailable ?? 0;
  const actsAvail = turnState?.budget.actsAvailable ?? 0;

  const inSubMode = mode.kind !== 'idle';
  const baseDisabled = !isOurTurn || waiting || inSubMode;

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>Actions</div>
      <Button
        label={`Move (${movesAvail})`}
        onClick={onMove}
        disabled={baseDisabled || movesAvail <= 0}
        active={mode.kind === 'picking-move'}
      />
      <Button
        label={`Attack (${actsAvail})`}
        onClick={onAttack}
        disabled={baseDisabled || actsAvail <= 0}
        active={mode.kind === 'picking-attack'}
      />
      {hasCure && (
        <Button
          label={`Cure (${actsAvail})`}
          onClick={onCure}
          disabled={baseDisabled || actsAvail <= 0}
          active={mode.kind === 'picking-cure'}
        />
      )}
      <Button
        label="Wait"
        onClick={onWait}
        disabled={!isOurTurn || waiting || inSubMode}
      />
      {inSubMode && (
        <Button label="Cancel" onClick={onCancel} disabled={false} variant="secondary" />
      )}
      {!isOurTurn && (
        <div style={statusLineStyle}>Opponent&apos;s turn</div>
      )}
      {isOurTurn && waiting && (
        <div style={statusLineStyle}>Resolving…</div>
      )}
      {isOurTurn && !waiting && mode.kind === 'picking-move' && (
        <div style={statusLineStyle}>Click a blue tile to move</div>
      )}
      {isOurTurn && !waiting && mode.kind === 'picking-attack' && (
        <div style={statusLineStyle}>Click a red tile to attack</div>
      )}
      {isOurTurn && !waiting && mode.kind === 'picking-cure' && (
        <div style={statusLineStyle}>Click a green tile to heal</div>
      )}
    </div>
  );
}

function Button(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled: boolean;
  readonly active?: boolean;
  readonly variant?: 'primary' | 'secondary';
}): ReactElement {
  const { label, onClick, disabled, active, variant } = props;
  const style: CSSProperties = {
    ...buttonBaseStyle,
    ...(variant === 'secondary' ? buttonSecondaryStyle : buttonPrimaryStyle),
    ...(active ? buttonActiveStyle : null),
    ...(disabled ? buttonDisabledStyle : null),
  };
  return (
    <button type="button" style={style} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 12,
  background: '#1c1e23',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 8,
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  minWidth: 200,
};

const panelHeaderStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.65,
  marginBottom: 2,
};

const buttonBaseStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 14,
  fontFamily: 'inherit',
  transition: 'background 80ms, border-color 80ms',
};

const buttonPrimaryStyle: CSSProperties = {
  background: '#2a3140',
  color: '#e7e9ee',
};

const buttonSecondaryStyle: CSSProperties = {
  background: '#26282d',
  color: '#bcc1cb',
};

const buttonActiveStyle: CSSProperties = {
  borderColor: '#f6e5a8',
  background: '#3a3a30',
};

const buttonDisabledStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

const statusLineStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  marginTop: 4,
};

// BattleSetupScreen — the "choose what to do next" surface (Session 34).
//
// Ultra-minimal in v1 (Chris's call): a single battle, one button to
// start it. No placeholder UI for the team-builder / map-selection
// features that Sessions 35-37 add — visible stubs before they're
// functional only invite confusion. When those ship, they slot into
// this screen.

import type { CSSProperties, ReactElement } from 'react';

export interface BattleSetupScreenProps {
  readonly onStart: () => void;
  readonly onBack: () => void;
}

export function BattleSetupScreen({
  onStart,
  onBack,
}: BattleSetupScreenProps): ReactElement {
  return (
    <div style={rootStyle}>
      <div style={cardStyle}>
        <div style={eyebrowStyle}>Battle</div>
        <div style={battleNameStyle}>River Ridge</div>
        <div style={buttonRowStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={onBack}>
            Back
          </button>
          <button type="button" style={primaryButtonStyle} onClick={onStart}>
            Start River Ridge
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- styles ----

const rootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 28,
  minWidth: 320,
  background: 'rgba(28, 30, 35, 0.98)',
  border: '1px solid #2c2f36',
  borderRadius: 10,
  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.6,
};

const battleNameStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: '#f6e5a8',
  marginBottom: 14,
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
};

const buttonBaseStyle: CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#2a3140',
  color: '#e7e9ee',
  borderColor: '#3a4150',
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#1c1e23',
  color: '#b9bcc4',
  borderColor: '#2c2f36',
};

// BattleSetupScreen — the "choose what to do next" surface (Session 34).
//
// Session 43 (unified team architecture): the screen now also picks each
// team's controller (Human / AI) up front. The choice lives here rather
// than inside the team builder (the S43 brief's D7 first guess) because
// the setup flow must know each team's control *before* building — it
// drives which teams get a manual deployment phase, where pass-and-play
// handoff prompts appear, and how the battle-loop wires controllers.
// Default: Team A human, Team B AI (the classic single-player flow). Both
// human → pass-and-play; both AI → AI-vs-AI balance testing.

import type { CSSProperties, ReactElement } from 'react';
import type { TeamControl } from '@engine/index.ts';

export interface BattleSetupScreenProps {
  // [Team A, Team B] control flags.
  readonly controls: readonly [TeamControl, TeamControl];
  readonly onControlsChange: (controls: readonly [TeamControl, TeamControl]) => void;
  readonly onStart: () => void;
  readonly onBack: () => void;
}

export function BattleSetupScreen({
  controls,
  onControlsChange,
  onStart,
  onBack,
}: BattleSetupScreenProps): ReactElement {
  const setControl = (slot: 0 | 1, value: TeamControl): void => {
    const next: [TeamControl, TeamControl] = [controls[0], controls[1]];
    next[slot] = value;
    onControlsChange(next);
  };

  return (
    <div style={rootStyle}>
      <div style={cardStyle}>
        <div style={eyebrowStyle}>Battle</div>
        <div style={battleNameStyle}>River Ridge</div>

        <div style={teamsRowStyle}>
          <ControlPicker
            label="Team A (Blue)"
            value={controls[0]}
            onChange={(v) => setControl(0, v)}
          />
          <ControlPicker
            label="Team B (Red)"
            value={controls[1]}
            onChange={(v) => setControl(1, v)}
          />
        </div>
        <div style={modeHintStyle}>{modeHint(controls)}</div>

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

function modeHint(controls: readonly [TeamControl, TeamControl]): string {
  const humans = controls.filter((c) => c === 'human').length;
  if (humans === 2) return 'Pass-and-play — both teams human.';
  if (humans === 0) return 'AI vs. AI — watch the battle play out.';
  return 'Single-player — you against the AI.';
}

function ControlPicker({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: TeamControl;
  readonly onChange: (value: TeamControl) => void;
}): ReactElement {
  return (
    <div style={pickerStyle}>
      <div style={pickerLabelStyle}>{label}</div>
      <div style={segmentRowStyle} role="group" aria-label={label}>
        <button
          type="button"
          aria-pressed={value === 'human'}
          style={{ ...segmentStyle, ...(value === 'human' ? segmentActiveStyle : {}) }}
          onClick={() => onChange('human')}
        >
          Human
        </button>
        <button
          type="button"
          aria-pressed={value === 'ai'}
          style={{ ...segmentStyle, ...(value === 'ai' ? segmentActiveStyle : {}) }}
          onClick={() => onChange('ai')}
        >
          AI
        </button>
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
  minWidth: 360,
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

const teamsRowStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
  marginBottom: 4,
};

const pickerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  flex: 1,
};

const pickerLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#cfd2da',
};

const segmentRowStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
};

const segmentStyle: CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  fontSize: 12,
  borderRadius: 4,
  border: '1px solid #2c2f36',
  background: '#1c1e23',
  color: '#b9bcc4',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const segmentActiveStyle: CSSProperties = {
  background: '#2a3140',
  color: '#e7e9ee',
  borderColor: '#3a4150',
};

const modeHintStyle: CSSProperties = {
  fontSize: 11,
  color: '#8a8f99',
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

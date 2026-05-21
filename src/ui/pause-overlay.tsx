// PauseOverlay — modal pause UI per
// `docs/twentyOneDesign/battle-ui-architecture.md` §"Battle-Pause /
// Out-of-Turn UI".
//
// Triggered when ESC is pressed during a battle (BattleView owns the
// keyboard handler). While paused:
//   - The renderer's animator is halted via `BattleRenderer.setPaused`.
//   - The orchestrator pump is short-circuited so no new actions
//     resolve and the AI doesn't act.
//   - The map and HUD remain visible behind a translucent backdrop.
//
// Options (per Session 23's brief; pause-overlay-scope ADR captures the
// brief-vs-design-doc divergence — Surrender and Main Menu are deferred
// to Session 34 alongside the title screen):
//   - Resume         (active)
//   - Settings       (active — inline expand inside this overlay)
//   - Main Menu      (disabled — wired in Session 34)
//
// Settings inline expansion keeps the pause/settings flow in one
// surface for v1; a separate settings overlay can split off later.

import { useState, type CSSProperties, type ReactElement } from 'react';
import {
  useSettings,
  type AnimationSpeed,
  type ConfirmStepPreference,
  type StatusIconDensity,
} from './settings-context.tsx';

export interface PauseOverlayProps {
  readonly onResume: () => void;
}

export function PauseOverlay({ onResume }: PauseOverlayProps): ReactElement {
  const [view, setView] = useState<'menu' | 'settings'>('menu');

  return (
    <div style={backdropStyle} role="dialog" aria-label="Paused">
      <div style={modalStyle}>
        <div style={titleStyle}>Paused</div>
        {view === 'menu' ? (
          <MenuButtons onResume={onResume} onOpenSettings={() => setView('settings')} />
        ) : (
          <SettingsBody onBack={() => setView('menu')} />
        )}
      </div>
    </div>
  );
}

function MenuButtons(props: {
  readonly onResume: () => void;
  readonly onOpenSettings: () => void;
}): ReactElement {
  return (
    <div style={buttonColStyle}>
      <BigButton label="Resume" onClick={props.onResume} />
      <BigButton label="Settings" onClick={props.onOpenSettings} />
      <BigButton
        label="Main Menu"
        onClick={noop}
        disabled
        title="Available after Session 34's title screen"
      />
    </div>
  );
}

function SettingsBody({ onBack }: { readonly onBack: () => void }): ReactElement {
  const api = useSettings();
  return (
    <div style={settingsStyle}>
      <Row label="Animation speed">
        <Choice<AnimationSpeed>
          value={api.settings.animationSpeed}
          options={[
            { value: '1x', label: '1×' },
            { value: '2x', label: '2×' },
          ]}
          onChange={api.setAnimationSpeed}
        />
      </Row>
      <Row label="Confirm step">
        <Choice<ConfirmStepPreference>
          value={api.settings.confirmStep}
          options={[
            { value: 'confirm', label: 'Confirm' },
            { value: 'skip', label: 'Skip' },
          ]}
          onChange={api.setConfirmStep}
        />
      </Row>
      <Row label="Status icons">
        <Choice<StatusIconDensity>
          value={api.settings.statusIconDensity}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'minimal', label: 'Minimal' },
          ]}
          onChange={api.setStatusIconDensity}
        />
      </Row>
      <div style={settingsSectionLabelStyle}>Active-team signals</div>
      <Row label="Team banner">
        <OnOff value={api.settings.activeTeamBanner} onChange={api.setActiveTeamBanner} />
      </Row>
      <Row label="Menu highlight">
        <OnOff
          value={api.settings.activeTeamMenuHighlight}
          onChange={api.setActiveTeamMenuHighlight}
        />
      </Row>
      <Row label="Turn alert">
        <OnOff value={api.settings.turnTransitionAlert} onChange={api.setTurnTransitionAlert} />
      </Row>
      <div style={settingsHintStyle}>
        Settings reset on reload; persistence is a future feature.
      </div>
      <BigButton label="Back" onClick={onBack} />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): ReactElement {
  return (
    <div style={rowStyle}>
      <span style={rowLabelStyle}>{label}</span>
      <div style={rowChoiceStyle}>{children}</div>
    </div>
  );
}

interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

function Choice<T extends string>(props: {
  readonly value: T;
  readonly options: ReadonlyArray<Option<T>>;
  readonly onChange: (value: T) => void;
}): ReactElement {
  const { value, options, onChange } = props;
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            style={{
              ...choiceButtonStyle,
              ...(active ? choiceButtonActiveStyle : null),
            }}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function OnOff(props: {
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}): ReactElement {
  return (
    <Choice<'on' | 'off'>
      value={props.value ? 'on' : 'off'}
      options={[
        { value: 'on', label: 'On' },
        { value: 'off', label: 'Off' },
      ]}
      onChange={(v) => props.onChange(v === 'on')}
    />
  );
}

function BigButton(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly title?: string;
}): ReactElement {
  const { label, onClick, disabled = false, title } = props;
  return (
    <button
      type="button"
      style={{
        ...bigButtonStyle,
        ...(disabled ? bigButtonDisabledStyle : null),
      }}
      onClick={disabled ? noop : onClick}
      disabled={disabled}
      title={title}
    >
      {label}
    </button>
  );
}

const noop = (): void => {};

// ---- styles ----

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(0, 0, 0, 0.55)',
  zIndex: 100,
  pointerEvents: 'auto',
};

const modalStyle: CSSProperties = {
  minWidth: 360,
  maxWidth: 480,
  padding: '24px 28px',
  background: '#1c1e23',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 12,
  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const titleStyle: CSSProperties = {
  fontSize: 20,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  opacity: 0.9,
  textAlign: 'center',
};

const buttonColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const settingsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
};

const rowLabelStyle: CSSProperties = {
  fontSize: 13,
  opacity: 0.85,
};

const rowChoiceStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
};

const settingsHintStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
  fontStyle: 'italic',
};

const settingsSectionLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.5,
  marginTop: 4,
  borderTop: '1px solid #2c2f36',
  paddingTop: 10,
};

const choiceButtonStyle: CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  background: '#2a3140',
  color: '#e7e9ee',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const choiceButtonActiveStyle: CSSProperties = {
  borderColor: '#f6e5a8',
  background: '#3a3a30',
};

const bigButtonStyle: CSSProperties = {
  padding: '10px 16px',
  fontSize: 14,
  background: '#2a3140',
  color: '#e7e9ee',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'center',
  transition: 'background 80ms, border-color 80ms',
};

const bigButtonDisabledStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

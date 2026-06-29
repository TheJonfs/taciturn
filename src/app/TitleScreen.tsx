// TitleScreen — the application's entry surface (Session 34, Phase E).
//
// Chris's splash image fills the viewport; a menu column sits over it.
// Per the roadmap the full menu is shown — New Battle / Continue /
// Settings / Quit — but only New Battle is functional in v1; the rest
// are disabled-with-tooltip placeholders until their features land.
//
// Input parity: the New Battle action is reachable by click or by
// Enter/Space, so keyboard players need no mouse to start.

import { useEffect, type CSSProperties, type ReactElement } from 'react';
import splashUrl from '../assets/title/splash.png';

export interface TitleScreenProps {
  readonly onStart: () => void;
  // TABA campaign entries (ADR-0133). `onResumeCampaign` is undefined when
  // no autosave exists, which disables the Resume button.
  readonly onNewCampaign: () => void;
  readonly onResumeCampaign?: (() => void) | undefined;
}

export function TitleScreen({
  onStart,
  onNewCampaign,
  onResumeCampaign,
}: TitleScreenProps): ReactElement {
  // Enter / Space start the game — parallel to the New Battle button.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onStart]);

  return (
    <div style={rootStyle}>
      <div style={menuStyle}>
        <button type="button" style={primaryButtonStyle} onClick={onStart}>
          New Battle
        </button>
        <button type="button" style={primaryButtonStyle} onClick={onNewCampaign}>
          New Campaign
        </button>
        <button
          type="button"
          style={onResumeCampaign !== undefined ? primaryButtonStyle : disabledButtonStyle}
          disabled={onResumeCampaign === undefined}
          title={onResumeCampaign !== undefined ? undefined : 'No saved campaign'}
          onClick={onResumeCampaign}
        >
          Resume Campaign
        </button>
        <button type="button" style={disabledButtonStyle} disabled title="Coming soon">
          Settings
        </button>
        <button type="button" style={disabledButtonStyle} disabled title="Coming soon">
          Quit
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
  flexDirection: 'column',
  justifyContent: 'flex-end',
  alignItems: 'center',
  paddingBottom: '8vh',
  background: `linear-gradient(rgba(14,15,18,0) 45%, rgba(14,15,18,0.85)), url(${splashUrl})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
};

const menuStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: 220,
};

const buttonBaseStyle: CSSProperties = {
  padding: '10px 16px',
  fontSize: 14,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  letterSpacing: '0.02em',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#2a3140',
  color: '#e7e9ee',
  borderColor: '#3a4150',
  cursor: 'pointer',
};

const disabledButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#1c1e23',
  color: '#888',
  borderColor: '#2c2f36',
  cursor: 'not-allowed',
  opacity: 0.55,
};

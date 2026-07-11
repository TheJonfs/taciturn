// LocationMenuBeatView — the re-entry menu for a cleared location (TABA M3
// economy Stage 1).
//
// Shown when the player travels to a node whose story beat is already cleared:
// whatever is CURRENTLY available there (skirmish now; shop/recruit join in
// Stages 2–3), never a replay of the cleared beat. Advancing carries the
// chosen `locationAction`; "Back to the map" advances with 'leave'.

import { type CSSProperties, type ReactElement } from 'react';
import type { LocationMenuBeat } from '@campaign/index.ts';
import type { BeatRendererProps } from './InterstitialRunner.tsx';

export function LocationMenuBeatView({ beat, onAdvance, onExitToTitle }: BeatRendererProps): ReactElement {
  if (beat.type !== 'location-menu') return <></>;
  const menu: LocationMenuBeat = beat;

  return (
    <div style={rootStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>{menu.nodeName}</h1>
            <div style={subtitleStyle}>
              {menu.options.length > 0
                ? 'The field here is quiet. What would you like to do?'
                : 'Nothing to do here right now.'}
            </div>
          </div>
          <div style={purseStyle} aria-label="Party gil">
            {menu.gil} gil
          </div>
        </div>

        <div style={bodyStyle}>
          {menu.options.map((opt) => (
            <button
              key={opt.action}
              type="button"
              style={optionStyle}
              onClick={() => onAdvance({ locationAction: opt.action })}
            >
              <span style={optionLabelStyle}>{opt.label}</span>
              {opt.detail !== undefined && <span style={optionDetailStyle}>{opt.detail}</span>}
            </button>
          ))}
        </div>

        <div style={footerStyle}>
          <button type="button" style={secondaryStyle} onClick={() => onAdvance({ locationAction: 'leave' })}>
            ← Back to the Map
          </button>
          <button type="button" style={secondaryStyle} onClick={onExitToTitle}>
            Quit to Title
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- styles (shared shape with the world-map panel) ----

const rootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0e0f12',
};

const panelStyle: CSSProperties = {
  width: 480,
  background: '#16181d',
  border: '1px solid #2c2f36',
  borderRadius: 8,
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #2c2f36',
};

const titleStyle: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 600 };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: 13, color: '#9aa0ac' };
const purseStyle: CSSProperties = { fontSize: 14, fontWeight: 600, color: '#d8b26c', whiteSpace: 'nowrap' };

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '18px 20px',
};

const optionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  padding: '12px 14px',
  fontSize: 14,
  fontFamily: 'inherit',
  textAlign: 'left',
  background: '#1d2330',
  color: '#e7e9ee',
  border: '1px solid #3a4150',
  borderRadius: 6,
  cursor: 'pointer',
};

const optionLabelStyle: CSSProperties = { fontWeight: 600 };
const optionDetailStyle: CSSProperties = { fontSize: 12, color: '#9aa0ac' };

const footerStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'space-between',
  padding: '14px 20px',
  borderTop: '1px solid #2c2f36',
};

const secondaryStyle: CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#1c1e23',
  color: '#c7ccd6',
  borderColor: '#2c2f36',
};

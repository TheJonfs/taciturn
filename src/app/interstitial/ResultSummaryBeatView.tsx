// ResultSummaryBeatView — the post-battle beat (TABA M1).
//
// ONE beat type renders all three post-battle states — between-node win,
// terminal-win victory, and defeat — as variants of a single screen, so the
// result path isn't forked into parallel screens (taba-m1-brief watch-for).
// Per-deployed-unit outcome lines surface survival / KO / permadeath.
//
//   win (non-terminal) → "Cleared", advance = Continue (→ world-map beat)
//   win (campaignComplete) → "Campaign Complete", advance = Return to Title
//   loss → "Defeat", advance = Retry; exit = Return to Title

import { type CSSProperties, type ReactElement } from 'react';
import type { ResultSummaryBeat, UnitResultLine } from '@campaign/index.ts';
import type { BeatRendererProps } from './InterstitialRunner.tsx';

export function ResultSummaryBeatView({
  beat,
  onAdvance,
  onExitToTitle,
}: BeatRendererProps): ReactElement {
  // Narrow the open beat union to this renderer's variant.
  if (beat.type !== 'result-summary') return <></>;
  const summary: ResultSummaryBeat = beat;

  const { resolution, nodeName, units, gilEarned, campaignComplete } = summary;
  const win = resolution === 'win';

  const title = campaignComplete ? 'Campaign Complete' : win ? `${nodeName} — Cleared` : 'Defeat';
  const accent = campaignComplete ? '#e0c87f' : win ? '#9fe0a8' : '#e09f9f';
  const body = campaignComplete
    ? 'Your company fought through every battle and made it there — and back again.'
    : win
      ? `The field at ${nodeName} is yours. Plan your next move.`
      : `Your company was routed at ${nodeName}. Retry from your last save, or return to the title.`;
  const advanceLabel = campaignComplete ? 'Return to Title' : win ? 'Continue →' : 'Retry Battle';

  return (
    <div style={rootStyle}>
      <div style={panelStyle}>
        <h1 style={{ ...titleStyle, color: accent }}>{title}</h1>
        <p style={bodyStyle}>{body}</p>

        {/* Spoils (M3 economy Stage 0): the gil the win paid. Suppressed on
            a loss (losses pay nothing) and on a zero award. */}
        {gilEarned > 0 && <p style={spoilsStyle}>Spoils: +{gilEarned} gil</p>}

        {units.length > 0 && (
          <ul style={listStyle}>
            {units.map((u) => (
              <UnitLine key={u.id} line={u} />
            ))}
          </ul>
        )}

        <div style={footerStyle}>
          {/* Loss keeps the M0 two-button shape (retry / abandon); win and
              victory advance with a single action. */}
          {!win && (
            <button type="button" style={secondaryStyle} onClick={onExitToTitle}>
              Return to Title
            </button>
          )}
          <button type="button" style={primaryStyle} onClick={() => onAdvance()}>
            {advanceLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnitLine({ line }: { readonly line: UnitResultLine }): ReactElement {
  const { label, color } = OUTCOME_BADGE[line.outcome];
  return (
    <li style={rowStyle}>
      <span style={nameStyle}>{line.name}</span>
      <span style={{ ...badgeStyle, color }}>{label}</span>
      <span style={vitalsStyle}>
        HP {line.vitals.hp} · MP {line.vitals.mp}
      </span>
    </li>
  );
}

const OUTCOME_BADGE: Record<UnitResultLine['outcome'], { label: string; color: string }> = {
  survived: { label: 'Survived', color: '#9fe0a8' },
  downed: { label: 'KO', color: '#e0c87f' },
  lost: { label: 'Lost', color: '#e09f9f' },
};

// ---- styles (shared shape with the M0 end screens) ----

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
  maxHeight: '86vh',
  display: 'flex',
  flexDirection: 'column',
  padding: '28px 32px',
  background: '#16181d',
  border: '1px solid #2c2f36',
  borderRadius: 8,
};

const titleStyle: CSSProperties = { margin: '0 0 12px', fontSize: 24, fontWeight: 700, textAlign: 'center' };
const bodyStyle: CSSProperties = {
  margin: '0 0 18px',
  fontSize: 14,
  lineHeight: 1.5,
  color: '#c7ccd6',
  textAlign: 'center',
};

// The spoils line rides the gold accent the dev/gil affordances share.
const spoilsStyle: CSSProperties = {
  margin: '-8px 0 18px',
  fontSize: 14,
  fontWeight: 600,
  color: '#d8b26c',
  textAlign: 'center',
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: '0 0 20px',
  padding: 0,
  overflowY: 'auto',
  borderTop: '1px solid #2c2f36',
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.6fr 0.8fr 1.4fr',
  alignItems: 'center',
  gap: 8,
  padding: '8px 4px',
  fontSize: 13,
  borderBottom: '1px solid #23262d',
};

const nameStyle: CSSProperties = { fontWeight: 600, color: '#e7e9ee' };
const badgeStyle: CSSProperties = { fontWeight: 700, fontSize: 12 };
const vitalsStyle: CSSProperties = { color: '#9aa0ac', textAlign: 'right' };

const footerStyle: CSSProperties = { display: 'flex', gap: 8, justifyContent: 'center' };

const buttonBaseStyle: CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const primaryStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#2a3140',
  color: '#e7e9ee',
  borderColor: '#3a4150',
};

const secondaryStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#1c1e23',
  color: '#c7ccd6',
  borderColor: '#2c2f36',
};

// HandoffScreen — a minimal pass-and-play transition prompt (Session 43).
//
// Shown between two different human controllers' phases: between team
// builders, between deployment phases, and between turns mid-battle. Its
// only job is a deliberate "the device is changing hands now" beat —
// Taciturn has no hidden information, so this is about not losing track
// of whose turn it is, not about concealing state. Intentionally tiny:
// a title, a line of body text, and a single confirm button.

import type { CSSProperties, ReactElement } from 'react';

export interface HandoffScreenProps {
  readonly title: string;
  readonly body: string;
  readonly cta: string;
  // Accent color (the incoming team's color) for the card border + CTA.
  readonly accent: string;
  readonly onConfirm: () => void;
}

export function HandoffScreen({
  title,
  body,
  cta,
  accent,
  onConfirm,
}: HandoffScreenProps): ReactElement {
  return (
    <div style={rootStyle}>
      <div style={{ ...cardStyle, borderColor: accent }}>
        <div style={{ ...titleStyle, color: accent }}>{title}</div>
        <div style={bodyStyle}>{body}</div>
        <button
          type="button"
          autoFocus
          style={{ ...ctaStyle, borderColor: accent }}
          onClick={onConfirm}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0e0f12',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  alignItems: 'center',
  textAlign: 'center',
  padding: '36px 40px',
  maxWidth: 420,
  background: 'rgba(28, 30, 35, 0.98)',
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: '#3a4150',
  borderRadius: 12,
  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
};

const titleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '0.02em',
};

const bodyStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: '#c7cad2',
};

const ctaStyle: CSSProperties = {
  marginTop: 6,
  padding: '10px 22px',
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 6,
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: '#3a4150',
  background: '#2a3140',
  color: '#e7e9ee',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

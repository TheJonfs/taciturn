// Active-team signaling (Session 43).
//
// Three complementary cues that keep "whose turn is it" unmistakable —
// the core pass-and-play ergonomic risk (Taciturn has no hidden info, so
// this is about attention, not concealment). Each is independently
// toggleable via settings; a playtester keeps the combination that reads
// best. The menu-highlight cue (b) is applied inline in `BattleHud` (it's
// a border treatment on an existing slot); this file owns the two
// stand-alone surfaces:
//   (a) ActiveTeamBanner   — persistent strip below the terrain bar.
//   (c) TurnTransitionAlert — brief fading "<Team>'s turn" on each change.

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { TeamId } from '@engine/index.ts';

// (a) Persistent banner. Always on while a unit is active; sits flush
// under the 28px terrain bar so it never competes with the hovered-tile
// readout. Pointer-transparent — purely informational.
export function ActiveTeamBanner({
  teamName,
  color,
}: {
  readonly teamName: string;
  readonly color: string;
}): ReactElement {
  return (
    <div style={{ ...bannerStyle, background: withAlpha(color, 0.9) }}>
      {teamName}&rsquo;s turn
    </div>
  );
}

// (c) Transition alert. Watches the active team id; on each change it
// flashes the team name centered near the top, then fades out on its own
// (no click). Distinct from the banner — this is the attention-grabbing
// "the turn just changed" beat, not the always-on indicator.
export function TurnTransitionAlert({
  activeTeam,
  teamName,
  color,
}: {
  readonly activeTeam: TeamId | null;
  readonly teamName: string | null;
  readonly color: string;
}): ReactElement | null {
  const [visible, setVisible] = useState<boolean>(false);
  const [label, setLabel] = useState<string>('');
  const prevTeamRef = useRef<TeamId | null>(null);

  useEffect(() => {
    if (activeTeam === null) {
      prevTeamRef.current = null;
      return;
    }
    if (activeTeam === prevTeamRef.current) return;
    prevTeamRef.current = activeTeam;
    if (teamName === null) return;
    setLabel(`${teamName}’s turn`);
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1400);
    return () => window.clearTimeout(timer);
  }, [activeTeam, teamName]);

  if (label === '') return null;
  return (
    <div
      style={{
        ...alertStyle,
        color,
        borderColor: color,
        opacity: visible ? 1 : 0,
      }}
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}

// Convert a #rrggbb hex to an rgba() string at the given alpha. Falls
// back to the input untouched if it isn't a 6-digit hex.
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (m === null) return hex;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const bannerStyle: CSSProperties = {
  position: 'absolute',
  // Sits flush under the terrain bar (top:12, height:28 → ends at y=40).
  // Pre-S46 the terrain bar was at top:0 ending at y=28, so this lived
  // at top:28. The S46 padding shift requires the banner to follow.
  top: 40,
  left: 0,
  right: 0,
  height: 22,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#ffffff',
  textShadow: '0 1px 2px rgba(0,0,0,0.6)',
  pointerEvents: 'none',
  zIndex: 5,
};

const alertStyle: CSSProperties = {
  position: 'absolute',
  top: 96,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '10px 28px',
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: '0.04em',
  background: 'rgba(14, 15, 18, 0.82)',
  borderWidth: 2,
  borderStyle: 'solid',
  borderRadius: 10,
  pointerEvents: 'none',
  zIndex: 60,
  transition: 'opacity 600ms ease-out',
  textShadow: '0 1px 3px rgba(0,0,0,0.7)',
};

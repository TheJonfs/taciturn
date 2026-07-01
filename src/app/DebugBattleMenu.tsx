// DebugBattleMenu — a dev-only battle cheat panel (TABA testing aid).
//
// Gated by `import.meta.env.DEV` at the call site (BattleView), so it never
// reaches a production build. Four actions to speed up campaign traversal +
// permadeath testing without hand-fighting every branch:
//   - Force Win / Force Lose — stamp the battle outcome (arbitrary winner).
//   - Remove <unit> (either side) — crystallize one unit mid-battle via the
//     real `system_unit_removed` path, without ending the fight.
//
// Collapsed to a small chip by default so it stays out of the way during a
// normal playtest; one click expands it.

import { useState, type CSSProperties, type ReactElement } from 'react';
import type { GameState, TeamControl, TeamId, UnitId } from '@engine/index.ts';

export interface DebugTeamMeta {
  readonly id: TeamId;
  readonly name: string;
  readonly control: TeamControl;
}

export interface DebugBattleMenuProps {
  readonly state: GameState;
  readonly teams: ReadonlyArray<DebugTeamMeta>;
  readonly onForceOutcome: (winner: TeamId) => void;
  readonly onRemoveUnit: (unitId: UnitId) => void;
}

export function DebugBattleMenu({
  state,
  teams,
  onForceOutcome,
  onRemoveUnit,
}: DebugBattleMenuProps): ReactElement {
  const [open, setOpen] = useState(false);

  // Player-perspective winners: "win" = the human team takes it, "lose" = an
  // enemy (non-human) team does. Falls back to first/last for AI-vs-AI.
  const humanTeam = teams.find((t) => t.control === 'human')?.id ?? teams[0]?.id;
  const enemyTeam = teams.find((t) => t.control !== 'human')?.id ?? teams[teams.length - 1]?.id;

  // Live units grouped by team (removed units already gone from play).
  const unitsByTeam = new Map<TeamId, Array<{ id: UnitId; name: string; hp: number }>>();
  for (const unit of state.units.values()) {
    if (unit.removed) continue;
    const list = unitsByTeam.get(unit.team) ?? [];
    list.push({ id: unit.id, name: unit.name, hp: unit.vitals.hp });
    unitsByTeam.set(unit.team, list);
  }

  if (!open) {
    return (
      <button type="button" style={chipStyle} onClick={() => setOpen(true)} title="Debug tools">
        🐛 Debug
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 700 }}>🐛 Debug</span>
        <button type="button" style={closeStyle} onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>

      <div style={rowStyle}>
        {humanTeam !== undefined && (
          <button type="button" style={winStyle} onClick={() => onForceOutcome(humanTeam)}>
            Force Win
          </button>
        )}
        {enemyTeam !== undefined && (
          <button type="button" style={loseStyle} onClick={() => onForceOutcome(enemyTeam)}>
            Force Lose
          </button>
        )}
      </div>

      <div style={{ marginTop: 6 }}>
        {teams.map((team) => {
          const units = unitsByTeam.get(team.id) ?? [];
          return (
            <div key={team.id} style={{ marginBottom: 6 }}>
              <div style={teamLabelStyle}>
                {team.name}
                {team.control === 'human' ? ' (you)' : ''}
              </div>
              {units.length === 0 ? (
                <div style={emptyStyle}>— none —</div>
              ) : (
                units.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    style={removeStyle}
                    onClick={() => onRemoveUnit(u.id)}
                    title={`Crystallize ${u.name} (removes from play)`}
                  >
                    ✕ {u.name} <span style={hpStyle}>{u.hp} HP</span>
                  </button>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- styles ----

const chipStyle: CSSProperties = {
  position: 'absolute',
  left: 10,
  bottom: 10,
  zIndex: 8_000,
  padding: '5px 9px',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  background: 'rgba(22,24,29,0.85)',
  color: '#c7ccd6',
  border: '1px solid #3a4150',
  borderRadius: 5,
  cursor: 'pointer',
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  left: 10,
  bottom: 10,
  zIndex: 8_000,
  width: 210,
  maxHeight: '70vh',
  overflowY: 'auto',
  padding: 10,
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  background: 'rgba(14,15,18,0.94)',
  color: '#e7e9ee',
  border: '1px solid #3a4150',
  borderRadius: 6,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
};

const closeStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#9aa0ac',
  cursor: 'pointer',
  fontSize: 13,
  padding: 0,
};

const rowStyle: CSSProperties = { display: 'flex', gap: 6 };

const btnBase: CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  fontSize: 12,
  fontFamily: 'inherit',
  borderRadius: 4,
  borderWidth: 1,
  borderStyle: 'solid',
  cursor: 'pointer',
};

const winStyle: CSSProperties = {
  ...btnBase,
  background: '#1e2c22',
  color: '#9fe0a8',
  borderColor: '#2f5a3a',
};

const loseStyle: CSSProperties = {
  ...btnBase,
  background: '#2c1e1e',
  color: '#e09f9f',
  borderColor: '#5a2f2f',
};

const teamLabelStyle: CSSProperties = {
  color: '#9aa0ac',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '2px 0 3px',
};

const emptyStyle: CSSProperties = { color: '#6b707b', fontStyle: 'italic', padding: '2px 0' };

const removeStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '5px 7px',
  margin: '2px 0',
  fontSize: 12,
  fontFamily: 'inherit',
  background: '#1c1e23',
  color: '#e7e9ee',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 4,
  cursor: 'pointer',
};

const hpStyle: CSSProperties = { color: '#9aa0ac', fontSize: 11 };

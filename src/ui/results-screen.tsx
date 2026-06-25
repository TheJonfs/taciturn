// ResultsScreen — post-battle summary panel. Triggered when
// `state.outcome` becomes defined (the `battle_end` action committed).
//
// Per the design doc: winner, MVP unit, per-unit stats, KO timeline,
// and exit buttons. Session 34 (Phase E) wired the continuity buttons:
// New Battle routes back through the battle-setup screen; Main Menu
// returns to the title screen. Rematch stays a disabled placeholder
// (no destination yet). The active Close button dismisses the modal so
// the player can review the log and map behind it.
//
// MVP-unit metric: strict highest-damage-dealt, tie-broken by lexical
// unit-id for determinism. Per Chris's Session 24 call. Future task in
// the handoff to swap in a more nuanced evaluator.

import { useEffect, type CSSProperties, type ReactElement } from 'react';
import type { BattleOutcome, Catalog, GameState, UnitId } from '@engine/index.ts';
import { derivePerUnitStats, deriveKoEvents } from './derived-events.ts';
import { finalTurnNumber } from './action-log-format.ts';
import { CopyLogButton } from './copy-log-button.tsx';

export interface ResultsScreenProps {
  readonly state: GameState;
  readonly outcome: BattleOutcome;
  readonly catalog: Catalog;
  readonly onClose: () => void;
  // Continuity navigation (Session 34). New Battle routes through the
  // battle-setup screen; Main Menu returns to the title screen.
  readonly onNewBattle: () => void;
  readonly onMainMenu: () => void;
}

export function ResultsScreen(props: ResultsScreenProps): ReactElement {
  const { state, outcome, catalog, onClose, onNewBattle, onMainMenu } = props;
  const stats = derivePerUnitStats(state.actionLog, state, catalog);
  const koEvents = deriveKoEvents(state.actionLog, state, catalog);

  // MVP: strict highest damage dealt. Tie-broken by lexical unit-id so
  // the result is deterministic for replays.
  const mvp = pickMvp(stats);

  // ESC closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Use the action log's own T-number count so "ended on turn T####"
  // matches the last log row. (Previously this counted only turn_start and
  // undercounted every battle that resolved a charged spell — each of
  // which gets its own T-number in the log. S71 playtest report.)
  const tNumber = finalTurnNumber(state.actionLog);
  return (
    <>
      <div style={backdropStyle} onClick={onClose} />
      <div style={panelStyle} role="dialog" aria-label="Battle results">
        <div style={titleStyle}>Battle Complete</div>
        <div style={winnerStyle}>{String(outcome.winner)} Wins</div>
        <div style={subtitleStyle}>
          Battle ended on turn T{String(tNumber).padStart(4, '0')}
        </div>
        {outcome.description !== '' && (
          <div style={descriptionStyle}>{outcome.description}</div>
        )}

        <Section title="MVP">
          {mvp === null ? (
            <Empty>No damage dealt</Empty>
          ) : (
            <div style={mvpRowStyle}>
              <span style={mvpNameStyle}>
                {state.units.get(mvp.unitId)?.name ?? String(mvp.unitId)}
              </span>
              <span style={mvpStatStyle}>{mvp.damageDealt} damage dealt</span>
            </div>
          )}
        </Section>

        <Section title="Per-Unit Stats">
          {Array.from(stats.entries()).map(([unitId, s]) => {
            const unit = state.units.get(unitId);
            if (unit === undefined) return null;
            const cls = catalog.hasClass(unit.classState.currentClass)
              ? catalog.getClass(unit.classState.currentClass).name
              : String(unit.classState.currentClass);
            const isKoed = unit.vitals.hp <= 0;
            return (
              <div key={String(unitId)} style={statRowStyle(isKoed)}>
                <span style={statNameStyle}>
                  {unit.name} <span style={statSubStyle}>({cls})</span>
                </span>
                <span style={statValueStyle}>
                  {s.damageDealt} dlt · {s.damageTaken} tkn
                  {isKoed && <span style={koMarkerStyle}> ✗</span>}
                </span>
              </div>
            );
          })}
        </Section>

        <Section title="KO Timeline">
          {koEvents.length === 0 ? (
            <Empty>No KOs this battle</Empty>
          ) : (
            koEvents.map((ev) => {
              const victim = state.units.get(ev.unitId)?.name ?? String(ev.unitId);
              const killer =
                ev.killingActor !== null
                  ? state.units.get(ev.killingActor)?.name ?? String(ev.killingActor)
                  : null;
              return (
                <div key={`${String(ev.unitId)}-${ev.atSequence}`} style={koRowStyle}>
                  <span style={koTStyle}>T{String(ev.tNumber).padStart(4, '0')}</span>
                  <span>
                    {victim}
                    {killer !== null && (
                      <span style={koByStyle}> by {killer}</span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </Section>

        <div style={buttonRowStyle}>
          <CopyLogButton
            state={state}
            label="Copy battle log"
            style={{ fontSize: '14px', padding: '8px 16px' }}
          />
          <button
            type="button"
            style={buttonDisabledStyle}
            disabled
            title="Coming soon"
          >
            Rematch
          </button>
          <button type="button" style={buttonActiveStyle} onClick={onNewBattle}>
            New Battle
          </button>
          <button type="button" style={buttonActiveStyle} onClick={onMainMenu}>
            Main Menu
          </button>
          <button type="button" style={buttonActiveStyle} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

function pickMvp(stats: ReadonlyMap<UnitId, { damageDealt: number }>): {
  readonly unitId: UnitId;
  readonly damageDealt: number;
} | null {
  let best: { unitId: UnitId; damageDealt: number } | null = null;
  for (const [unitId, s] of stats) {
    if (s.damageDealt <= 0) continue;
    if (
      best === null ||
      s.damageDealt > best.damageDealt ||
      (s.damageDealt === best.damageDealt && String(unitId) < String(best.unitId))
    ) {
      best = { unitId, damageDealt: s.damageDealt };
    }
  }
  return best;
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }): ReactElement {
  return (
    <section style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      {children}
    </section>
  );
}

function Empty({ children }: { readonly children: React.ReactNode }): ReactElement {
  return <div style={emptyStyle}>{children}</div>;
}

// ---- styles ----

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  pointerEvents: 'auto',
  zIndex: 60,
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: '8%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(520px, 80%)',
  maxHeight: '80%',
  overflowY: 'auto',
  padding: 20,
  background: 'rgba(28, 30, 35, 0.98)',
  border: '1px solid #2c2f36',
  borderRadius: 10,
  pointerEvents: 'auto',
  zIndex: 61,
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
};

const titleStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.65,
};

const winnerStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  marginTop: 4,
  marginBottom: 6,
  color: '#f6e5a8',
};

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
};

const descriptionStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  marginTop: 4,
  fontStyle: 'italic',
};

const sectionStyle: CSSProperties = {
  marginTop: 14,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.6,
  marginBottom: 6,
};

const mvpRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 14,
  padding: '6px 10px',
  background: 'rgba(246,229,168,0.1)',
  border: '1px solid rgba(246,229,168,0.3)',
  borderRadius: 4,
};

const mvpNameStyle: CSSProperties = {
  fontWeight: 600,
  color: '#f6e5a8',
};

const mvpStatStyle: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  opacity: 0.85,
};

const statRowStyle = (koed: boolean): CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 12,
  padding: '3px 8px',
  marginBottom: 2,
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 3,
  opacity: koed ? 0.6 : 1,
});

const statNameStyle: CSSProperties = {
  fontSize: 12,
};
const statSubStyle: CSSProperties = {
  opacity: 0.6,
  fontSize: 11,
};
const statValueStyle: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontSize: 12,
};

const koMarkerStyle: CSSProperties = {
  color: '#e67865',
  marginLeft: 4,
};

const koRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  fontSize: 12,
  padding: '3px 8px',
  marginBottom: 2,
};

const koTStyle: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  color: '#e67865',
  fontWeight: 600,
  minWidth: 48,
};

const koByStyle: CSSProperties = {
  opacity: 0.65,
};

const buttonRowStyle: CSSProperties = {
  marginTop: 18,
  display: 'flex',
  gap: 6,
  justifyContent: 'flex-end',
};

const buttonBaseStyle: CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  borderRadius: 4,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const buttonActiveStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#2a3140',
  color: '#e7e9ee',
  borderColor: '#3a4150',
};

const buttonDisabledStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#1c1e23',
  color: '#888',
  borderColor: '#2c2f36',
  cursor: 'not-allowed',
  opacity: 0.55,
};

const emptyStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.5,
  fontStyle: 'italic',
};

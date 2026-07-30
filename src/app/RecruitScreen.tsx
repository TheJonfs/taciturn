// RecruitScreen — the hub hiring surface (TABA M3 economy, Stage 3).
//
// Pick a Tier-1 class and a level (hard-capped at the party average — the
// convenience-premium cap; the slider simply cannot exceed it), preview the
// EXACT unit the hire produces (buildHire + probeUnitStats — the same fold a
// deploy runs, so the numbers can't lie), and commit gil. The signing bonus
// and starter gear are shown before purchase; the hire lands on the roster
// immediately deployable.

import { useState, type CSSProperties, type ReactElement } from 'react';
import { useEscapeBack } from './use-escape-back.ts';
import type { Catalog, ClassId } from '@engine/index.ts';
import {
  buildHire,
  hireableClasses,
  hireCost,
  hireJpBonus,
  maxHireLevel,
  probeUnitStats,
  starterGearFor,
  type CampaignState,
  type HireSpec,
  type VitalsProbeBattle,
} from '@campaign/index.ts';

export interface RecruitScreenProps {
  readonly nodeName: string;
  readonly state: CampaignState;
  // The stat preview's probe battlefield (probeBattleFor(node) — the hub's
  // own field, or the canonical one at a pure market town; same template
  // hireGeneric sizes vitals with either way).
  readonly probe: VitalsProbeBattle;
  readonly catalog: Catalog;
  readonly onHire: (spec: HireSpec) => void;
  readonly onExit: () => void;
}

export function RecruitScreen({
  nodeName,
  state,
  probe,
  catalog,
  onHire,
  onExit,
}: RecruitScreenProps): ReactElement {
  useEscapeBack(onExit); // S100: ESC leaves recruitment, same as the Leave button
  const classes = hireableClasses();
  const cap = maxHireLevel(state);
  const [classId, setClassId] = useState<ClassId>(classes[0]!);
  const [level, setLevel] = useState<number>(cap);

  const clamped = Math.min(Math.max(1, level), cap);
  const spec: HireSpec = { classId, level: clamped };
  const cost = hireCost(clamped);
  const bonus = hireJpBonus(clamped);
  const affordable = state.gil >= cost;

  const preview = buildHire(state, spec, catalog);
  const stats = probeUnitStats(probe.template, preview, probe.playerTeam, catalog);
  const gear = starterGearFor(classId, catalog)
    .map(([, id]) => (catalog.hasItem(id) ? catalog.getItem(id).name : String(id)))
    .join(', ');

  return (
    <div style={rootStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>{nodeName} — Recruit</h1>
            <div style={subtitleStyle}>Hires cap at your party&rsquo;s average level ({cap}).</div>
          </div>
          <div style={purseStyle} aria-label="Party gil">
            {state.gil} gil
          </div>
        </div>

        <div style={bodyStyle}>
          <section>
            <h2 style={sectionTitleStyle}>Class</h2>
            <div style={classGridStyle}>
              {classes.map((c) => (
                <button
                  key={String(c)}
                  type="button"
                  style={c === classId ? classChipActiveStyle : classChipStyle}
                  onClick={() => setClassId(c)}
                >
                  {catalog.getClass(c).name}
                </button>
              ))}
            </div>

            <h2 style={sectionTitleStyle}>Level</h2>
            <div style={levelRowStyle}>
              <input
                type="range"
                min={1}
                max={cap}
                value={clamped}
                onChange={(e) => setLevel(Number(e.target.value))}
                style={{ flex: 1 }}
                aria-label="Hire level"
              />
              <span style={levelValueStyle}>Lv {clamped}</span>
            </div>
          </section>

          <aside style={previewStyle} aria-label="Hire preview">
            <div style={previewNameStyle}>
              {preview.name} — {catalog.getClass(classId).name} Lv {clamped}
            </div>
            {stats !== null ? (
              <div style={previewStatsStyle}>
                HP {stats.maxHp} · MP {stats.maxMp} · PA {stats.pa} · MA {stats.ma} · SPD {stats.spd}
              </div>
            ) : (
              <div style={previewStatsStyle}>—</div>
            )}
            <div style={previewLineStyle}>Starting gear: {gear.length > 0 ? gear : 'none'}</div>
            <div style={previewLineStyle}>
              Signing bonus: {bonus > 0 ? `${bonus} JP (${catalog.getClass(classId).name})` : 'none'}
            </div>
            <div style={costLineStyle}>Cost: {cost} gil</div>
            <button
              type="button"
              style={affordable ? hireButtonStyle : hireButtonDisabledStyle}
              disabled={!affordable}
              title={affordable ? undefined : 'Not enough gil'}
              onClick={() => onHire(spec)}
            >
              Hire {preview.name}
            </button>
          </aside>
        </div>

        <div style={footerStyle}>
          <button type="button" style={secondaryStyle} onClick={onExit}>
            ← Back
          </button>
          <span style={rosterCountStyle}>Roster: {state.roster.length} units</span>
        </div>
      </div>
    </div>
  );
}

// ---- styles (the hub-commerce family) ----

const rootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0e0f12',
};

const panelStyle: CSSProperties = {
  width: 720,
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
  display: 'grid',
  gridTemplateColumns: '1.1fr 1fr',
  gap: 18,
  padding: '16px 20px',
};

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#9aa0ac',
};

const classGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
  marginBottom: 16,
};

const classChipStyle: CSSProperties = {
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  textAlign: 'left',
  background: '#1c1e23',
  color: '#c7ccd6',
  border: '1px solid #2c2f36',
  borderRadius: 5,
  cursor: 'pointer',
};

const classChipActiveStyle: CSSProperties = {
  ...classChipStyle,
  background: '#243042',
  color: '#e7e9ee',
  borderColor: '#5a7fb5',
};

const levelRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const levelValueStyle: CSSProperties = { fontWeight: 700, color: '#e7e9ee', minWidth: 48, textAlign: 'right' };

const previewStyle: CSSProperties = {
  padding: '12px 14px',
  background: '#101216',
  border: '1px solid #23262d',
  borderRadius: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const previewNameStyle: CSSProperties = { fontWeight: 700, fontSize: 14, color: '#e7e9ee' };
const previewStatsStyle: CSSProperties = { fontSize: 13, color: '#c7ccd6' };
const previewLineStyle: CSSProperties = { fontSize: 12, color: '#9aa0ac' };
const costLineStyle: CSSProperties = { fontSize: 14, fontWeight: 600, color: '#d8b26c', marginTop: 4 };

const hireButtonStyle: CSSProperties = {
  marginTop: 6,
  padding: '10px 14px',
  fontSize: 14,
  fontFamily: 'inherit',
  borderRadius: 5,
  border: '1px solid #3a4150',
  background: '#2a3140',
  color: '#e7e9ee',
  cursor: 'pointer',
};

const hireButtonDisabledStyle: CSSProperties = {
  ...hireButtonStyle,
  background: '#1c1e23',
  color: '#6b707b',
  cursor: 'not-allowed',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 20px',
  borderTop: '1px solid #2c2f36',
};

const rosterCountStyle: CSSProperties = { fontSize: 12, color: '#9aa0ac' };

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

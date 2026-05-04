// CurrentUnitPanel — at-a-glance stats for the active unit (or a
// placeholder between turns).
//
// v1 only — surfaces HP, MP, Speed (current/effective), and a status
// strip. Speed is computed via `computeSpeed`; max HP via the
// `modifyStatQuery` chain on `maxHp`. We don't show effective stats
// other than Speed yet; richer panels (PA/MA, equipped items, class
// trait list) land alongside their UI sessions.

import type { CSSProperties, ReactElement } from 'react';
import {
  computeSpeed,
  runModifyStatQuery,
  type Catalog,
  type GameState,
  type Unit,
} from '@engine/index.ts';

export interface CurrentUnitPanelProps {
  readonly unit: Unit | null;
  readonly state: GameState | null;
  readonly catalog: Catalog;
}

export function CurrentUnitPanel(props: CurrentUnitPanelProps): ReactElement {
  const { unit, state, catalog } = props;

  if (unit === null || state === null) {
    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>Active Unit</div>
        <div style={emptyStyle}>(between turns)</div>
      </div>
    );
  }

  const cls = catalog.getClass(unit.classState.currentClass);
  const speed = computeSpeed(state, unit.id, catalog);
  const maxHp = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'maxHp',
    baseValue: unit.baseStats.maxHpBase,
  });

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>Active Unit</div>
      <div style={titleStyle}>{unit.name}</div>
      <div style={subtitleStyle}>{cls.name}</div>
      <Stat label="HP" current={unit.vitals.hp} max={maxHp} />
      <Stat label="MP" current={unit.vitals.mp} />
      <Stat label="SPD" current={speed} />
      <StatusStrip unit={unit} />
    </div>
  );
}

function Stat(props: {
  readonly label: string;
  readonly current: number;
  readonly max?: number;
}): ReactElement {
  const { label, current, max } = props;
  return (
    <div style={statRowStyle}>
      <span style={statLabelStyle}>{label}</span>
      <span style={statValueStyle}>
        {current}
        {max !== undefined && <span style={statMaxStyle}>/{max}</span>}
      </span>
    </div>
  );
}

function StatusStrip({ unit }: { readonly unit: Unit }): ReactElement {
  if (unit.statuses.length === 0) {
    return <div style={statusEmptyStyle}>No statuses</div>;
  }
  return (
    <div style={statusStripStyle}>
      {unit.statuses.map((s, i) => (
        <span key={`${s.typeId}-${i}`} style={statusChipStyle}>
          {s.typeId}
        </span>
      ))}
    </div>
  );
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  background: '#1c1e23',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 8,
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  minWidth: 200,
};
const panelHeaderStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.65,
  marginBottom: 2,
};
const emptyStyle: CSSProperties = { fontSize: 13, opacity: 0.6, fontStyle: 'italic' };
const titleStyle: CSSProperties = { fontSize: 16, fontWeight: 600 };
const subtitleStyle: CSSProperties = { fontSize: 12, opacity: 0.7, marginBottom: 6 };
const statRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontVariantNumeric: 'tabular-nums',
};
const statLabelStyle: CSSProperties = { opacity: 0.8 };
const statValueStyle: CSSProperties = { fontWeight: 500 };
const statMaxStyle: CSSProperties = { opacity: 0.55, marginLeft: 1 };
const statusEmptyStyle: CSSProperties = { fontSize: 12, opacity: 0.55, marginTop: 4 };
const statusStripStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  marginTop: 4,
};
const statusChipStyle: CSSProperties = {
  fontSize: 11,
  padding: '2px 6px',
  background: '#2a3140',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 4,
};

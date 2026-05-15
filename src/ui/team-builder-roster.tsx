// TeamBuilderRoster — the four unit slots down the left of the team
// builder (plan decision 3). Each card shows the unit's class portrait,
// name, a brief live-stat line, and a validity indicator. Clicking a
// card focuses it in the edit panel.

import type { CSSProperties, ReactElement } from 'react';
import type { Catalog } from '@engine/index.ts';
import { portraitUrlFor } from '../assets/portraits/index.ts';
import type { DraftUnit, DraftUnitStats, UnitValidity } from './team-builder-state.ts';
import type { TeamBuilder } from './use-team-builder.ts';

export interface TeamBuilderRosterProps {
  readonly builder: TeamBuilder;
  readonly catalog: Catalog;
}

export function TeamBuilderRoster({
  builder,
  catalog,
}: TeamBuilderRosterProps): ReactElement {
  const { state, validity, unitStats, selectedIndex, selectUnit } = builder;

  return (
    <div style={rootStyle}>
      <div style={headerStyle}>
        <div style={eyebrowStyle}>Team Builder</div>
        <div style={teamNameStyle}>{state.name}</div>
      </div>
      <div style={listStyle}>
        {state.units.map((unit, index) => (
          <RosterCard
            key={index}
            index={index}
            unit={unit}
            stats={unitStats[index] ?? null}
            unitValidity={validity.units[index]!}
            isSelected={index === selectedIndex}
            onClick={() => selectUnit(index)}
            catalog={catalog}
          />
        ))}
      </div>
    </div>
  );
}

interface RosterCardProps {
  readonly index: number;
  readonly unit: DraftUnit;
  readonly stats: DraftUnitStats | null;
  readonly unitValidity: UnitValidity;
  readonly isSelected: boolean;
  readonly onClick: () => void;
  readonly catalog: Catalog;
}

function RosterCard({
  index,
  unit,
  stats,
  unitValidity,
  isSelected,
  onClick,
  catalog,
}: RosterCardProps): ReactElement {
  const className =
    unit.classId !== null ? catalog.getClass(unit.classId).name : null;
  const portraitUrl = unit.classId !== null ? portraitUrlFor(unit.classId) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...cardStyle,
        ...(isSelected ? cardSelectedStyle : {}),
      }}
    >
      <div style={portraitWrapStyle}>
        {portraitUrl !== null ? (
          <img src={portraitUrl} alt={className ?? ''} style={portraitImgStyle} />
        ) : (
          <div style={portraitFallbackStyle}>{index + 1}</div>
        )}
        <div
          style={{
            ...statusBadgeStyle,
            ...(unitValidity.valid ? statusOkStyle : statusWarnStyle),
          }}
        >
          {unitValidity.valid ? '✓' : '!'}
        </div>
      </div>
      <div style={bodyStyle}>
        <div style={nameStyle}>
          {className ?? `Unit ${index + 1}`}
        </div>
        <div style={subStyle}>
          {unit.classId === null ? 'No class selected' : `${className}`}
        </div>
        {stats !== null ? (
          <div style={statRowStyle}>
            <Stat label="HP" value={stats.maxHp} />
            <Stat label="MP" value={stats.maxMp} />
            <Stat label="PA" value={stats.pa} />
            <Stat label="MA" value={stats.ma} />
            <Stat label="SPD" value={stats.spd} />
          </div>
        ) : (
          <div style={statPlaceholderStyle}>
            {unit.classId === null ? '— pick a class —' : '— loadout invalid —'}
          </div>
        )}
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <span style={statStyle}>
      <span style={statLabelStyle}>{label}</span>
      <span style={statValueStyle}>{value}</span>
    </span>
  );
}

// ---- styles ----

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: 264,
  flexShrink: 0,
  background: 'rgba(20, 22, 27, 0.96)',
  borderRight: '1px solid #2c2f36',
};

const headerStyle: CSSProperties = {
  padding: '16px 16px 12px',
  borderBottom: '1px solid #2c2f36',
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.55,
};

const teamNameStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#f6e5a8',
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 10,
  overflowY: 'auto',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: 8,
  background: '#1c1e23',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 6,
  textAlign: 'left',
  fontFamily: 'inherit',
  color: '#e7e9ee',
  cursor: 'pointer',
};

const cardSelectedStyle: CSSProperties = {
  borderColor: '#4a90e2',
  background: '#1f2735',
};

const portraitWrapStyle: CSSProperties = {
  position: 'relative',
  width: 44,
  height: 44,
  flexShrink: 0,
};

const portraitImgStyle: CSSProperties = {
  width: 44,
  height: 44,
  objectFit: 'cover',
  borderRadius: 4,
  background: '#000',
};

const portraitFallbackStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 4,
  background: '#33363d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  fontWeight: 700,
  opacity: 0.5,
};

const statusBadgeStyle: CSSProperties = {
  position: 'absolute',
  right: -4,
  bottom: -4,
  width: 16,
  height: 16,
  borderRadius: '50%',
  fontSize: 11,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const statusOkStyle: CSSProperties = {
  background: '#6dc66d',
  color: '#14171c',
};

const statusWarnStyle: CSSProperties = {
  background: '#e0a85a',
  color: '#14171c',
};

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const subStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
};

const statRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 3,
};

const statPlaceholderStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.4,
  fontStyle: 'italic',
  marginTop: 3,
};

const statStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const statLabelStyle: CSSProperties = {
  fontSize: 8,
  letterSpacing: '0.05em',
  opacity: 0.5,
};

const statValueStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
};

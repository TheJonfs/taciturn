// DeploymentRosterPanel — the persistent left-edge sidebar shown during
// the deployment phase (Session 35 / Phase E).
//
// Lists every unit on the deploying team with a portrait, name, class,
// and key stats. The panel doubles as the unit picker (decision 5,
// shape A): while the deployment flow is in `tile_selected`, an
// available roster entry is clickable to commit that unit to the
// selected tile. A placed entry is always clickable — clicking it lifts
// the unit back to the roster (the re-placement flow).
//
// Visual states per entry:
//   available           — normal; clickable only while a tile is selected
//   pickable            — available + a tile is selected → highlighted
//   selected            — this unit is mid-placement (facing pick open)
//   placed              — committed; dimmed + checked; click to lift
//
// Read-only with respect to the engine — it only dispatches through the
// `DeploymentFlow` handlers.

import type { CSSProperties, ReactElement } from 'react';
import {
  runModifyStatQuery,
  type Catalog,
  type GameState,
  type StatName,
  type Unit,
} from '@engine/index.ts';
import { portraitUrlFor } from '../assets/portraits/index.ts';
import type { DeploymentFlow } from './use-deployment-flow.ts';

export interface DeploymentRosterPanelProps {
  readonly flow: DeploymentFlow;
  readonly catalog: Catalog;
  // The battle's initial state — the context `runModifyStatQuery` reads
  // to compute equipment-modified stats (decision 14: the roster shows
  // live computed PA/MA/Speed, not base values, matching the team
  // builder). Distinct from `flow.state`, which is the deployment-phase
  // state machine.
  readonly battleState: GameState;
  readonly teamName: string;
}

export function DeploymentRosterPanel({
  flow,
  catalog,
  battleState,
  teamName,
}: DeploymentRosterPanelProps): ReactElement {
  const { state, rosterUnits } = flow;
  const placedCount = rosterUnits.filter((u) => state.placements.has(u.id)).length;
  const isPicking = state.phase.kind === 'tile_selected';
  const selectedUnitId =
    state.phase.kind === 'unit_selected' ? state.phase.unitId : null;

  return (
    <div style={rootStyle}>
      <div style={headerStyle}>
        <div style={eyebrowStyle}>Deployment</div>
        <div style={teamNameStyle}>{teamName}</div>
        <div style={countStyle}>
          {placedCount} / {rosterUnits.length} placed
        </div>
      </div>

      <div style={hintStyle}>{hintFor(state.phase.kind)}</div>

      <div style={listStyle}>
        {rosterUnits.map((unit) => {
          const isPlaced = state.placements.has(unit.id);
          const isSelected = unit.id === selectedUnitId;
          const isPickable = isPicking && !isPlaced;
          return (
            <RosterEntry
              key={String(unit.id)}
              unit={unit}
              catalog={catalog}
              battleState={battleState}
              isPlaced={isPlaced}
              isSelected={isSelected}
              isPickable={isPickable}
              onClick={() => {
                if (isPlaced) {
                  flow.liftUnit(unit.id);
                } else if (isPickable) {
                  flow.pickUnit(unit.id);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function hintFor(phase: DeploymentFlow['state']['phase']['kind']): string {
  switch (phase) {
    case 'idle':
      return 'Click a highlighted tile to begin placing a unit.';
    case 'tile_selected':
      return 'Pick a unit from the roster to place on the selected tile.';
    case 'unit_selected':
      return 'Choose a facing — click an arrow on the map or use the arrow keys.';
  }
}

interface RosterEntryProps {
  readonly unit: Unit;
  readonly catalog: Catalog;
  readonly battleState: GameState;
  readonly isPlaced: boolean;
  readonly isSelected: boolean;
  readonly isPickable: boolean;
  readonly onClick: () => void;
}

// Equipment-modified stat value — runs the `modifyStatQuery` hook chain
// so the roster shows what the unit actually fights with (decision 14).
function effectiveStat(
  state: GameState,
  catalog: Catalog,
  unit: Unit,
  statName: StatName,
  baseValue: number,
): number {
  return Math.round(
    runModifyStatQuery(state, catalog, { unit, statName, baseValue }),
  );
}

function RosterEntry({
  unit,
  catalog,
  battleState,
  isPlaced,
  isSelected,
  isPickable,
  onClick,
}: RosterEntryProps): ReactElement {
  const className = catalog.hasClass(unit.classState.currentClass)
    ? catalog.getClass(unit.classState.currentClass).name
    : String(unit.classState.currentClass);
  const portraitUrl = portraitUrlFor(unit.classState.currentClass, unit.gender);
  const clickable = isPlaced || isPickable;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      style={{
        ...entryStyle,
        ...(isSelected ? entrySelectedStyle : {}),
        ...(isPickable ? entryPickableStyle : {}),
        ...(isPlaced ? entryPlacedStyle : {}),
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div style={portraitWrapStyle}>
        {portraitUrl !== null ? (
          <img src={portraitUrl} alt={className} style={portraitImgStyle} />
        ) : (
          <div style={portraitFallbackStyle} />
        )}
        {isPlaced && <div style={checkBadgeStyle}>✓</div>}
      </div>
      <div style={entryBodyStyle}>
        <div style={unitNameStyle}>{unit.name}</div>
        <div style={classNameStyle}>{className}</div>
        <div style={statRowStyle}>
          {/* HP / MP are already effective maxes — createInitialState's
              fillVitalsFromComputedMaxes ran the maxHp / maxMp queries.
              PA / MA / Speed need the query run here. */}
          <Stat label="HP" value={unit.vitals.hp} />
          <Stat label="MP" value={unit.vitals.mp} />
          <Stat label="PA" value={effectiveStat(battleState, catalog, unit, 'pa', unit.baseStats.pa)} />
          <Stat label="MA" value={effectiveStat(battleState, catalog, unit, 'ma', unit.baseStats.ma)} />
          <Stat label="SPD" value={effectiveStat(battleState, catalog, unit, 'spd', unit.baseStats.spd)} />
        </div>
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
  position: 'absolute',
  top: 0,
  left: 0,
  bottom: 0,
  width: 264,
  display: 'flex',
  flexDirection: 'column',
  background: 'rgba(20, 22, 27, 0.96)',
  borderRight: '1px solid #2c2f36',
  boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
  zIndex: 5,
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

const countStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  marginTop: 2,
};

const hintStyle: CSSProperties = {
  padding: '10px 16px',
  fontSize: 12,
  lineHeight: 1.4,
  color: '#b9bcc4',
  borderBottom: '1px solid #23252b',
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 10,
  overflowY: 'auto',
};

const entryStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: 8,
  background: '#1c1e23',
  // Non-shorthand border props throughout — the pickable / selected
  // variants override `borderColor`, and mixing it with the `border`
  // shorthand triggers React's rerender style-conflict warning.
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 6,
  textAlign: 'left',
  fontFamily: 'inherit',
  color: '#e7e9ee',
};

const entryPickableStyle: CSSProperties = {
  borderColor: '#f6e5a8',
  background: '#23252b',
};

const entrySelectedStyle: CSSProperties = {
  borderColor: '#4a90e2',
  background: '#1f2735',
};

const entryPlacedStyle: CSSProperties = {
  opacity: 0.55,
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
};

const checkBadgeStyle: CSSProperties = {
  position: 'absolute',
  right: -4,
  bottom: -4,
  width: 16,
  height: 16,
  borderRadius: '50%',
  background: '#6dc66d',
  color: '#14171c',
  fontSize: 11,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const entryBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
};

const unitNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const classNameStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
};

const statRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
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

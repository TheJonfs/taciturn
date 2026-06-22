// TeamBuilderClassPicker — card-pick class selection for the unit
// currently being edited (plan decision 4). Five cards: Knight + the
// four elemental Mages. Clicking a card commits that class to the
// selected unit, resetting its loadout to the class default.

import type { CSSProperties, ReactElement } from 'react';
import type { Catalog, ClassId } from '@engine/index.ts';
import { classes } from '@content/index.ts';
import { portraitUrlFor } from '../assets/portraits/index.ts';
import type { TeamBuilder } from './use-team-builder.ts';
import type { DraftUnit } from './team-builder-state.ts';

// Short role taglines — UI flavor, not mechanical data. Kept here
// rather than on `ClassDefinition` since they're a builder-screen
// presentation detail.
const CLASS_TAGLINES: ReadonlyMap<string, string> = new Map([
  ['knight', 'Armored melee frontline'],
  ['earth_mage', 'Resilient earthen control'],
  ['water_mage', 'Mobile tides and mending'],
  ['fire_mage', 'Burning area pressure'],
  ['lightning_mage', 'High-magic burst striker'],
  ['alchemist', 'Field-medic toolkit support'],
  ['assassin', 'Swift debilitating skirmisher'],
  ['hunter', 'Ranged elevation marksman'],
  ['calculator', 'Battlefield-wide parameter mage'],
  ['terraformer', 'Battlefield-shaping geomancer'],
  ['templar', 'Healer and dragoon hybrid'],
  ['thief', 'Resource-stealing skirmisher'],
  ['enchanter', 'Ally-buffing aura caster'],
]);

export interface TeamBuilderClassPickerProps {
  readonly builder: TeamBuilder;
  readonly catalog: Catalog;
  // Fired after a class is committed (S-team-builder Pass 1). The unit
  // card uses it to collapse the picker mode back to the class chip once
  // a pick lands. Optional — callers that render the grid inline (none
  // today) can omit it.
  readonly onPicked?: () => void;
  // Hide the component's own "Class" section label when the host already
  // labels the picker (the unit card's "Change class" header). Defaults
  // to showing the label for standalone use.
  readonly showLabel?: boolean;
}

export function TeamBuilderClassPicker({
  builder,
  catalog,
  onPicked,
  showLabel = true,
}: TeamBuilderClassPickerProps): ReactElement {
  const { selectedIndex, selectedUnit, state, setClass } = builder;

  // A team carries at most one unit of any class — classes already
  // taken by *other* units are not selectable for this one (mirrors the
  // unique-per-team equipment filtering).
  const takenByOthers = new Set<ClassId>(
    state.units
      .filter((_, index) => index !== selectedIndex)
      .map((unit: DraftUnit) => unit.classId)
      .filter((classId): classId is ClassId => classId !== null),
  );

  return (
    <div style={rootStyle}>
      {showLabel && <div style={sectionLabelStyle}>Class</div>}
      <div style={cardGridStyle}>
        {classes.map((classDef) => {
          const isSelected = selectedUnit.classId === classDef.id;
          const isTaken = takenByOthers.has(classDef.id);
          return (
            <ClassCard
              key={String(classDef.id)}
              classId={classDef.id}
              name={classDef.name}
              tagline={CLASS_TAGLINES.get(String(classDef.id)) ?? ''}
              isSelected={isSelected}
              isTaken={isTaken}
              onClick={() => {
                if (isTaken) return;
                setClass(selectedIndex, classDef.id);
                onPicked?.();
              }}
              catalog={catalog}
            />
          );
        })}
      </div>
    </div>
  );
}

// The role tagline for a class id — exported so the unit card's compact
// class chip shows the same flavor line the picker cards use.
export function classTagline(classId: ClassId): string {
  return CLASS_TAGLINES.get(String(classId)) ?? '';
}

interface ClassCardProps {
  readonly classId: ClassId;
  readonly name: string;
  readonly tagline: string;
  readonly isSelected: boolean;
  // True when another unit on the team already has this class.
  readonly isTaken: boolean;
  readonly onClick: () => void;
  readonly catalog: Catalog;
}

function ClassCard({
  classId,
  name,
  tagline,
  isSelected,
  isTaken,
  onClick,
}: ClassCardProps): ReactElement {
  const portraitUrl = portraitUrlFor(classId);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isTaken && !isSelected}
      style={{
        ...cardStyle,
        ...(isSelected ? cardSelectedStyle : {}),
        ...(isTaken && !isSelected ? cardTakenStyle : {}),
      }}
    >
      <div style={portraitWrapStyle}>
        {portraitUrl !== null ? (
          <img src={portraitUrl} alt={name} style={portraitImgStyle} />
        ) : (
          <div style={portraitFallbackStyle} />
        )}
      </div>
      <div style={cardNameStyle}>{name}</div>
      <div style={cardTaglineStyle}>
        {isTaken && !isSelected ? 'On the team' : tagline}
      </div>
    </button>
  );
}

// ---- styles ----

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.55,
};

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 8,
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: 8,
  background: '#1c1e23',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#e7e9ee',
};

const cardSelectedStyle: CSSProperties = {
  borderColor: '#f6e5a8',
  background: '#23252b',
};

const cardTakenStyle: CSSProperties = {
  opacity: 0.35,
  cursor: 'not-allowed',
};

const portraitWrapStyle: CSSProperties = {
  width: 56,
  height: 56,
};

const portraitImgStyle: CSSProperties = {
  width: 56,
  height: 56,
  objectFit: 'cover',
  borderRadius: 4,
  background: '#000',
};

const portraitFallbackStyle: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 4,
  background: '#33363d',
};

const cardNameStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textAlign: 'center',
};

const cardTaglineStyle: CSSProperties = {
  fontSize: 9,
  lineHeight: 1.3,
  opacity: 0.6,
  textAlign: 'center',
};

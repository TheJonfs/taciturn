// TeamBuilderUnitCard — the central unit card of the redesigned team
// builder (S-team-builder Pass 1). One large card per the approved
// concept: a larger portrait with a level pin, a consolidated identity
// section (name, gender, Brave, Faith), the complete live stat line
// (HP/MP/PA/MA/SPD/Move/Jump, read from the engine resolver via the
// builder's `unitStats`), and the class shown compactly with a "change
// class" control that reopens the full class grid as a mode.
//
// Pass 1 scope: this card replaces the old linear edit panel and houses
// the *existing* equipment + ability editors unchanged in its body. The
// grouped/searchable equipment picker, abilities accordion, and shared
// inspector are Pass 2 — they swap into this same body next pass.
//
// No class exports — Fast Refresh safe.

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import {
  BRAVE_FAITH_MAX,
  BRAVE_FAITH_MIN,
} from '@content/teams/index.ts';
import type { Catalog, ClassId, Gender } from '@engine/index.ts';
import { defaultGenderFor, portraitUrlFor } from '../assets/portraits/index.ts';
import { slotLevel, UNIT_NAME_MAX_LENGTH } from './team-builder-state.ts';
import type { DraftUnitStats } from './team-builder-state.ts';
import type { TeamBuilder } from './use-team-builder.ts';
import { classTagline, TeamBuilderClassPicker } from './team-builder-class-picker.tsx';
import { TeamBuilderEquipmentSlots } from './team-builder-equipment-slots.tsx';
import { TeamBuilderAbilityPicker } from './team-builder-ability-picker.tsx';
import {
  TeamBuilderInspector,
  type InspectorFocus,
} from './team-builder-inspector.tsx';

export interface TeamBuilderUnitCardProps {
  readonly builder: TeamBuilder;
  readonly catalog: Catalog;
}

export function TeamBuilderUnitCard({
  builder,
  catalog,
}: TeamBuilderUnitCardProps): ReactElement {
  const {
    state,
    selectedIndex,
    selectedUnit,
    unitStats,
    setBrave,
    setFaith,
    setUnitName,
    setUnitGender,
  } = builder;

  // Class-pick mode: open explicitly via "Change class", or forced open
  // for a still-classless slot (you must pick before anything else is
  // meaningful). Collapses on pick or when switching to another unit.
  const [changingClass, setChangingClass] = useState(false);
  // What the context inspector is showing — driven by hover in the
  // equipment picker / abilities accordion below. Cleared when switching
  // units (the old focus refers to a different unit's loadout).
  const [focus, setFocus] = useState<InspectorFocus | null>(null);
  useEffect(() => {
    setChangingClass(false);
    setFocus(null);
  }, [selectedIndex]);

  const hasClass = selectedUnit.classId !== null;
  const classId = selectedUnit.classId as ClassId | null;
  const classMode = changingClass || !hasClass;

  const stats = unitStats[selectedIndex] ?? null;
  const level = slotLevel(state, selectedIndex);
  const className = classId !== null ? catalog.getClass(classId).name : null;
  const effectiveGender: Gender | null =
    classId !== null
      ? (selectedUnit.gender ?? defaultGenderFor(classId) ?? 'male')
      : null;
  const portraitUrl =
    classId !== null ? portraitUrlFor(classId, selectedUnit.gender) : null;

  return (
    <>
      <div style={cardStyle}>
      <div style={headerRowStyle}>
        <div style={portraitWrapStyle}>
          {portraitUrl !== null ? (
            <img src={portraitUrl} alt={className ?? ''} style={portraitImgStyle} />
          ) : (
            <div style={portraitFallbackStyle}>{selectedIndex + 1}</div>
          )}
          {level !== null && <span style={levelPinStyle}>L{level}</span>}
        </div>

        <div style={identityColStyle}>
          {hasClass ? (
            <div style={nameGenderRowStyle}>
              <NameInput
                value={selectedUnit.name ?? ''}
                onChange={(v) => setUnitName(selectedIndex, v)}
              />
              {effectiveGender !== null && (
                <GenderToggle
                  value={effectiveGender}
                  onChange={(g) => setUnitGender(selectedIndex, g)}
                />
              )}
            </div>
          ) : (
            <div style={newUnitTitleStyle}>
              New unit · slot {selectedIndex + 1}
            </div>
          )}

          {/* Class chip + change control, shown only when a class is set
              and the grid isn't open. In class-mode the grid section
              below carries its own header. */}
          {hasClass && !classMode && (
            <div style={classChipRowStyle}>
              <div style={classChipStyle}>
                <span style={classChipNameStyle}>{className}</span>
                {classId !== null && (
                  <span style={classChipTaglineStyle}>{classTagline(classId)}</span>
                )}
              </div>
              <button
                type="button"
                style={changeClassButtonStyle}
                onClick={() => setChangingClass(true)}
              >
                Change class
              </button>
            </div>
          )}
        </div>
      </div>

      {hasClass && <StatBlock stats={stats} />}

      {hasClass && (
        <div style={braveFaithRowStyle}>
          <SliderControl
            label="Brave"
            value={selectedUnit.brave}
            onChange={(v) => setBrave(selectedIndex, v)}
          />
          <SliderControl
            label="Faith"
            value={selectedUnit.faith}
            onChange={(v) => setFaith(selectedIndex, v)}
          />
        </div>
      )}

      <div style={dividerStyle} />

      {classMode ? (
        <div style={classModeStyle}>
          <div style={classModeHeaderStyle}>
            <span style={sectionLabelStyle}>
              {hasClass ? 'Change class' : 'Choose a class'}
            </span>
            {hasClass && (
              <button
                type="button"
                style={cancelClassButtonStyle}
                onClick={() => setChangingClass(false)}
              >
                Cancel
              </button>
            )}
          </div>
          <TeamBuilderClassPicker
            builder={builder}
            catalog={catalog}
            showLabel={false}
            onPicked={() => setChangingClass(false)}
          />
        </div>
      ) : (
        <div style={bodyRowStyle}>
          <TeamBuilderEquipmentSlots builder={builder} catalog={catalog} onFocus={setFocus} />
          <TeamBuilderAbilityPicker builder={builder} catalog={catalog} onFocus={setFocus} />
        </div>
      )}
      </div>

      <TeamBuilderInspector focus={classMode ? null : focus} builder={builder} catalog={catalog} />
    </>
  );
}

// ---- stat block ----

// The complete live stat line. Reads the builder's already-computed
// effective stats (engine resolver — same numbers the battle uses), so
// it now includes Move and Jump, which the old roster readout omitted.
// `null` stats mean the loadout is mid-edit-invalid (over-capacity); the
// validity footer carries the reason, here we show a quiet placeholder.
function StatBlock({ stats }: { stats: DraftUnitStats | null }): ReactElement {
  if (stats === null) {
    return (
      <div style={statBlockStyle}>
        <span style={statPlaceholderStyle}>
          Stats unavailable — loadout over capacity (see below).
        </span>
      </div>
    );
  }
  return (
    <div style={statBlockStyle}>
      <StatCell label="HP" value={stats.maxHp} />
      <StatCell label="MP" value={stats.maxMp} />
      <StatCell label="PA" value={stats.pa} />
      <StatCell label="MA" value={stats.ma} />
      <StatCell label="SPD" value={stats.spd} />
      <StatCell label="Move" value={stats.moveRange} />
      <StatCell label="Jump" value={stats.jump} />
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div style={statCellStyle}>
      <span style={statCellLabelStyle}>{label}</span>
      <span style={statCellValueStyle}>{value}</span>
    </div>
  );
}

// ---- identity controls (moved here from TeamBuilderScreen so the card
// owns its identity section) ----

function NameInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <label style={nameRowStyle}>
      <span style={fieldLabelStyle}>Name</span>
      <input
        type="text"
        value={value}
        maxLength={UNIT_NAME_MAX_LENGTH}
        placeholder="Unit name"
        onChange={(e) => onChange(e.target.value)}
        style={nameInputStyle}
      />
    </label>
  );
}

// Portrait gender toggle (S55) — a small two-button segmented control
// (♀ / ♂); the active side reflects the unit's effective gender. Purely
// cosmetic in v1 — it switches the portrait variant.
function GenderToggle({
  value,
  onChange,
}: {
  value: Gender;
  onChange: (gender: Gender) => void;
}): ReactElement {
  return (
    <div style={genderToggleStyle} role="group" aria-label="Portrait gender">
      <button
        type="button"
        onClick={() => onChange('female')}
        aria-pressed={value === 'female'}
        title="Female portrait"
        style={value === 'female' ? genderButtonActiveStyle : genderButtonStyle}
      >
        ♀
      </button>
      <button
        type="button"
        onClick={() => onChange('male')}
        aria-pressed={value === 'male'}
        title="Male portrait"
        style={value === 'male' ? genderButtonActiveStyle : genderButtonStyle}
      >
        ♂
      </button>
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <label style={sliderControlStyle}>
      <div style={sliderHeaderStyle}>
        <span style={fieldLabelStyle}>{label}</span>
        <span style={sliderValueStyle}>{value}</span>
      </div>
      <input
        type="range"
        min={BRAVE_FAITH_MIN}
        max={BRAVE_FAITH_MAX}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={sliderInputStyle}
      />
    </label>
  );
}

// ---- styles ----

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  width: '100%',
  background: 'rgba(28, 30, 35, 0.96)',
  border: '1px solid #2c2f36',
  borderRadius: 10,
  padding: 18,
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'flex-start',
};

const portraitWrapStyle: CSSProperties = {
  position: 'relative',
  width: 96,
  height: 96,
  flexShrink: 0,
};

const portraitImgStyle: CSSProperties = {
  width: 96,
  height: 96,
  objectFit: 'cover',
  borderRadius: 8,
  background: '#000',
};

const portraitFallbackStyle: CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: 8,
  background: '#33363d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 30,
  fontWeight: 700,
  opacity: 0.5,
};

const levelPinStyle: CSSProperties = {
  position: 'absolute',
  right: -6,
  bottom: -6,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.04em',
  padding: '2px 7px',
  borderRadius: 4,
  background: '#2a3a52',
  color: '#a3c6f0',
  border: '1px solid #14171c',
};

const identityColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  flex: 1,
  minWidth: 0,
};

const nameGenderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const newUnitTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#cfd2da',
};

const classChipRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const classChipStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
};

const classChipNameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#f6e5a8',
};

const classChipTaglineStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
};

const changeClassButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  padding: '5px 11px',
  fontSize: 12,
  background: '#1c1e23',
  color: '#b9bcc4',
  border: '1px solid #2c2f36',
  borderRadius: 5,
  cursor: 'pointer',
  fontFamily: 'inherit',
  flexShrink: 0,
};

const statBlockStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
};

const statCellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  minWidth: 52,
  padding: '7px 4px',
  background: '#16181d',
  border: '1px solid #2c2f36',
  borderRadius: 6,
  flex: 1,
};

const statCellLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.5,
};

const statCellValueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};

const statPlaceholderStyle: CSSProperties = {
  fontSize: 12,
  fontStyle: 'italic',
  opacity: 0.5,
  padding: '7px 2px',
};

const braveFaithRowStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
};

const dividerStyle: CSSProperties = {
  borderTop: '1px solid #2c2f36',
};

const classModeStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const classModeHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.55,
};

const cancelClassButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  padding: '4px 10px',
  fontSize: 12,
  background: '#1c1e23',
  color: '#b9bcc4',
  border: '1px solid #2c2f36',
  borderRadius: 5,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const bodyRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
  alignItems: 'start',
};

const nameRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flex: 1,
  minWidth: 0,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.55,
  flexShrink: 0,
};

const nameInputStyle: CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  fontSize: 13,
  background: '#16181d',
  color: '#e7e9ee',
  border: '1px solid #2c2f36',
  borderRadius: 4,
  fontFamily: 'inherit',
  minWidth: 0,
};

const genderToggleStyle: CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  border: '1px solid #2c2f36',
  borderRadius: 4,
  overflow: 'hidden',
};

const genderButtonStyle: CSSProperties = {
  padding: '6px 10px',
  fontSize: 15,
  lineHeight: 1,
  background: '#16181d',
  color: '#9aa0aa',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const genderButtonActiveStyle: CSSProperties = {
  ...genderButtonStyle,
  background: '#3a6ea5',
  color: '#ffffff',
};

const sliderControlStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: 1,
};

const sliderHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
};

const sliderValueStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
};

const sliderInputStyle: CSSProperties = {
  width: '100%',
};

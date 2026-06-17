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
  // When hovering an equipment candidate, preview the unit's stats as if
  // it were equipped — the stat block highlights what changes (green up /
  // red down). Other focus kinds don't reproject the stat line.
  const projected =
    focus !== null && focus.kind === 'equipment'
      ? builder.projectEquipmentStats(focus.slot, focus.itemId)
      : null;
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
            // S68: `key` forces a fresh <img> when the portrait URL changes
            // (class / gender swap) rather than reusing one element with a
            // swapped `src` — avoids the browser retaining the old decoded
            // 512² frame until a repaint (the "stuck portrait until tab
            // refocus" glitch). No cost on re-renders where the URL is
            // unchanged (the common case) — the key is stable, element reused.
            <img key={portraitUrl} src={portraitUrl} alt={className ?? ''} style={portraitImgStyle} />
          ) : (
            <div style={portraitFallbackStyle}>{selectedIndex + 1}</div>
          )}
          {level !== null && <span style={levelPinStyle}>L{level}</span>}
        </div>

        {/* Beside the portrait: three compact rows within the portrait's
            vertical extent — (1) the customizable identity controls,
            (2) a thin class line, (3) the full stat line. Buys back the
            vertical space the old stacked header wasted. */}
        <div style={identityColStyle}>
          {/* Row 1 — name, Brave, Faith, gender (the editable identity). */}
          <div style={identityRowStyle}>
            {hasClass ? (
              <>
                <input
                  type="text"
                  value={selectedUnit.name ?? ''}
                  maxLength={UNIT_NAME_MAX_LENGTH}
                  placeholder="Unit name"
                  onChange={(e) => setUnitName(selectedIndex, e.target.value)}
                  style={nameInputStyle}
                />
                <CompactSlider
                  label="Brave"
                  value={selectedUnit.brave}
                  onChange={(v) => setBrave(selectedIndex, v)}
                />
                <CompactSlider
                  label="Faith"
                  value={selectedUnit.faith}
                  onChange={(v) => setFaith(selectedIndex, v)}
                />
                {effectiveGender !== null && (
                  <GenderToggle
                    value={effectiveGender}
                    onChange={(g) => setUnitGender(selectedIndex, g)}
                  />
                )}
              </>
            ) : (
              <div style={newUnitTitleStyle}>New unit · slot {selectedIndex + 1}</div>
            )}
          </div>

          {/* Row 2 — thin class line (the class is also implicit in the
              portrait). Hidden in class-mode; the grid carries its own
              header below. */}
          {hasClass && !classMode && (
            <div style={classLineStyle}>
              <span style={classLineNameStyle}>{className}</span>
              {classId !== null && (
                <span style={classLineBlurbStyle}>{classTagline(classId)}</span>
              )}
              <button
                type="button"
                style={changeClassButtonStyle}
                onClick={() => setChangingClass(true)}
              >
                Change class
              </button>
            </div>
          )}

          {/* Row 3 — the full stat line, fit across the column. */}
          {hasClass && <StatBlock stats={stats} projected={projected} />}
        </div>
      </div>

      <div style={dividerStyle} />

      <div style={scrollBodyStyle}>
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
//
// When `projected` is supplied (the player is hovering an equipment
// candidate), each cell shows the *projected* value and highlights the
// change — green for an increase, red for a decrease — so the trade-off
// of a gear swap reads at a glance off the unit's own stats.
const STAT_CELLS: ReadonlyArray<readonly [string, keyof DraftUnitStats]> = [
  ['HP', 'maxHp'],
  ['MP', 'maxMp'],
  ['PA', 'pa'],
  ['MA', 'ma'],
  ['SPD', 'spd'],
  ['Move', 'moveRange'],
  ['Jump', 'jump'],
];

function StatBlock({
  stats,
  projected,
}: {
  stats: DraftUnitStats | null;
  projected: DraftUnitStats | null;
}): ReactElement {
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
      {STAT_CELLS.map(([label, key]) => {
        const current = stats[key];
        const value = projected !== null ? projected[key] : current;
        const delta = projected !== null ? projected[key] - current : 0;
        return <StatCell key={label} label={label} value={value} delta={delta} />;
      })}
    </div>
  );
}

function StatCell({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: number;
}): ReactElement {
  const tone = delta > 0 ? 'up' : delta < 0 ? 'down' : null;
  return (
    <div
      style={{
        ...statCellStyle,
        ...(tone === 'up'
          ? statCellUpStyle
          : tone === 'down'
            ? statCellDownStyle
            : {}),
      }}
    >
      <span style={statCellLabelStyle}>{label}</span>
      <span
        style={{
          ...statCellValueStyle,
          ...(tone === 'up'
            ? { color: '#6dc66d' }
            : tone === 'down'
              ? { color: '#e07a7a' }
              : {}),
        }}
      >
        {value}
        {delta !== 0 && (
          <span style={statDeltaStyle}>{delta > 0 ? `+${delta}` : delta}</span>
        )}
      </span>
    </div>
  );
}

// ---- identity controls (moved here from TeamBuilderScreen so the card
// owns its identity section) ----

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

// Compact Brave/Faith slider — label, slider, and value inline on one
// row so two of them plus the name field and gender toggle fit a single
// identity row beside the portrait.
function CompactSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <label style={compactSliderStyle}>
      <span style={compactSliderLabelStyle}>{label}</span>
      <input
        type="range"
        min={BRAVE_FAITH_MIN}
        max={BRAVE_FAITH_MAX}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={compactSliderInputStyle}
      />
      <span style={compactSliderValueStyle}>{value}</span>
    </label>
  );
}

// ---- styles ----

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  width: '100%',
  // Fill the available column height and never overflow the frame — the
  // header/stats stay fixed and the body scrolls (see scrollBodyStyle),
  // so the inspector below the card stays in view on short windows.
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  background: 'rgba(28, 30, 35, 0.96)',
  border: '1px solid #2c2f36',
  borderRadius: 10,
  padding: 18,
};

// The scrollable region of the card: identity/stats/Brave/Faith stay
// pinned above; the equipment picker + abilities accordion (or the class
// grid) scroll here when they outgrow the window.
const scrollBodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
  // Stretch so the identity column spans the portrait's height; its three
  // rows distribute across that extent (space-between below).
  alignItems: 'stretch',
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
  justifyContent: 'space-between',
  gap: 6,
  flex: 1,
  minWidth: 0,
};

// Row 1 — the editable identity controls, inline.
const identityRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const nameInputStyle: CSSProperties = {
  flex: '0 1 180px',
  minWidth: 90,
  padding: '4px 9px',
  fontSize: 13,
  fontWeight: 600,
  background: '#16181d',
  color: '#e7e9ee',
  border: '1px solid #2c2f36',
  borderRadius: 4,
  fontFamily: 'inherit',
};

const compactSliderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  flex: 1,
  minWidth: 108,
};

const compactSliderLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.55,
  flexShrink: 0,
};

const compactSliderInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const compactSliderValueStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  width: 18,
  textAlign: 'right',
  flexShrink: 0,
};

const newUnitTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#cfd2da',
};

// Row 2 — thin class line (name + blurb + change control).
const classLineStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 9,
};

const classLineNameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#f6e5a8',
  flexShrink: 0,
};

const classLineBlurbStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const changeClassButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  padding: '3px 10px',
  fontSize: 12,
  background: '#1c1e23',
  color: '#b9bcc4',
  border: '1px solid #2c2f36',
  borderRadius: 5,
  cursor: 'pointer',
  fontFamily: 'inherit',
  flexShrink: 0,
};

// Row 3 — the seven stat cells across the column, inline and no-wrap so
// they all fit between the portrait's right edge and the card edge.
const statBlockStyle: CSSProperties = {
  display: 'flex',
  gap: 5,
};

const statCellStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: 5,
  padding: '4px 5px',
  background: '#16181d',
  border: '1px solid #2c2f36',
  borderRadius: 5,
  flex: 1,
  minWidth: 0,
};

// Up/down tints for a projected stat change (gear-hover preview). Tint
// the background only — not the border — so React never sees a
// shorthand/longhand `border` mix when the projection toggles on/off.
const statCellUpStyle: CSSProperties = {
  background: 'rgba(109, 198, 109, 0.14)',
};

const statCellDownStyle: CSSProperties = {
  background: 'rgba(224, 122, 122, 0.14)',
};

const statCellLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  opacity: 0.5,
};

const statCellValueStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};

// The small +N / −N badge beside a changed stat; inherits the cell
// value's green/red color.
const statDeltaStyle: CSSProperties = {
  marginLeft: 2,
  fontSize: 9,
  fontWeight: 700,
  verticalAlign: 'top',
};

const statPlaceholderStyle: CSSProperties = {
  fontSize: 12,
  fontStyle: 'italic',
  opacity: 0.5,
  padding: '4px 2px',
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

const genderToggleStyle: CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  border: '1px solid #2c2f36',
  borderRadius: 4,
  overflow: 'hidden',
};

const genderButtonStyle: CSSProperties = {
  padding: '4px 9px',
  fontSize: 13,
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

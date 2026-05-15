// TeamBuilderAbilityPicker — ability + secondary-command-set selection
// for the unit being edited (plan decision 6).
//
// Class-default passives show as "Free" and are locked (they come with
// the class). Cross-class passives and secondary command sets cost
// budget; each section shows a live used/capacity indicator that
// reflects equipment (Steel Helm / Augmentor / Magus Crown) as gear
// changes. An option that would overflow its bucket is disabled.
//
// First Action is class-pinned and never appears here — only the
// Reaction / Support / Movement passive buckets and the
// secondary-command-set bucket are player-editable.

import type { CSSProperties, ReactElement } from 'react';
import {
  BUCKET_MOVEMENT,
  BUCKET_REACTION,
  BUCKET_SECONDARY_COMMAND_SETS,
  BUCKET_SUPPORT,
  type AbilityId,
  type BucketId,
  type Catalog,
  type CommandSetId,
} from '@engine/index.ts';
import { abilities, commandSets } from '@content/index.ts';
import {
  draftAbilityCost,
  draftBucketUsage,
  draftCommandSetCost,
} from './team-builder-state.ts';
import type { TeamBuilder } from './use-team-builder.ts';

const PASSIVE_BUCKETS: ReadonlyArray<{ id: BucketId; label: string }> = [
  { id: BUCKET_REACTION, label: 'Reaction' },
  { id: BUCKET_SUPPORT, label: 'Support' },
  { id: BUCKET_MOVEMENT, label: 'Movement' },
];

export interface TeamBuilderAbilityPickerProps {
  readonly builder: TeamBuilder;
  readonly catalog: Catalog;
}

export function TeamBuilderAbilityPicker({
  builder,
  catalog,
}: TeamBuilderAbilityPickerProps): ReactElement {
  const { selectedIndex, selectedUnit, rulesetId, togglePassive, toggleSecondaryCommandSet } =
    builder;
  const classId = selectedUnit.classId;

  if (classId === null) {
    return (
      <div style={rootStyle}>
        <div style={sectionLabelStyle}>Abilities</div>
        <div style={emptyHintStyle}>Pick a class to choose abilities.</div>
      </div>
    );
  }

  const classDef = catalog.getClass(classId);

  // Secondary Command Sets section — surfaced first per S38 follow-up.
  // The cross-class secondary is the most build-defining ability slot
  // (Knight + Earth Spells, Earth Mage + Water Spells, etc.) and the
  // capacity it consumes is the smallest, so the player wants to set
  // it before sizing R/S/M passives against the remaining budget.
  const secondaryUsage = draftBucketUsage(
    selectedUnit,
    BUCKET_SECONDARY_COMMAND_SETS,
    catalog,
    rulesetId,
  );
  const secondaryEquipped =
    selectedUnit.loadout.actionBuckets[BUCKET_SECONDARY_COMMAND_SETS] ?? [];

  return (
    <div style={rootStyle}>
      <div style={sectionLabelStyle}>Abilities</div>

      <div style={bucketSectionStyle}>
        <BucketHeader label="Secondary Command Sets" usage={secondaryUsage} />
        {commandSets
          .filter(
            (cs) =>
              cs.availability === 'available' &&
              cs.id !== classDef.firstActionCommandSet,
          )
          .map((cs) => {
            const isEquipped = secondaryEquipped.includes(cs.id);
            const cost = draftCommandSetCost(cs.id, catalog);
            const wouldOverflow =
              !isEquipped && secondaryUsage.used + cost > secondaryUsage.capacity;
            return (
              <OptionRow
                key={String(cs.id)}
                name={cs.name}
                isFree={false}
                isEquipped={isEquipped}
                cost={cost}
                disabled={wouldOverflow}
                onToggle={() =>
                  toggleSecondaryCommandSet(selectedIndex, cs.id as CommandSetId)
                }
              />
            );
          })}
      </div>

      {PASSIVE_BUCKETS.map(({ id: bucketId, label }) => {
        const usage = draftBucketUsage(selectedUnit, bucketId, catalog, rulesetId);
        const equipped = selectedUnit.loadout.passiveBuckets[bucketId] ?? [];
        const bucketAbilities = abilities.filter(
          (ability) =>
            ability.kind === 'passive' &&
            ability.bucket === bucketId &&
            ability.availability === 'available',
        );
        return (
          <div key={String(bucketId)} style={bucketSectionStyle}>
            <BucketHeader label={label} usage={usage} />
            {bucketAbilities.map((ability) => {
              const isFree = classDef.freeAbilities.has(ability.id);
              const isEquipped = equipped.includes(ability.id);
              const cost = draftAbilityCost(classId, ability.id, catalog);
              // Class defaults are locked on; cross-class options are
              // disabled when adding them would overflow the bucket.
              const wouldOverflow =
                !isEquipped && usage.used + cost > usage.capacity;
              return (
                <OptionRow
                  key={String(ability.id)}
                  name={ability.name}
                  isFree={isFree}
                  isEquipped={isEquipped || isFree}
                  cost={cost}
                  disabled={isFree || wouldOverflow}
                  onToggle={() =>
                    togglePassive(selectedIndex, bucketId, ability.id as AbilityId)
                  }
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function BucketHeader({
  label,
  usage,
}: {
  label: string;
  usage: { used: number; capacity: number };
}): ReactElement {
  const over = usage.used > usage.capacity;
  return (
    <div style={bucketHeaderStyle}>
      <span style={bucketLabelStyle}>{label}</span>
      <span style={{ ...budgetStyle, ...(over ? budgetOverStyle : {}) }}>
        {usage.used} / {usage.capacity}
      </span>
    </div>
  );
}

interface OptionRowProps {
  readonly name: string;
  readonly isFree: boolean;
  readonly isEquipped: boolean;
  readonly cost: number;
  readonly disabled: boolean;
  readonly onToggle: () => void;
}

function OptionRow({
  name,
  isFree,
  isEquipped,
  cost,
  disabled,
  onToggle,
}: OptionRowProps): ReactElement {
  return (
    <label
      style={{
        ...optionRowStyle,
        ...(isEquipped ? optionEquippedStyle : {}),
        ...(disabled && !isEquipped ? optionDisabledStyle : {}),
      }}
    >
      <input
        type="checkbox"
        checked={isEquipped}
        disabled={disabled}
        onChange={onToggle}
        style={checkboxStyle}
      />
      <span style={optionNameStyle}>{name}</span>
      <span style={costTagStyle}>{isFree ? 'Free' : `Cost ${cost}`}</span>
    </label>
  );
}

// ---- styles ----

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.55,
};

const emptyHintStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.5,
  fontStyle: 'italic',
};

const bucketSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

const bucketHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 2,
};

const bucketLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#cfd2da',
};

const budgetStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
  fontVariantNumeric: 'tabular-nums',
};

const budgetOverStyle: CSSProperties = {
  color: '#e07a7a',
  opacity: 1,
  fontWeight: 600,
};

const optionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 6px',
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
};

const optionEquippedStyle: CSSProperties = {
  background: '#23252b',
};

const optionDisabledStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

const checkboxStyle: CSSProperties = {
  margin: 0,
};

const optionNameStyle: CSSProperties = {
  flex: 1,
};

const costTagStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.6,
  letterSpacing: '0.04em',
};

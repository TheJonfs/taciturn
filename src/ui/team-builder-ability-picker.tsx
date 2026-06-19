// TeamBuilderAbilityPicker — the abilities region of the unit card
// (Pass 2 redesign). An accordion over the four budgeted categories
// (Command sets / Reaction / Support / Movement): one category open at a
// time to its full hoverable list; the rest collapse to a summary line
// showing the picks + the budget meter. Selection is budgeted
// multi-select (unchanged); hovering an option routes it to the context
// inspector, which shows the effect + how the cost fits the remaining
// budget.
//
// Class-default passives show as "free" and are locked (they come with
// the class). First Action is class-pinned and never appears here.

import { useState, type CSSProperties, type ReactElement } from 'react';
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
  type BucketUsage,
} from './team-builder-state.ts';
import type { TeamBuilder } from './use-team-builder.ts';
import type { SetInspectorFocus } from './team-builder-inspector.tsx';
import { Icon, type IconName } from './team-builder-icons.tsx';

interface Category {
  readonly id: BucketId;
  readonly label: string;
  readonly icon: IconName;
  readonly kind: 'commandSet' | 'passive';
}

const CATEGORIES: ReadonlyArray<Category> = [
  { id: BUCKET_SECONDARY_COMMAND_SETS, label: 'Command sets', icon: 'command-set', kind: 'commandSet' },
  { id: BUCKET_REACTION, label: 'Reaction', icon: 'reaction', kind: 'passive' },
  { id: BUCKET_SUPPORT, label: 'Support', icon: 'support', kind: 'passive' },
  { id: BUCKET_MOVEMENT, label: 'Movement', icon: 'movement', kind: 'passive' },
];

export interface TeamBuilderAbilityPickerProps {
  readonly builder: TeamBuilder;
  readonly catalog: Catalog;
  readonly onFocus: SetInspectorFocus;
}

export function TeamBuilderAbilityPicker({
  builder,
  catalog,
  onFocus,
}: TeamBuilderAbilityPickerProps): ReactElement {
  // One category open at a time (null = all collapsed); the most
  // build-defining (the secondary command set) opens by default.
  const [open, setOpen] = useState<BucketId | null>(BUCKET_SECONDARY_COMMAND_SETS);

  if (builder.selectedUnit.classId === null) {
    return (
      <div style={rootStyle}>
        <div style={sectionLabelStyle}>Abilities</div>
        <div style={emptyHintStyle}>Pick a class to choose abilities.</div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <div style={sectionLabelStyle}>Abilities</div>
      {CATEGORIES.map((cat) => (
        <CategorySection
          key={String(cat.id)}
          category={cat}
          isOpen={open === cat.id}
          onToggle={() => setOpen((cur) => (cur === cat.id ? null : cat.id))}
          builder={builder}
          catalog={catalog}
          onFocus={onFocus}
        />
      ))}
    </div>
  );
}

function CategorySection({
  category,
  isOpen,
  onToggle,
  builder,
  catalog,
  onFocus,
}: {
  category: Category;
  isOpen: boolean;
  onToggle: () => void;
  builder: TeamBuilder;
  catalog: Catalog;
  onFocus: SetInspectorFocus;
}): ReactElement {
  const { selectedIndex, selectedUnit, rulesetId, togglePassive, toggleSecondaryCommandSet } =
    builder;
  const classId = selectedUnit.classId!;
  const classDef = catalog.getClass(classId);
  const usage = draftBucketUsage(selectedUnit, category.id, catalog, rulesetId);

  // The equipped picks in this category (for the collapsed summary).
  const equippedNames: string[] =
    category.kind === 'commandSet'
      ? (selectedUnit.loadout.actionBuckets[BUCKET_SECONDARY_COMMAND_SETS] ?? []).map((id) =>
          catalog.getCommandSet(id).name,
        )
      : (selectedUnit.loadout.passiveBuckets[category.id] ?? []).map((id) =>
          catalog.getAbility(id).name,
        );

  return (
    <div style={isOpen ? sectionOpenStyle : sectionStyle}>
      <button type="button" style={headerStyle} onClick={onToggle}>
        <Icon name={category.icon} size={15} style={{ opacity: 0.8 }} />
        <span style={headerLabelStyle}>{category.label}</span>
        {!isOpen && equippedNames.length > 0 && (
          <span style={summaryStyle}>· {equippedNames.join(', ')}</span>
        )}
        <BudgetMeter usage={usage} />
        <Icon
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={13}
          style={{ opacity: 0.4 }}
        />
      </button>

      {isOpen && (
        <div style={optionListStyle}>
          {/* S71 #7: the class's First Action command set is pinned and
              never editable, so it was invisible in the builder — a new
              player couldn't see what their own class does. Surface it as
              a locked, hoverable row at the top of the Command sets list;
              hover routes it to the inspector like any other set. */}
          {category.kind === 'commandSet' && (
            <OptionRow
              key="__primary_command_set__"
              name={catalog.getCommandSet(classDef.firstActionCommandSet).name}
              cost={0}
              isFree={false}
              isEquipped
              disabled
              tag="Class"
              onToggle={() => {}}
              onFocus={() =>
                onFocus({ kind: 'commandSet', commandSetId: classDef.firstActionCommandSet })
              }
              onBlurFocus={() => onFocus(null)}
            />
          )}
          {category.kind === 'commandSet'
            ? commandSets
                .filter(
                  (cs) =>
                    cs.availability === 'available' &&
                    cs.id !== classDef.firstActionCommandSet,
                )
                .map((cs) => {
                  const isEquipped = (
                    selectedUnit.loadout.actionBuckets[BUCKET_SECONDARY_COMMAND_SETS] ?? []
                  ).includes(cs.id);
                  const cost = draftCommandSetCost(cs.id, catalog);
                  const wouldOverflow =
                    !isEquipped && usage.used + cost > usage.capacity;
                  return (
                    <OptionRow
                      key={String(cs.id)}
                      name={cs.name}
                      cost={cost}
                      isFree={false}
                      isEquipped={isEquipped}
                      disabled={wouldOverflow}
                      onToggle={() =>
                        toggleSecondaryCommandSet(selectedIndex, cs.id as CommandSetId)
                      }
                      onFocus={() => onFocus({ kind: 'commandSet', commandSetId: cs.id })}
                      onBlurFocus={() => onFocus(null)}
                    />
                  );
                })
            : abilities
                .filter(
                  (ability) =>
                    ability.kind === 'passive' &&
                    ability.bucket === category.id &&
                    ability.availability === 'available',
                )
                .map((ability) => {
                  const isFree = classDef.freeAbilities.has(ability.id);
                  const isEquipped =
                    (selectedUnit.loadout.passiveBuckets[category.id] ?? []).includes(
                      ability.id,
                    ) || isFree;
                  const cost = draftAbilityCost(classId, ability.id, catalog);
                  const wouldOverflow =
                    !isEquipped && usage.used + cost > usage.capacity;
                  return (
                    <OptionRow
                      key={String(ability.id)}
                      name={ability.name}
                      cost={cost}
                      isFree={isFree}
                      isEquipped={isEquipped}
                      disabled={isFree || wouldOverflow}
                      onToggle={() =>
                        togglePassive(selectedIndex, category.id, ability.id as AbilityId)
                      }
                      onFocus={() =>
                        onFocus({
                          kind: 'ability',
                          bucketId: category.id,
                          abilityId: ability.id,
                        })
                      }
                      onBlurFocus={() => onFocus(null)}
                    />
                  );
                })}
        </div>
      )}
    </div>
  );
}

function BudgetMeter({ usage }: { usage: BucketUsage }): ReactElement {
  const over = usage.used > usage.capacity;
  return (
    <span style={{ ...meterStyle, ...(over ? meterOverStyle : {}) }}>
      {usage.used} / {usage.capacity}
    </span>
  );
}

interface OptionRowProps {
  readonly name: string;
  readonly cost: number;
  readonly isFree: boolean;
  readonly isEquipped: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
  readonly onFocus: () => void;
  readonly onBlurFocus: () => void;
  // S71 #7: when set, the row is a locked, non-toggling entry (the class's
  // primary command set) — renders this tag in place of the cost pips.
  readonly tag?: string;
}

function OptionRow({
  name,
  cost,
  isFree,
  isEquipped,
  disabled,
  onToggle,
  onFocus,
  onBlurFocus,
  tag,
}: OptionRowProps): ReactElement {
  // Over-budget unequipped options can't be added — but stay *hoverable*
  // (no HTML `disabled`, which would also block hover) so the inspector
  // can still explain the ability and show why its cost doesn't fit. The
  // click is guarded instead.
  const blocked = disabled && !isEquipped;
  return (
    <button
      type="button"
      aria-disabled={blocked || undefined}
      onClick={() => {
        if (!blocked) onToggle();
      }}
      onMouseEnter={onFocus}
      onMouseLeave={onBlurFocus}
      onFocus={onFocus}
      style={{
        ...optionStyle,
        ...(isEquipped ? optionEquippedStyle : {}),
        ...(blocked ? optionDisabledStyle : {}),
      }}
    >
      <span style={optionMarkStyle}>
        {isEquipped ? <Icon name="check" size={13} style={{ color: '#6dc66d' }} /> : null}
      </span>
      <span style={optionNameStyle}>{name}</span>
      {tag !== undefined ? (
        <span style={classTagStyle}>{tag}</span>
      ) : (
        <CostPips cost={cost} isFree={isFree} />
      )}
    </button>
  );
}

function CostPips({ cost, isFree }: { cost: number; isFree: boolean }): ReactElement {
  if (isFree) return <span style={freeTagStyle}>free</span>;
  return (
    <span style={pipsStyle} title={`Cost ${cost}`}>
      {Array.from({ length: cost }, (_, i) => (
        <span key={i} style={pipStyle} />
      ))}
    </span>
  );
}

// ---- styles ----

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
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

const sectionStyle: CSSProperties = {
  border: '1px solid #2c2f36',
  borderRadius: 7,
  background: '#191b20',
};

const sectionOpenStyle: CSSProperties = {
  ...sectionStyle,
  // Full `border` shorthand (not just borderColor) so React never sees a
  // shorthand/longhand mix when toggling open ↔ closed.
  border: '1px solid #3a4150',
  background: '#1c1f25',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 10px',
  background: 'transparent',
  border: 'none',
  color: '#e7e9ee',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
};

const headerLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  flexShrink: 0,
};

const summaryStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.5,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const meterStyle: CSSProperties = {
  marginLeft: 'auto',
  fontSize: 11,
  opacity: 0.7,
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
};

const meterOverStyle: CSSProperties = {
  color: '#e07a7a',
  opacity: 1,
  fontWeight: 600,
};

const optionListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  padding: '2px 6px 7px',
};

const optionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  width: '100%',
  padding: '5px 7px',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 5,
  color: '#e7e9ee',
  fontFamily: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
};

const optionEquippedStyle: CSSProperties = {
  background: '#23262d',
};

const optionDisabledStyle: CSSProperties = {
  opacity: 0.38,
  cursor: 'not-allowed',
};

const optionMarkStyle: CSSProperties = {
  width: 14,
  display: 'flex',
  flexShrink: 0,
};

const optionNameStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const pipsStyle: CSSProperties = {
  display: 'flex',
  gap: 3,
  alignItems: 'center',
  flexShrink: 0,
};

const pipStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#7e8aa0',
};

const freeTagStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.04em',
  opacity: 0.55,
  flexShrink: 0,
};

// S71 #7: the locked "Class" tag on the pinned primary command-set row.
const classTagStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '1px 6px',
  borderRadius: 3,
  background: '#2a3a52',
  color: '#a3c6f0',
  flexShrink: 0,
};

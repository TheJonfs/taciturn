// UnitDetailPanel — Tier 3 disclosure per the design doc. Shows the full
// stat block, active statuses, resistances, loadout, and equipment for
// any unit. Opened from three entry points (all converging on this same
// component): action menu's Status button, queue tower mini-card click,
// canvas unit click.
//
// Sits as a modal-ish side panel over the right region. Dismissed by
// the close button, click-outside, or ESC. Read-only.

import { useEffect, type CSSProperties, type ReactElement } from 'react';
import {
  ACTIVE_BUCKET_IDS,
  computeSpeed,
  EQUIPMENT_SLOT_IDS,
  PASSIVE_BUCKET_IDS,
  runModifyEvasion,
  runModifyResistance,
  runModifyStatQuery,
  type Catalog,
  type DamageTag,
  type EquipmentSlotId,
  type GameState,
  type Unit,
} from '@engine/index.ts';
import { portraitUrlFor } from '../assets/portraits/index.ts';
import { bucketLabel, slotLabel } from './labels.ts';
import { DetailHover } from './detail-hover.tsx';
import { formatAbilityDetail, formatItemDetail, formatStatusDetail } from './detail-text.ts';
import { badgeStyleFor } from './status-polarity.ts';

// Damage tags the panel walks when computing displayed resistance values.
// Excludes `'healing'` (never resisted per ADR-0016) and the category
// tags (`'physical'`, `'magical'`, `'weapon'`, `'sword'`) that surface as
// Shell/Protect/Steel-Helm modifiers rather than as units' native
// resistances in v1. If a v1 native or contributor begins authoring
// against the category tags, surface them here.
const DISPLAY_RESISTANCE_TAGS: ReadonlyArray<DamageTag> = [
  'fire',
  'ice',
  'lightning',
  'earth',
  'holy',
  'dark',
  'poison',
];

export interface UnitDetailPanelProps {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly unit: Unit;
  readonly onClose: () => void;
}

export function UnitDetailPanel(props: UnitDetailPanelProps): ReactElement {
  const { state, catalog, unit, onClose } = props;

  // ESC closes the panel. The BattleView's own ESC handler will not
  // fire while this listener is attached because we stopPropagation in
  // the keydown handler before bubbling.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const cls = catalog.getClass(unit.classState.currentClass);
  const speed = computeSpeed(state, unit.id, catalog);
  const maxHp = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'maxHp',
    baseValue: unit.baseStats.maxHpBase,
  });
  const maxMp = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'maxMp',
    baseValue: unit.baseStats.maxMpBase,
  });
  const pa = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'pa',
    baseValue: unit.baseStats.pa,
  });
  const ma = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'ma',
    baseValue: unit.baseStats.ma,
  });
  // Move/Jump pass through the modifyStatQuery chain so equipped passives
  // (e.g., the `move_plus_1` ability) and movement-flavored statuses
  // contribute their bonus to the displayed value. Otherwise the panel
  // shows the class baseline and the unit actually moves further.
  const moveRange = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'moveRange',
    baseValue: cls.movement.moveRange,
  });
  const jump = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'jump',
    baseValue: cls.movement.jump,
  });

  // Per-facing evasion display (Session 30 fold-in). Reads each of the
  // three facings through `runModifyEvasion` so equipment / status
  // contributors are reflected: a Knight in Steel Helm shows
  // F: 5  S: -15  B: -15 (class baseline + Steel Helm's -20 side/back).
  // The "attacker" arg on `modifyEvasion` is required by the hook signature
  // but no v1 handler reads it; we pass the unit itself as a stand-in.
  // The display value is "the effective evasion against a generic
  // attacker" — if a future handler gates on attacker identity, this
  // display diverges from per-attacker reality. Watch in playtest.
  const evasionFront = runModifyEvasion(state, catalog, {
    unit,
    attacker: unit,
    baseEvasion: cls.evasion.front,
    facing: 'front',
  });
  const evasionSide = runModifyEvasion(state, catalog, {
    unit,
    attacker: unit,
    baseEvasion: cls.evasion.side,
    facing: 'side',
  });
  const evasionBack = runModifyEvasion(state, catalog, {
    unit,
    attacker: unit,
    baseEvasion: cls.evasion.back,
    facing: 'back',
  });

  return (
    <>
      <div style={backdropStyle} onClick={onClose} />
      <aside style={panelStyle} aria-label={`Detail: ${unit.name}`}>
        <header style={headerStyle}>
          <div style={headerLeftStyle}>
            <PortraitImage classId={unit.classState.currentClass} size={64} />
            <div>
              <div style={nameStyle}>{unit.name}</div>
              <div style={subStyle}>
                {cls.name} · Team {String(unit.team)}
              </div>
            </div>
          </div>
          <button type="button" style={closeButtonStyle} onClick={onClose}>×</button>
        </header>

        <Section title="Stats">
          <StatGrid>
            <StatPair label="HP" value={`${unit.vitals.hp} / ${maxHp}`} />
            <StatPair label="MP" value={`${unit.vitals.mp} / ${maxMp}`} />
            <StatPair label="PA" value={String(pa)} />
            <StatPair label="MA" value={String(ma)} />
            <StatPair label="Speed" value={String(speed)} />
            <StatPair label="CT" value={String(unit.ct)} />
            <StatPair label="Brave" value={String(unit.baseStats.brave)} />
            <StatPair label="Faith" value={String(unit.baseStats.faith)} />
            <StatPair label="Move" value={String(moveRange)} />
            <StatPair label="Jump" value={String(jump)} />
          </StatGrid>
          <div style={evasionRowStyle}>
            <span style={statLabelStyle}>Evade</span>
            <span style={evasionValuesStyle}>
              <span style={evasionEntryStyle}>F {evasionFront}</span>
              <span style={evasionEntryStyle}>S {evasionSide}</span>
              <span style={evasionEntryStyle}>B {evasionBack}</span>
            </span>
          </div>
        </Section>

        <Section title="Active Statuses">
          {unit.statuses.length === 0 ? (
            <Empty>No active statuses</Empty>
          ) : (
            unit.statuses.map((s, i) => {
              const type = catalog.hasStatusType(s.typeId) ? catalog.getStatusType(s.typeId) : null;
              // Title prefers the per-instance displayName for parametric
              // statuses (tagged_resistance_shift's wand-specific names).
              const csName =
                s.customState !== undefined &&
                typeof (s.customState as { displayName?: unknown }).displayName === 'string'
                  ? ((s.customState as { displayName: string }).displayName)
                  : null;
              const name = csName ?? type?.name ?? String(s.typeId);
              const stacks = s.stacks ?? 1;
              const dur = s.remainingDuration ?? '∞';
              const badge = badgeStyleFor(type);
              // Polarity convention (Session 31.5 polish #1): the
              // name pill picks up a subdued positive/negative tint so
              // the player can scan buff vs. debuff at a glance.
              const nameStyle: CSSProperties = {
                ...statusBadgeStyle,
                background: badge.background,
                color: badge.color,
                border: `1px solid ${badge.borderColor}`,
              };
              // Session 31.5 extension: hover the name pill to reveal
              // the status's mechanical summary via the shared
              // DetailHover surface. Falls back to a minimal "Unknown
              // status type" content when the catalog lookup misses.
              const detail = type !== null
                ? formatStatusDetail(type, s)
                : { title: String(s.typeId), lines: ['(unknown status type)'] };
              return (
                <div key={`${String(s.typeId)}-${i}`} style={statusRowStyle}>
                  <DetailHover content={detail} style={statusHoverWrapperStyle}>
                    <span style={nameStyle}>
                      {name}{stacks > 1 ? ` ×${stacks}` : ''}
                    </span>
                  </DetailHover>
                  <span style={statusDurStyle}>{dur}</span>
                </div>
              );
            })
          )}
        </Section>

        <Section title="Resistances">
          {(() => {
            // Thread each candidate damage tag through `runModifyResistance`
            // so equipment-side (`resistanceMods` — Capacitor Ring +100
            // Lightning, Wizard's Robe -25 to all four elements) and
            // status-side (`tagged_resistance_shift`, Shell/Protect)
            // contributions both reach the display. Per ADR-0056's chain
            // composition + composeResistance's inclusion rule: a tag
            // surfaces iff the unit natively carries it OR a contributor
            // produced a non-zero value. The same rule the damage
            // pipeline uses; the previous panel read raw map entries and
            // showed only the native baseline.
            const rows = DISPLAY_RESISTANCE_TAGS.flatMap((tag) => {
              const native = unit.resistances.get(tag);
              const value = runModifyResistance(state, catalog, {
                unit,
                tag,
                baseValue: native ?? 0,
              });
              if (native === undefined && value === 0) return [];
              return [{ tag, value }];
            });
            if (rows.length === 0) return <Empty>None</Empty>;
            return rows.map(({ tag, value }) => (
              <div key={String(tag)} style={resRowStyle}>
                <span style={statusNameStyle}>{String(tag)}</span>
                <span style={statusDurStyle}>{value >= 0 ? `+${value}` : value}</span>
              </div>
            ));
          })()}
        </Section>

        <Section title="Loadout">
          {ACTIVE_BUCKET_IDS.map((bucketId) => {
            const entries = unit.loadout.actionBuckets[bucketId] ?? [];
            const display =
              entries.length === 0
                ? '(empty)'
                : entries
                    .map((csId) =>
                      catalog.hasCommandSet(csId) ? catalog.getCommandSet(csId).name : String(csId),
                    )
                    .join(', ');
            return (
              <div key={String(bucketId)} style={resRowStyle}>
                <span style={statusNameStyle}>{bucketLabel(bucketId)}</span>
                <span style={statusDurStyle}>{display}</span>
              </div>
            );
          })}
          {PASSIVE_BUCKET_IDS.map((bucketId) => {
            const abilityList = unit.loadout.passiveBuckets[bucketId] ?? [];
            return (
              <div key={`p-${String(bucketId)}`} style={resRowStyle}>
                <span style={statusNameStyle}>{bucketLabel(bucketId)}</span>
                <span style={statusDurStyle}>
                  {abilityList.length === 0 ? (
                    '(empty)'
                  ) : (
                    abilityList.map((id, i) => {
                      const ability = catalog.hasAbility(id) ? catalog.getAbility(id) : null;
                      const name = ability !== null ? ability.name : String(id);
                      const content = ability !== null ? formatAbilityDetail(ability, catalog) : null;
                      return (
                        <span key={String(id)}>
                          {i > 0 && ', '}
                          <DetailHover content={content} style={hoverInlineStyle}>
                            {name}
                          </DetailHover>
                        </span>
                      );
                    })
                  )}
                </span>
              </div>
            );
          })}
        </Section>

        <Section title="Equipment">
          {EQUIPMENT_SLOT_IDS.map((slot: EquipmentSlotId) => {
            const itemId = unit.equipment[slot];
            const item =
              itemId !== null && catalog.hasItem(itemId) ? catalog.getItem(itemId) : null;
            const content = item !== null ? formatItemDetail(item, catalog) : null;
            return (
              <div key={slot} style={resRowStyle}>
                <span style={statusNameStyle}>{slotLabel(slot)}</span>
                <span style={statusDurStyle}>
                  {item !== null ? (
                    <DetailHover content={content} style={hoverInlineStyle}>
                      {item.name}
                    </DetailHover>
                  ) : (
                    '(empty)'
                  )}
                </span>
              </div>
            );
          })}
        </Section>
      </aside>
    </>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }): ReactElement {
  return (
    <section style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      {children}
    </section>
  );
}

function StatGrid({ children }: { readonly children: React.ReactNode }): ReactElement {
  return <div style={statGridStyle}>{children}</div>;
}

function StatPair({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <div style={statPairStyle}>
      <span style={statLabelStyle}>{label}</span>
      <span style={statValueStyle}>{value}</span>
    </div>
  );
}

function Empty({ children }: { readonly children: React.ReactNode }): ReactElement {
  return <div style={emptyStyle}>{children}</div>;
}

// Portrait image — renders the class portrait at the requested square
// size. Falls back to a neutral placeholder block when no portrait is
// registered for the class.
function PortraitImage(props: {
  readonly classId: import('@engine/index.ts').ClassId;
  readonly size: number;
}): ReactElement {
  const { classId, size } = props;
  const url = portraitUrlFor(classId);
  if (url === null) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: '#2a3140',
          borderRadius: 6,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      style={{
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: 6,
        flexShrink: 0,
      }}
    />
  );
}

// ---- styles ----

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  pointerEvents: 'auto',
  zIndex: 40,
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 48,
  right: 12,
  bottom: 12,
  width: 340,
  padding: 14,
  background: 'rgba(28, 30, 35, 0.96)',
  border: '1px solid #2c2f36',
  borderRadius: 8,
  pointerEvents: 'auto',
  zIndex: 41,
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  overflowY: 'auto',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 12,
  gap: 10,
};

const headerLeftStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
};

const subStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
  marginTop: 2,
};

const closeButtonStyle: CSSProperties = {
  background: 'transparent',
  color: '#e7e9ee',
  border: 'none',
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 6px',
  lineHeight: 1,
};

const sectionStyle: CSSProperties = {
  marginBottom: 14,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.6,
  marginBottom: 6,
};

const statGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
};

const statPairStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  padding: '2px 6px',
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 3,
};

const statLabelStyle: CSSProperties = { opacity: 0.7 };
const statValueStyle: CSSProperties = { fontWeight: 500 };

// Per-facing evasion display — single row below the 2-column Stats
// grid. The values pack into a horizontal flex on the right so all
// three facings read at a glance.
const evasionRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  padding: '2px 6px',
  marginTop: 4,
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 3,
};

const evasionValuesStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  fontWeight: 500,
};

const evasionEntryStyle: CSSProperties = {
  minWidth: 36,
  textAlign: 'right',
};

const statusRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 12,
  padding: '3px 6px',
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 3,
  marginBottom: 2,
};

const statusNameStyle: CSSProperties = { opacity: 0.85 };
const statusDurStyle: CSSProperties = {
  opacity: 0.65,
  fontVariantNumeric: 'tabular-nums',
};

// Compact pill applied to status badges in the Active Statuses section.
// Background / color / border come from `badgeStyleFor(type)` per the
// status's polarity. Polish #1 (Session 31.5).
const statusBadgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '1px 8px',
  borderRadius: 8,
  fontSize: 11,
  letterSpacing: '0.02em',
};

// Affordance for the DetailHover wrapper around a status pill: the
// `cursor: help` hint tells the player the pill is hoverable. Same
// pattern as ability / item DetailHover wraps (Session 31). Session
// 31.5 extension.
const statusHoverWrapperStyle: CSSProperties = {
  cursor: 'help',
};

const resRowStyle: CSSProperties = statusRowStyle;

// Inline-block on the DetailHover wrapper so the cursor change + hover
// hit area covers the hovered ability / item name without breaking the
// row's flex layout. Underline-on-hover lets the player know the name is
// interactive (mechanical detail tooltip on hover).
const hoverInlineStyle: CSSProperties = {
  display: 'inline-block',
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  textDecorationColor: 'rgba(231, 233, 238, 0.35)',
  cursor: 'help',
};

const emptyStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.5,
  fontStyle: 'italic',
};

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
  type Gender,
  type Unit,
} from '@engine/index.ts';
import { resolveUnitPortrait } from '../assets/portraits/index.ts';
import { bucketLabel, slotLabel } from './labels.ts';
import { DetailHover } from './detail-hover.tsx';
import { formatAbilityDetail, formatItemDetail, formatStatusDetail } from './detail-text.ts';
import { badgeStyleFor } from './status-polarity.ts';

// XP required per level (mirrors the engine's XP_PER_LEVEL, ADR-0139). Used only
// to render the "X / 100" progress readout; the engine owns the actual rollover.
const XP_PER_LEVEL = 100;

// Gender as a short glyph + word for the identity line. Resolves the
// effective gender the same way the portrait / Steal Heart do — explicit
// choice, else the class default, else male — so it's always concrete.
// Gender is mechanically relevant (it gates Steal Heart, which only crosses
// Male ↔ Female), and previously the only in-battle cue was the portrait.
function genderLabel(gender: Gender | undefined): string {
  return (gender ?? 'male') === 'female' ? '♀ Female' : '♂ Male';
}

// The four core elemental tags. These are *always* shown in the
// Resistances section — every unit has a meaningful relationship to all
// four (each mage class is natively +50/-50 on two of them, and the
// Wizard's Robe shifts all four), so a unit with a neutral 0 on one is
// information, not noise. Showing them unconditionally also removes a
// whole class of "is this missing or genuinely zero?" ambiguity.
const CORE_RESISTANCE_TAGS: ReadonlyArray<DamageTag> = [
  'fire',
  'water',
  'earth',
  'lightning',
];

// Non-core damage tags worth surfacing *when present*. Shown only if the
// unit natively carries the tag or a contributor produced a non-zero
// value — these aren't universal, so a row of zeroes would be noise.
// Excludes `'healing'` (never resisted per ADR-0016) and the category
// tags (`'physical'`, `'magical'`, `'weapon'`, `'sword'`) that surface as
// Shell/Protect/Steel-Helm modifiers rather than as units' native
// resistances in v1.
const EXTRA_RESISTANCE_TAGS: ReadonlyArray<DamageTag> = [
  'ice',
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
  // Brave / Faith pass through the modifyStatQuery chain so passives
  // (Bravestrider's +10 Brave) and Brave/Faith-shifting statuses
  // (Undermine, Sow Doubt) show their composed value. Otherwise the
  // panel shows the class baseline while the engine actually rolls
  // reactions and status applications off the modified value.
  const brave = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'brave',
    baseValue: unit.baseStats.brave,
  });
  const faith = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'faith',
    baseValue: unit.baseStats.faith,
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

  // Session 39b: permadeath countdown for KO'd units. Shown above the
  // Stats section so it's the first thing a player notices when
  // inspecting a downed ally / enemy. Color shifts to a warning red
  // when only one virtual tick remains before removal.
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const permadeathThreshold = ruleset.permadeath.threshold;
  const isKO = unit.vitals.hp <= 0 && !unit.removed;
  const isRemoved = unit.removed;
  const ticksRemaining = Math.max(0, permadeathThreshold - unit.turnsKOd);
  const permadeathImminent = isKO && ticksRemaining <= 1;

  return (
    <>
      <div style={backdropStyle} onClick={onClose} />
      <aside style={panelStyle} aria-label={`Detail: ${unit.name}`}>
        <header style={headerStyle}>
          <div style={headerLeftStyle}>
            <PortraitImage classId={unit.classState.currentClass} gender={unit.gender} portrait={unit.portrait} size={64} />
            <div>
              <div style={nameStyle}>{unit.name}</div>
              <div style={subStyle}>
                L{unit.level} {cls.name} · {genderLabel(unit.gender ?? cls.defaultGender)} ·
                {' '}Team {String(unit.team)}
              </div>
            </div>
          </div>
          <button type="button" style={closeButtonStyle} onClick={onClose}>×</button>
        </header>

        {isRemoved && (
          <div
            style={{
              padding: '6px 8px',
              margin: '4px 8px',
              background: 'rgba(120, 60, 60, 0.35)',
              border: '1px solid rgba(180, 80, 80, 0.7)',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              color: '#e8a8a8',
            }}
          >
            Removed from battle (permadeath)
          </div>
        )}
        {isKO && (
          <div
            style={{
              padding: '6px 8px',
              margin: '4px 8px',
              background: permadeathImminent
                ? 'rgba(180, 80, 80, 0.3)'
                : 'rgba(120, 100, 60, 0.3)',
              border: permadeathImminent
                ? '1px solid rgba(220, 100, 100, 0.7)'
                : '1px solid rgba(180, 160, 80, 0.6)',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              color: permadeathImminent ? '#ffb4b4' : '#e8d8a8',
            }}
          >
            KO — {unit.turnsKOd} / {permadeathThreshold} virtual turns elapsed
            {permadeathImminent && ' · revive now or permadeath'}
          </div>
        )}

        <Section title="Stats">
          <StatGrid>
            <StatPair label="HP" value={`${unit.vitals.hp} / ${maxHp}`} />
            <StatPair label="MP" value={`${unit.vitals.mp} / ${maxMp}`} />
            <StatPair label="PA" value={String(pa)} />
            <StatPair label="MA" value={String(ma)} />
            <StatPair label="Speed" value={String(speed)} />
            <StatPair label="CT" value={String(unit.ct)} />
            <StatPair label="Brave" value={String(brave)} />
            <StatPair label="Faith" value={String(faith)} />
            <StatPair label="Move" value={String(moveRange)} />
            <StatPair label="Jump" value={String(jump)} />
            {/* XP toward next level — only for units that can level (TABA M2
                campaign units carry `statsByLevel`; Mage War units never level). */}
            {unit.statsByLevel !== undefined ? (
              <StatPair label="XP" value={`${unit.xp} / ${XP_PER_LEVEL}`} />
            ) : null}
          </StatGrid>
          <div style={evasionRowStyle}>
            <span style={statLabelStyle}>Evade</span>
            <span style={evasionValuesStyle}>
              <span style={evasionEntryStyle}>Front {evasionFront}</span>
              <span style={evasionEntryStyle}>Side {evasionSide}</span>
              <span style={evasionEntryStyle}>Back {evasionBack}</span>
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

        {unit.worldcraftEffects.length > 0 ? (
          <Section title="Active Worldcraft Effects">
            {unit.worldcraftEffects.map((e, i) => {
              // Array order is eviction order (index 0 = oldest → next to
              // revert when the effect cap is exceeded). The ability name
              // comes from the catalog; the right column shows where the
              // effect sits and, for barriers, the remaining TTL.
              const name = catalog.hasAbility(e.abilityId)
                ? catalog.getAbility(e.abilityId).name
                : String(e.abilityId);
              const first = e.kind === 'terrain' ? e.tileChanges[0] : e.barrierTiles[0];
              const where = first !== undefined ? `(${first.x},${first.y})` : '—';
              const tiles = e.kind === 'terrain' ? e.tileChanges.length : e.barrierTiles.length;
              const right =
                e.kind === 'barrier'
                  ? `${where} · ${tiles} tile${tiles === 1 ? '' : 's'} · TTL ${e.ttl}`
                  : `${where} · ${tiles} tile${tiles === 1 ? '' : 's'}`;
              return (
                <div key={`wc-${i}`} style={statusRowStyle}>
                  <span style={statusNameStyle}>
                    {name}
                    {i === 0 && unit.worldcraftEffects.length > 1 ? ' (oldest)' : ''}
                  </span>
                  <span style={statusDurStyle}>{right}</span>
                </div>
              );
            })}
          </Section>
        ) : null}

        <Section title="Resistances">
          {(() => {
            // Thread each damage tag through `runModifyResistance` so
            // equipment-side (`resistanceMods` — Capacitor Ring +100
            // Lightning, Wizard's Robe -25 to all four elements) and
            // status-side (`tagged_resistance_shift`, Shell/Protect)
            // contributions both reach the display. Per ADR-0056's chain
            // composition.
            const valueFor = (tag: DamageTag): number =>
              runModifyResistance(state, catalog, {
                unit,
                tag,
                baseValue: unit.resistances.get(tag) ?? 0,
              });
            // The four core elements are always shown — even a neutral 0
            // is information. The extras surface only when the unit
            // natively carries the tag or a contributor produced a
            // non-zero value (composeResistance's inclusion rule).
            const coreRows = CORE_RESISTANCE_TAGS.map((tag) => ({
              tag,
              value: valueFor(tag),
            }));
            const extraRows = EXTRA_RESISTANCE_TAGS.flatMap((tag) => {
              const native = unit.resistances.get(tag);
              const value = valueFor(tag);
              if (native === undefined && value === 0) return [];
              return [{ tag, value }];
            });
            const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
            // Two-column grid, matching the Stats section's layout.
            return (
              <StatGrid>
                {[...coreRows, ...extraRows].map(({ tag, value }) => (
                  <StatPair
                    key={String(tag)}
                    label={cap(String(tag))}
                    value={value >= 0 ? `+${value}` : String(value)}
                  />
                ))}
              </StatGrid>
            );
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

        {/* Session 39b: stockpile entries for the Alchemist's
            Compound / Throw Item economy. The section renders only
            when the unit has at least one item in stockpile. Hover
            on an item name surfaces the same consumable detail (HP
            heal / MP heal / revive / clear) as the action-menu
            picker tooltip. */}
        {unit.stockpile.size > 0 && (
          <Section title="Stockpile">
            {[...unit.stockpile].map(([itemId, count]) => {
              if (count <= 0) return null;
              const item = catalog.hasItem(itemId) ? catalog.getItem(itemId) : null;
              const content = item !== null ? formatItemDetail(item, catalog) : null;
              return (
                <div key={String(itemId)} style={resRowStyle}>
                  <span style={statusNameStyle}>
                    {item !== null && content !== null ? (
                      <DetailHover content={content} style={hoverInlineStyle}>
                        {item.name}
                      </DetailHover>
                    ) : (
                      String(itemId)
                    )}
                  </span>
                  <span style={statusDurStyle}>× {count}</span>
                </div>
              );
            })}
          </Section>
        )}
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
  readonly gender?: import('@engine/index.ts').Gender | undefined;
  // TABA (ADR-0136): enduring portrait override key; wins over class+gender.
  readonly portrait?: string | undefined;
  readonly size: number;
}): ReactElement {
  const { classId, gender, portrait, size } = props;
  const url = resolveUnitPortrait(portrait, classId, gender);
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
  minWidth: 52,
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

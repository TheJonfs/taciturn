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
  computeSpeed,
  EQUIPMENT_SLOT_IDS,
  runModifyStatQuery,
  type Catalog,
  type EquipmentSlotId,
  type GameState,
  type Unit,
} from '@engine/index.ts';

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

  return (
    <>
      <div style={backdropStyle} onClick={onClose} />
      <aside style={panelStyle} aria-label={`Detail: ${unit.name}`}>
        <header style={headerStyle}>
          <div>
            <div style={nameStyle}>{unit.name}</div>
            <div style={subStyle}>
              {cls.name} · Team {String(unit.team)}
            </div>
          </div>
          <button type="button" style={closeButtonStyle} onClick={onClose}>×</button>
        </header>

        <Section title="Stats">
          <StatGrid>
            <StatPair label="HP" value={`${unit.vitals.hp} / ${maxHp}`} />
            <StatPair label="MP" value={`${unit.vitals.mp}`} />
            <StatPair label="PA" value={String(pa)} />
            <StatPair label="MA" value={String(ma)} />
            <StatPair label="Speed" value={String(speed)} />
            <StatPair label="CT" value={String(unit.ct)} />
            <StatPair label="Brave" value={String(unit.baseStats.brave)} />
            <StatPair label="Faith" value={String(unit.baseStats.faith)} />
            <StatPair label="Move" value={String(moveRange)} />
            <StatPair label="Jump" value={String(jump)} />
          </StatGrid>
        </Section>

        <Section title="Active Statuses">
          {unit.statuses.length === 0 ? (
            <Empty>No active statuses</Empty>
          ) : (
            unit.statuses.map((s, i) => {
              const type = catalog.hasStatusType(s.typeId) ? catalog.getStatusType(s.typeId) : null;
              const name = type?.name ?? String(s.typeId);
              const stacks = s.stacks ?? 1;
              const dur = s.remainingDuration ?? '∞';
              return (
                <div key={`${String(s.typeId)}-${i}`} style={statusRowStyle}>
                  <span style={statusNameStyle}>
                    {name}{stacks > 1 ? ` ×${stacks}` : ''}
                  </span>
                  <span style={statusDurStyle}>{dur}</span>
                </div>
              );
            })
          )}
        </Section>

        <Section title="Resistances">
          {unit.resistances.size === 0 ? (
            <Empty>None</Empty>
          ) : (
            Array.from(unit.resistances.entries()).map(([tag, value]) => (
              <div key={String(tag)} style={resRowStyle}>
                <span style={statusNameStyle}>{String(tag)}</span>
                <span style={statusDurStyle}>{value >= 0 ? `+${value}` : value}</span>
              </div>
            ))
          )}
        </Section>

        <Section title="Loadout">
          {Object.entries(unit.loadout.actionBuckets).map(([bucketId, csId]) => {
            const csName =
              csId !== null && csId !== undefined && catalog.hasCommandSet(csId)
                ? catalog.getCommandSet(csId).name
                : '(empty)';
            return (
              <div key={bucketId} style={resRowStyle}>
                <span style={statusNameStyle}>{bucketId}</span>
                <span style={statusDurStyle}>{csName}</span>
              </div>
            );
          })}
          {Object.entries(unit.loadout.passiveBuckets).map(([bucketId, abilityList]) => {
            if (abilityList.length === 0) return null;
            const names = abilityList.map((id) => {
              if (!catalog.hasAbility(id)) return String(id);
              return catalog.getAbility(id).name;
            });
            return (
              <div key={`p-${bucketId}`} style={resRowStyle}>
                <span style={statusNameStyle}>{bucketId}</span>
                <span style={statusDurStyle}>{names.join(', ')}</span>
              </div>
            );
          })}
        </Section>

        <Section title="Equipment">
          {EQUIPMENT_SLOT_IDS.map((slot: EquipmentSlotId) => {
            const itemId = unit.equipment[slot];
            const itemName =
              itemId !== null && catalog.hasItem(itemId)
                ? catalog.getItem(itemId).name
                : '(empty)';
            return (
              <div key={slot} style={resRowStyle}>
                <span style={statusNameStyle}>{slot}</span>
                <span style={statusDurStyle}>{itemName}</span>
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

const resRowStyle: CSSProperties = statusRowStyle;

const emptyStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.5,
  fontStyle: 'italic',
};

// ChargedActionDetailPanel — opened from a charged-action mini-card in
// the QueueTower per session 24.5. Shows the in-flight spell's caster,
// target(s), AoE preview on the canvas, and timing estimate (ticks to
// resolve, ordering vs. target's next turn).
//
// Why a separate panel from UnitDetailPanel: the content is structurally
// different (a spell-in-flight, not a unit), the canvas AoE overlay is
// only meaningful for the charged-action case, and the click context
// from the mini-card already disambiguates the route. Per session 24.5
// plan, ADR-0047.
//
// Overlay channel: while the panel is open, the renderer's
// `setHighlightOverlay` paints the spell's AoE footprint. On close,
// the effect cleanup clears it. If a turn-flow state (target-select,
// move-await-confirm) re-runs its overlay effect, that will replace
// the panel's overlay — accepted trade-off; the panel still shows
// the data in React.

import { useEffect, type CSSProperties, type ReactElement } from 'react';
import {
  aoeFootprint,
  cardinalFromTo,
  projectChargedResolution,
  tileAt,
  type Catalog,
  type ChargedActionId,
  type GameState,
  type Position,
} from '@engine/index.ts';
import type { BattleRenderer } from '@renderer/index.ts';
import { DetailHover } from './detail-hover.tsx';
import { formatAbilityDetail } from './detail-text.ts';

export interface ChargedActionDetailPanelProps {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly renderer: BattleRenderer | null;
  readonly chargedActionId: ChargedActionId;
  readonly onClose: () => void;
}

export function ChargedActionDetailPanel(props: ChargedActionDetailPanelProps): ReactElement | null {
  const { state, catalog, renderer, chargedActionId, onClose } = props;

  const charged = state.chargedActions.find((c) => c.id === chargedActionId);

  // Compute the spell's AoE footprint for the canvas overlay. Mirrors
  // the resolveAoeTiles helper in use-turn-flow but inlined since the
  // panel only needs it for visualization.
  const aoeTiles: ReadonlyArray<Position> = computeChargedAoe(state, catalog, charged ?? null);

  // Paint the AoE overlay while the panel is open. Cleanup clears it.
  // If the user is mid-turn-flow-pick, that effect will overwrite ours
  // on next render — the data in the panel is the load-bearing
  // surface anyway.
  useEffect(() => {
    if (renderer === null) return;
    if (aoeTiles.length === 0) return;
    renderer.setHighlightOverlay(aoeTiles, 'aoe');
    return () => {
      renderer.setHighlightOverlay([], 'none');
    };
  }, [renderer, aoeTiles]);

  // ESC closes the panel. Capture-phase listener so BattleView's
  // own ESC handler doesn't run.
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

  if (charged === undefined) {
    // The charged action resolved or was canceled between click and
    // mount. Show a placeholder rather than nothing.
    return (
      <>
        <div style={backdropStyle} onClick={onClose} />
        <aside style={panelStyle} aria-label="Charged action detail">
          <header style={headerStyle}>
            <div style={nameStyle}>Charged action</div>
            <button type="button" style={closeButtonStyle} onClick={onClose}>×</button>
          </header>
          <div style={emptyStyle}>This charged action is no longer in flight.</div>
        </aside>
      </>
    );
  }

  const ability = catalog.hasAbility(charged.abilityId)
    ? catalog.getAbility(charged.abilityId)
    : null;
  const caster = state.units.get(charged.casterId) ?? null;
  const abilityName = ability?.name ?? String(charged.abilityId);
  // S31 unit-detail-panel pattern: the ability name is a DetailHover
  // surface so the player can read the in-flight spell's full stat block
  // without leaving the charged-action panel.
  const abilityDetail = ability !== null ? formatAbilityDetail(ability, catalog) : null;
  const casterName = caster?.name ?? String(charged.casterId);

  // Timing: use the engine's schedule-walk via `projectChargedResolution`
  // (session 26.5 / item #3). Walks all CT entities forward and finds
  // this charged action's exact resolution event; accounts for other
  // in-flight charges that would resolve first and reshape the schedule.
  // Falls back to the naive `(100 - ct) / speed` only when the charged
  // action is outside the projection horizon (very slow / paused).
  const resolution = projectChargedResolution({
    state,
    catalog,
    chargedActionId,
  });
  const ticksToResolve = resolution !== null
    ? resolution.resolutionEvent.ticksFromNow
    : charged.speed > 0
      ? Math.max(0, Math.ceil((100 - charged.ct) / charged.speed))
      : 0;
  const eventsBeforeResolve = resolution?.eventsBeforeResolve ?? 0;

  return (
    <>
      <div style={backdropStyle} onClick={onClose} />
      <aside style={panelStyle} aria-label={`Charged action: ${abilityName}`}>
        <header style={headerStyle}>
          <div>
            <div style={nameStyle}>
              <DetailHover content={abilityDetail} style={hoverInlineStyle}>
                {abilityName}
              </DetailHover>
            </div>
            <div style={subStyle}>cast by {casterName}</div>
          </div>
          <button type="button" style={closeButtonStyle} onClick={onClose}>×</button>
        </header>

        <Section title="Target">
          {charged.targets.length === 0 ? (
            <div style={emptyStyle}>(no targets)</div>
          ) : (
            <ul style={listStyle}>
              {charged.targets.map((t, i) => (
                <li key={i} style={listItemStyle}>
                  {describeTarget(t, state)}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Timing">
          <Row label="charge" value={`${charged.ct} / 100`} />
          <Row label="speed" value={String(charged.speed)} />
          <Row label="resolves in" value={`~${ticksToResolve} ticks`} />
          {eventsBeforeResolve > 0 && (
            <Row
              label="after"
              value={`${eventsBeforeResolve} event${eventsBeforeResolve === 1 ? '' : 's'}`}
            />
          )}
        </Section>

        {aoeTiles.length > 1 && (
          <Section title="AoE">
            <div style={mutedStyle}>{aoeTiles.length} tile{aoeTiles.length === 1 ? '' : 's'} — see canvas overlay</div>
          </Section>
        )}
      </aside>
    </>
  );
}

// Compute the AoE footprint for an in-flight charged action, mirroring
// the dispatch in use-turn-flow's `resolveAoeTiles`. Caster-anchored
// shapes (cone, line) read direction from caster→anchor; other shapes
// use the anchor tile directly. Returns a position list ready for
// `setHighlightOverlay`.
function computeChargedAoe(
  state: GameState,
  catalog: Catalog,
  charged: { readonly abilityId: import('@engine/index.ts').AbilityId; readonly casterId: import('@engine/index.ts').UnitId; readonly targets: ReadonlyArray<{ readonly kind: 'unit' | 'tile'; readonly unitId?: import('@engine/index.ts').UnitId; readonly position?: Position }> } | null,
): ReadonlyArray<Position> {
  if (charged === null) return [];
  if (!catalog.hasAbility(charged.abilityId)) return [];
  const ability = catalog.getAbility(charged.abilityId);
  if (ability.kind !== 'active') return [];

  const aoe = ability.effects.aoe;
  // Resolve the anchor position from the first target.
  const target = charged.targets[0];
  if (target === undefined) return [];
  let anchor: Position;
  if (target.kind === 'unit' && target.unitId !== undefined) {
    const u = state.units.get(target.unitId);
    if (u === undefined) return [];
    anchor = u.position;
  } else if (target.kind === 'tile' && target.position !== undefined) {
    anchor = target.position;
  } else {
    return [];
  }

  if (aoe === undefined) {
    // Single-target — just the anchor tile.
    return [anchor];
  }

  const caster = state.units.get(charged.casterId);
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const verticalTolerance = aoe.verticalTolerance ?? ruleset.rangeDefaults.aoeVerticalTolerance;

  if ((aoe.shape.kind === 'cone' || aoe.shape.kind === 'line') && caster !== undefined) {
    if (caster.position.x === anchor.x && caster.position.y === anchor.y) return [];
    const sourceTile = tileAt(state.map, caster.position.x, caster.position.y, caster.position.layer);
    if (sourceTile === undefined) return [];
    const direction = cardinalFromTo(caster.position, anchor);
    const tiles = aoeFootprint({
      map: state.map,
      shape: aoe.shape,
      anchor: { x: caster.position.x, y: caster.position.y, elevation: sourceTile.elevation },
      verticalTolerance,
      direction,
    });
    return tiles.map((t) => ({ x: t.x, y: t.y, layer: t.layer }));
  }

  const anchorTile = tileAt(state.map, anchor.x, anchor.y, anchor.layer);
  if (anchorTile === undefined) return [];
  const tiles = aoeFootprint({
    map: state.map,
    shape: aoe.shape,
    anchor: { x: anchor.x, y: anchor.y, elevation: anchorTile.elevation },
    verticalTolerance,
  });
  return tiles.map((t) => ({ x: t.x, y: t.y, layer: t.layer }));
}

function describeTarget(
  t: { readonly kind: 'unit' | 'tile'; readonly unitId?: import('@engine/index.ts').UnitId; readonly position?: Position },
  state: GameState,
): string {
  if (t.kind === 'unit' && t.unitId !== undefined) {
    const u = state.units.get(t.unitId);
    if (u === undefined) return `(unknown unit ${String(t.unitId)})`;
    return `${u.name} (${u.position.x}, ${u.position.y})`;
  }
  if (t.kind === 'tile' && t.position !== undefined) {
    return `Tile (${t.position.x}, ${t.position.y})`;
  }
  return '(unknown target)';
}

// ---- subcomponents ----

function Section({ title, children }: { readonly title: string; readonly children: import('react').ReactNode }): ReactElement {
  return (
    <section style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      {children}
    </section>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <div style={rowStyle}>
      <span style={rowLabelStyle}>{label}</span>
      <span style={rowValueStyle}>{value}</span>
    </div>
  );
}

// ---- styles ----

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.35)',
  pointerEvents: 'auto',
  zIndex: 10,
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 80,
  right: 320,
  width: 320,
  maxHeight: 'calc(100% - 120px)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 16,
  background: '#1c1e23',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#f6e5a8',
  borderRadius: 8,
  pointerEvents: 'auto',
  zIndex: 11,
  fontFamily: 'system-ui, sans-serif',
  color: '#e7e9ee',
  fontSize: 13,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 4,
};

const nameStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#f6e5a8',
};

// Affordance for the DetailHover wrapper around the ability name —
// mirrors the unit-detail-panel's ability/item hover surfaces (S31).
const hoverInlineStyle: CSSProperties = {
  display: 'inline-block',
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  textDecorationColor: 'rgba(246, 229, 168, 0.4)',
  cursor: 'help',
};

const subStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
};

const closeButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  padding: 0,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 4,
  background: '#2a3140',
  color: '#bcc1cb',
  fontSize: 16,
  lineHeight: '20px',
  cursor: 'pointer',
};

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  opacity: 0.65,
  marginBottom: 2,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
};

const rowLabelStyle: CSSProperties = { opacity: 0.65 };
const rowValueStyle: CSSProperties = { fontWeight: 500 };

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  paddingLeft: 16,
};

const listItemStyle: CSSProperties = {
  fontSize: 12,
};

const emptyStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.55,
  fontStyle: 'italic',
};

const mutedStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
};

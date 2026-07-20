// Cartographer — the right-hand inspector: map meta, brush pickers per
// editing concern (elevation / terrain / properties / zones / decks), the
// terrain-band rule editor, and the selected-tile readout. All edits
// route through the pure edit.ts helpers via the callbacks.

import { useState, type CSSProperties, type ReactElement } from 'react';
import type { TerrainBand } from '@content/maps/map-format.ts';
import type { Brush } from './CartographerCanvas.tsx';
import type { CartographerModel, ZoneTeamKey } from './model.ts';
import {
  deckAt,
  defaultZoneConfig,
  effectiveTerrain,
  elevationAt,
  zoneMembership,
} from './edit.ts';

// The complete authored terrain vocabulary (S98 findings) — pinned by
// AUTHORED_TERRAINS, the ruleset tags, and every class's canEnter. New
// terrain is engine work, so the picker offers exactly these.
export const TERRAIN_VOCABULARY: ReadonlyArray<string> = [
  'ground',
  'water_shallow',
  'water_deep',
  'rampart',
  'rock',
  'grass_rock',
  'bridge',
];

// Every TileProperty any system consumes today (S98 findings).
const PROPERTY_VOCABULARY: ReadonlyArray<{ id: string; hint: string }> = [
  { id: 'bridge_ramp', hint: 'renderer: bridge-kit rise piece on this bank tile' },
  { id: 'blocks_los', hint: 'engine: blocks line of sight' },
];

interface CartographerInspectorProps {
  readonly model: CartographerModel;
  readonly brush: Brush;
  readonly selected: { readonly x: number; readonly y: number } | null;
  readonly deployCount: number;
  readonly onBrush: (brush: Brush) => void;
  readonly onDeployCount: (n: number) => void;
  readonly onSetLabel: (label: string) => void;
  readonly onSetKey: (key: string) => void;
  readonly onResize: (w: number, h: number) => void;
  readonly onSetBands: (bands: ReadonlyArray<TerrainBand>) => void;
  readonly onAddSubZone: (team: ZoneTeamKey) => void;
  readonly onRemoveSubZone: (team: ZoneTeamKey, index: number) => void;
  readonly onSetSubZoneCap: (team: ZoneTeamKey, index: number, cap: number | undefined) => void;
  readonly onSetDeckElevation: (x: number, y: number, elevation: number) => void;
}

export function CartographerInspector(props: CartographerInspectorProps): ReactElement {
  const { model, brush, selected } = props;
  const spec = model.spec;
  const config = defaultZoneConfig(model);
  const [elevationValue, setElevationValue] = useState(3);

  const brushIs = (b: Brush): boolean => JSON.stringify(b) === JSON.stringify(brush);
  const brushButton = (label: string, b: Brush, title?: string): ReactElement => (
    <button
      key={label}
      type="button"
      title={title}
      style={brushIs(b) ? activeChipStyle : chipStyle}
      onClick={() => props.onBrush(b)}
    >
      {label}
    </button>
  );

  return (
    <div style={panelStyle}>
      <Section title="Map">
        <Row label="label">
          <input
            style={inputStyle}
            value={spec.label}
            onChange={(e) => props.onSetLabel(e.target.value)}
          />
        </Row>
        <Row label="key">
          <input
            style={inputStyle}
            value={spec.key}
            onChange={(e) => props.onSetKey(e.target.value)}
          />
        </Row>
        <Row label="size">
          <input
            style={numStyle}
            type="number"
            min={1}
            max={64}
            value={spec.width}
            onChange={(e) => props.onResize(Number(e.target.value), spec.height)}
          />
          <span style={dimTextStyle}>×</span>
          <input
            style={numStyle}
            type="number"
            min={1}
            max={64}
            value={spec.height}
            onChange={(e) => props.onResize(spec.width, Number(e.target.value))}
          />
        </Row>
        <Row label="deploys/side">
          <input
            style={numStyle}
            type="number"
            min={1}
            max={12}
            value={props.deployCount}
            title="Deployable units per side the zone validation requires"
            onChange={(e) => props.onDeployCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </Row>
      </Section>

      <Section title="Brush">
        <div style={chipRowStyle}>{brushButton('Inspect / pan', { kind: 'inspect' })}</div>
        <div style={chipRowStyle}>
          {brushButton(`Elev = ${elevationValue}`, { kind: 'elevation', value: elevationValue })}
          <input
            style={numStyle}
            type="number"
            min={0}
            max={12}
            value={elevationValue}
            onChange={(e) => {
              const v = Math.max(0, Math.min(12, Number(e.target.value) || 0));
              setElevationValue(v);
              if (brush.kind === 'elevation') props.onBrush({ kind: 'elevation', value: v });
            }}
          />
          {brushButton('+1', { kind: 'elevation-nudge', delta: 1 })}
          {brushButton('−1', { kind: 'elevation-nudge', delta: -1 })}
        </div>
        <div style={hintStyle}>
          Terrain follows the band rules as you paint elevation; overrides (◤) stay put.
        </div>
      </Section>

      <Section title="Terrain override">
        <div style={chipRowStyle}>
          {TERRAIN_VOCABULARY.map((t) => brushButton(t, { kind: 'terrain', terrain: t }))}
          {brushButton('clear override', { kind: 'terrain-clear' })}
        </div>
        <div style={hintStyle}>
          Painting the terrain the bands already derive removes the override instead.
        </div>
      </Section>

      <Section title="Properties">
        <div style={chipRowStyle}>
          {PROPERTY_VOCABULARY.map((p) =>
            brushButton(p.id, { kind: 'property', property: p.id }, p.hint),
          )}
        </div>
      </Section>

      <Section title="Deployment zones">
        {(['team_a', 'team_b'] as const).map((team) => {
          const entry = config?.teams.find((t) => t.team === team);
          const teamLabel = team === 'team_a' ? 'Blue (player)' : 'Red (enemy)';
          return (
            <div key={team} style={zoneTeamStyle}>
              <div style={zoneTeamHeaderStyle}>
                <span style={{ color: team === 'team_a' ? '#9db8dd' : '#dd9d9d' }}>{teamLabel}</span>
                <button type="button" style={smallButtonStyle} onClick={() => props.onAddSubZone(team)}>
                  + sub-zone
                </button>
              </div>
              {(entry?.subZones ?? [{ tiles: [] }]).map((sub, i) => (
                <div key={i} style={chipRowStyle}>
                  {brushButton(`paint #${i} (${sub.tiles.length})`, { kind: 'zone', team, subZone: i })}
                  <label style={dimTextStyle}>
                    cap{' '}
                    <input
                      style={numStyle}
                      type="number"
                      min={0}
                      value={sub.cap ?? ''}
                      placeholder="—"
                      onChange={(e) =>
                        props.onSetSubZoneCap(
                          team,
                          i,
                          e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
                        )
                      }
                    />
                  </label>
                  {(entry?.subZones.length ?? 0) > 1 && (
                    <button type="button" style={smallButtonStyle} onClick={() => props.onRemoveSubZone(team, i)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
        <div style={chipRowStyle}>{brushButton('erase zone', { kind: 'zone-erase' })}</div>
      </Section>

      <Section title="Bridge decks (layer 1)">
        <div style={chipRowStyle}>{brushButton('toggle deck', { kind: 'deck-toggle' })}</div>
        {spec.decks.length > 0 && (
          <div style={hintStyle}>
            {spec.decks.length} deck tile{spec.decks.length === 1 ? '' : 's'}; select one in
            Inspect mode to edit its elevation. Decks need ground+2 clearance.
          </div>
        )}
      </Section>

      <Section title="Terrain bands (elevation → terrain)">
        {spec.bands.map((band, i) => (
          <div key={i} style={chipRowStyle}>
            <select
              style={selectStyle}
              value={band.when}
              onChange={(e) =>
                props.onSetBands(
                  spec.bands.map((b, j) =>
                    j === i ? { ...b, when: e.target.value as TerrainBand['when'] } : b,
                  ),
                )
              }
            >
              <option value="eq">=</option>
              <option value="gte">≥</option>
            </select>
            <input
              style={numStyle}
              type="number"
              value={band.elevation}
              onChange={(e) =>
                props.onSetBands(
                  spec.bands.map((b, j) =>
                    j === i ? { ...b, elevation: Number(e.target.value) || 0 } : b,
                  ),
                )
              }
            />
            <select
              style={selectStyle}
              value={band.terrain}
              onChange={(e) =>
                props.onSetBands(
                  spec.bands.map((b, j) => (j === i ? { ...b, terrain: e.target.value } : b)),
                )
              }
            >
              {TERRAIN_VOCABULARY.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={smallButtonStyle}
              onClick={() => props.onSetBands(spec.bands.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <div style={chipRowStyle}>
          <button
            type="button"
            style={smallButtonStyle}
            onClick={() =>
              props.onSetBands([...spec.bands, { when: 'eq', elevation: 0, terrain: 'ground' }])
            }
          >
            + band
          </button>
          <span style={hintStyle}>first match wins; fallback is ground</span>
        </div>
      </Section>

      {selected !== null && (
        <Section title={`Tile (${selected.x}, ${selected.y})`}>
          <TileReadout model={model} x={selected.x} y={selected.y} onSetDeckElevation={props.onSetDeckElevation} />
        </Section>
      )}
    </div>
  );
}

function TileReadout({
  model,
  x,
  y,
  onSetDeckElevation,
}: {
  readonly model: CartographerModel;
  readonly x: number;
  readonly y: number;
  readonly onSetDeckElevation: (x: number, y: number, elevation: number) => void;
}): ReactElement {
  const spec = model.spec;
  const override = spec.terrainOverrides.find((o) => o.x === x && o.y === y);
  const tag = spec.properties.find((p) => p.x === x && p.y === y);
  const deck = deckAt(spec, x, y);
  const zone = zoneMembership(defaultZoneConfig(model), x, y);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span>elevation {elevationAt(spec, x, y)}</span>
      <span>
        terrain {effectiveTerrain(spec, x, y)}
        {override !== undefined ? ' (override)' : ' (from bands)'}
      </span>
      {tag !== undefined && <span>properties: {tag.properties.join(', ')}</span>}
      {zone !== undefined && (
        <span>
          zone: {zone.team === 'team_a' ? 'Blue' : 'Red'} #{zone.subZone}
        </span>
      )}
      {deck !== undefined && (
        <label style={dimTextStyle}>
          deck elevation{' '}
          <input
            style={numStyle}
            type="number"
            min={0}
            value={deck.elevation}
            onChange={(e) => onSetDeckElevation(x, y, Number(e.target.value) || 0)}
          />{' '}
          ({deck.terrain})
        </label>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): ReactElement {
  return (
    <div style={rowStyle}>
      <span style={rowLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

// ---- styles (Atlas idiom) ----

const panelStyle: CSSProperties = {
  width: 320,
  overflowY: 'auto',
  borderLeft: '1px solid #2c2f36',
  background: '#16181d',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  fontSize: 13,
};

const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const sectionTitleStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6b707b',
};

const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };
const rowLabelStyle: CSSProperties = { width: 84, color: '#9aa0ac', fontSize: 12 };

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '4px 6px',
  fontSize: 12,
  background: '#101216',
  color: '#e7e9ee',
  border: '1px solid #2c2f36',
  borderRadius: 4,
  fontFamily: 'inherit',
};

const numStyle: CSSProperties = { ...inputStyle, flex: 'none', width: 54 };
const selectStyle: CSSProperties = { ...inputStyle, flex: 'none', width: 'auto' };

const chipRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' };

const chipStyle: CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  borderRadius: 4,
  border: '1px solid #2c2f36',
  background: '#1c1e23',
  color: '#c7ccd6',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const activeChipStyle: CSSProperties = {
  ...chipStyle,
  borderColor: '#d8b26c',
  color: '#d8b26c',
  background: 'rgba(216,178,108,.08)',
};

const smallButtonStyle: CSSProperties = { ...chipStyle, padding: '2px 7px' };

const hintStyle: CSSProperties = { fontSize: 11, color: '#6b707b' };
const dimTextStyle: CSSProperties = { color: '#9aa0ac', fontSize: 12 };
const zoneTeamStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const zoneTeamHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
};

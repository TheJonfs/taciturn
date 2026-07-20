// Cartographer — pure model edits. Every function returns a new model
// (Atlas's edit.ts idiom; no mutation, no side effects). The zone edits
// keep the edited map's registry entry in sync with the spec, and all
// position lists stay within map bounds after a resize.

import type { TerrainType } from '@engine/index.ts';
import {
  terrainForElevation,
  type MapSpec,
  type TerrainBand,
} from '@content/maps/map-format.ts';
import type {
  CartographerModel,
  MapZoneEntry,
  ZoneConfig,
  ZoneTeamKey,
} from './model.ts';

const DEFAULT_ELEVATION = 2;

export const WATER_TABLE_BANDS: ReadonlyArray<TerrainBand> = [
  { when: 'eq', elevation: 0, terrain: 'water_deep' },
  { when: 'eq', elevation: 1, terrain: 'water_shallow' },
];

const withSpec = (model: CartographerModel, spec: MapSpec): CartographerModel => ({
  ...model,
  spec,
});

export function elevationAt(spec: MapSpec, x: number, y: number): number {
  return spec.elevation[y]?.[x] ?? DEFAULT_ELEVATION;
}

// The terrain a layer-0 tile currently shows: override if present, else
// the band derivation — mirrors buildMapFromSpec.
export function effectiveTerrain(spec: MapSpec, x: number, y: number): TerrainType {
  const override = spec.terrainOverrides.find((o) => o.x === x && o.y === y);
  return override?.terrain ?? terrainForElevation(spec.bands, elevationAt(spec, x, y));
}

export function setElevation(
  model: CartographerModel,
  x: number,
  y: number,
  elevation: number,
): CartographerModel {
  const clamped = Math.max(0, Math.min(99, Math.round(elevation)));
  if (elevationAt(model.spec, x, y) === clamped) return model;
  const rows = model.spec.elevation.map((row, ry) =>
    ry === y ? row.map((e, rx) => (rx === x ? clamped : e)) : row,
  );
  return withSpec(model, { ...model.spec, elevation: rows });
}

export function nudgeElevation(
  model: CartographerModel,
  x: number,
  y: number,
  delta: number,
): CartographerModel {
  return setElevation(model, x, y, elevationAt(model.spec, x, y) + delta);
}

// Paint a terrain: stores an override, EXCEPT when the painted terrain is
// what the bands already derive — then any override is removed (painting
// "what the rule says" returns the tile to rule-following, so the auto
// derivation stays visible rather than being shadowed by a redundant
// override — the brief's terrain-from-elevation watch-for).
export function paintTerrain(
  model: CartographerModel,
  x: number,
  y: number,
  terrain: TerrainType,
): CartographerModel {
  const spec = model.spec;
  const bandTerrain = terrainForElevation(spec.bands, elevationAt(spec, x, y));
  const others = spec.terrainOverrides.filter((o) => o.x !== x || o.y !== y);
  const overrides =
    terrain === bandTerrain ? others : [...others, { x, y, terrain }];
  return withSpec(model, { ...spec, terrainOverrides: overrides });
}

export function clearTerrainOverride(
  model: CartographerModel,
  x: number,
  y: number,
): CartographerModel {
  const overrides = model.spec.terrainOverrides.filter((o) => o.x !== x || o.y !== y);
  if (overrides.length === model.spec.terrainOverrides.length) return model;
  return withSpec(model, { ...model.spec, terrainOverrides: overrides });
}

export function toggleProperty(
  model: CartographerModel,
  x: number,
  y: number,
  property: string,
): CartographerModel {
  const spec = model.spec;
  const tag = spec.properties.find((p) => p.x === x && p.y === y);
  const has = tag !== undefined && tag.properties.includes(property);
  const nextProps = has
    ? (tag?.properties ?? []).filter((p) => p !== property)
    : [...(tag?.properties ?? []), property];
  const others = spec.properties.filter((p) => p.x !== x || p.y !== y);
  const properties =
    nextProps.length === 0 ? others : [...others, { x, y, properties: nextProps }];
  return withSpec(model, { ...spec, properties });
}

// ---------------------------------------------------------------------------
// Decks (layer-1 stacked cells)
// ---------------------------------------------------------------------------

export function deckAt(
  spec: MapSpec,
  x: number,
  y: number,
): MapSpec['decks'][number] | undefined {
  return spec.decks.find((d) => d.x === x && d.y === y);
}

// Toggle a deck: placing defaults to ground elevation + 2 (the validator's
// BRIDGE_MIN_CLEARANCE floor) with 'bridge' terrain.
export function toggleDeck(model: CartographerModel, x: number, y: number): CartographerModel {
  const spec = model.spec;
  if (deckAt(spec, x, y) !== undefined) {
    return withSpec(model, { ...spec, decks: spec.decks.filter((d) => d.x !== x || d.y !== y) });
  }
  const deck = {
    x,
    y,
    elevation: elevationAt(spec, x, y) + 2,
    terrain: 'bridge',
    properties: [] as ReadonlyArray<string>,
  };
  return withSpec(model, { ...spec, decks: [...spec.decks, deck] });
}

export function setDeckElevation(
  model: CartographerModel,
  x: number,
  y: number,
  elevation: number,
): CartographerModel {
  const decks = model.spec.decks.map((d) =>
    d.x === x && d.y === y ? { ...d, elevation: Math.max(0, Math.round(elevation)) } : d,
  );
  return withSpec(model, { ...model.spec, decks });
}

// ---------------------------------------------------------------------------
// Bands
// ---------------------------------------------------------------------------

export function setBands(
  model: CartographerModel,
  bands: ReadonlyArray<TerrainBand>,
): CartographerModel {
  return withSpec(model, { ...model.spec, bands });
}

// ---------------------------------------------------------------------------
// Map meta
// ---------------------------------------------------------------------------

export function setLabel(model: CartographerModel, label: string): CartographerModel {
  return withSpec(model, { ...model.spec, label });
}

// Rename the map key — the registry entry follows. Refused (model returned
// unchanged) when another map already owns the key; validation surfaces it.
export function setKey(model: CartographerModel, key: string): CartographerModel {
  if (key === model.spec.key) return model;
  if (model.registry.some((e) => e.mapKey === key)) return model;
  const registry = model.registry.map((e) =>
    e.mapKey === model.spec.key ? { ...e, mapKey: key } : e,
  );
  return { spec: { ...model.spec, key }, registry };
}

// Resize, preserving the overlap: new tiles arrive at the default ground
// elevation; overrides, tags, decks, and this map's zone tiles outside the
// new bounds are dropped.
export function resizeMap(
  model: CartographerModel,
  width: number,
  height: number,
): CartographerModel {
  const w = Math.max(1, Math.min(64, Math.round(width)));
  const h = Math.max(1, Math.min(64, Math.round(height)));
  const spec = model.spec;
  const rows: number[][] = [];
  for (let y = 0; y < h; y++) {
    const old = spec.elevation[y];
    const row: number[] = [];
    for (let x = 0; x < w; x++) row.push(old?.[x] ?? DEFAULT_ELEVATION);
    rows.push(row);
  }
  const within = <T extends { readonly x: number; readonly y: number }>(item: T): boolean =>
    item.x < w && item.y < h;
  const nextSpec: MapSpec = {
    ...spec,
    width: w,
    height: h,
    elevation: rows,
    terrainOverrides: spec.terrainOverrides.filter(within),
    properties: spec.properties.filter(within),
    decks: spec.decks.filter(within),
  };
  const registry = model.registry.map((e) =>
    e.mapKey === spec.key
      ? {
          ...e,
          configs: e.configs.map((c) => ({
            ...c,
            teams: c.teams.map((t) => ({
              ...t,
              subZones: t.subZones.map((s) => ({ ...s, tiles: s.tiles.filter(within) })),
            })),
          })),
        }
      : e,
  );
  return { spec: nextSpec, registry };
}

// ---------------------------------------------------------------------------
// Deployment zones (the edited map's 'default' config)
// ---------------------------------------------------------------------------

const emptyDefaultConfig = (): ZoneConfig => ({
  name: 'default',
  teams: [
    { team: 'team_a', subZones: [{ tiles: [] }] },
    { team: 'team_b', subZones: [{ tiles: [] }] },
  ],
});

// The edited map gets a registry entry (with a 'default' config) on first
// zone edit; shipped maps already have one.
function ensureEntry(model: CartographerModel): CartographerModel {
  if (model.registry.some((e) => e.mapKey === model.spec.key)) return model;
  const entry: MapZoneEntry = { mapKey: model.spec.key, configs: [emptyDefaultConfig()] };
  return { ...model, registry: [...model.registry, entry] };
}

function updateDefaultConfig(
  model: CartographerModel,
  fn: (config: ZoneConfig) => ZoneConfig,
): CartographerModel {
  const ensured = ensureEntry(model);
  const registry = ensured.registry.map((e) => {
    if (e.mapKey !== ensured.spec.key) return e;
    const hasDefault = e.configs.some((c) => c.name === 'default');
    const configs = hasDefault ? e.configs : [...e.configs, emptyDefaultConfig()];
    return { ...e, configs: configs.map((c) => (c.name === 'default' ? fn(c) : c)) };
  });
  return { ...ensured, registry };
}

export function defaultZoneConfig(model: CartographerModel): ZoneConfig | undefined {
  return model.registry
    .find((e) => e.mapKey === model.spec.key)
    ?.configs.find((c) => c.name === 'default');
}

// Which (team, subZone) a tile belongs to, if any — zones never overlap.
export function zoneMembership(
  config: ZoneConfig | undefined,
  x: number,
  y: number,
): { team: ZoneTeamKey; subZone: number } | undefined {
  if (config === undefined) return undefined;
  for (const teamEntry of config.teams) {
    for (let i = 0; i < teamEntry.subZones.length; i++) {
      if (teamEntry.subZones[i]!.tiles.some((t) => t.x === x && t.y === y)) {
        return { team: teamEntry.team, subZone: i };
      }
    }
  }
  return undefined;
}

const stripTile = (config: ZoneConfig, x: number, y: number): ZoneConfig => ({
  ...config,
  teams: config.teams.map((t) => ({
    ...t,
    subZones: t.subZones.map((s) => ({
      ...s,
      tiles: s.tiles.filter((p) => p.x !== x || p.y !== y),
    })),
  })),
});

// Paint a tile into a team's sub-zone (removing it from any other zone —
// the engine validator rejects overlaps).
export function zonePaint(
  model: CartographerModel,
  team: ZoneTeamKey,
  subZone: number,
  x: number,
  y: number,
): CartographerModel {
  return updateDefaultConfig(model, (config) => {
    const stripped = stripTile(config, x, y);
    return {
      ...stripped,
      teams: stripped.teams.map((t) =>
        t.team === team
          ? {
              ...t,
              subZones: t.subZones.map((s, i) =>
                i === subZone ? { ...s, tiles: [...s.tiles, { x, y, layer: 0 }] } : s,
              ),
            }
          : t,
      ),
    };
  });
}

export function zoneErase(model: CartographerModel, x: number, y: number): CartographerModel {
  return updateDefaultConfig(model, (config) => stripTile(config, x, y));
}

export function addSubZone(model: CartographerModel, team: ZoneTeamKey): CartographerModel {
  return updateDefaultConfig(model, (config) => ({
    ...config,
    teams: config.teams.map((t) =>
      t.team === team ? { ...t, subZones: [...t.subZones, { tiles: [] }] } : t,
    ),
  }));
}

// Removing a sub-zone keeps at least one per team (a team with no
// sub-zones can never deploy; delete tiles instead).
export function removeSubZone(
  model: CartographerModel,
  team: ZoneTeamKey,
  index: number,
): CartographerModel {
  return updateDefaultConfig(model, (config) => ({
    ...config,
    teams: config.teams.map((t) =>
      t.team === team && t.subZones.length > 1
        ? { ...t, subZones: t.subZones.filter((_, i) => i !== index) }
        : t,
    ),
  }));
}

export function setSubZoneCap(
  model: CartographerModel,
  team: ZoneTeamKey,
  index: number,
  cap: number | undefined,
): CartographerModel {
  return updateDefaultConfig(model, (config) => ({
    ...config,
    teams: config.teams.map((t) =>
      t.team === team
        ? {
            ...t,
            subZones: t.subZones.map((s, i) => {
              if (i !== index) return s;
              const { cap: _dropped, ...rest } = s;
              return cap === undefined ? rest : { ...rest, cap };
            }),
          }
        : t,
    ),
  }));
}

// ---------------------------------------------------------------------------
// Whole-map operations
// ---------------------------------------------------------------------------

export function freshMapModel(
  registry: ReadonlyArray<MapZoneEntry>,
  key = 'untitled_map',
): CartographerModel {
  const width = 16;
  const height = 16;
  const elevation: number[][] = [];
  for (let y = 0; y < height; y++) elevation.push(new Array<number>(width).fill(DEFAULT_ELEVATION));
  const spec: MapSpec = {
    key,
    label: 'Untitled Map',
    width,
    height,
    bands: [...WATER_TABLE_BANDS],
    elevation,
    terrainOverrides: [],
    properties: [],
    decks: [],
  };
  return { spec, registry };
}

// Cartographer — the DEV-gated battle-map editor (`?cartographer`,
// Tier 1: terrain + deployment core; the S98 map-authoring brief).
//
// Paint elevation on a pan-zoom tile canvas; terrain auto-derives from
// the map's band rules with per-tile overrides; tag properties; paint
// player/enemy deployment zones (sub-zones + caps carried in full
// fidelity); toggle bridge decks. Live validation runs the REAL engine
// validators (+ a connectivity advisory); preview mounts the REAL battle
// renderer; export emits the generated map module + the wholesale
// deployment-zone registry. Draft persists in localStorage; "Reset"
// re-imports the shipped modules. Enemy-party placement is the designed
// second mode — a fast-follow tier (Chris's S98 call), not built here.

import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { CartographerModel } from './model.ts';
import { importZoneRegistry, SHIPPED_MAP_SPECS, shippedMapSpec } from './import.ts';
import { validateModel } from './validate.ts';
import {
  addSubZone,
  clearTerrainOverride,
  freshMapModel,
  nudgeElevation,
  paintTerrain,
  removeSubZone,
  resizeMap,
  setBands,
  setDeckElevation,
  setElevation,
  setKey,
  setLabel,
  setSubZoneCap,
  toggleDeck,
  toggleProperty,
  zoneErase,
  zonePaint,
} from './edit.ts';
import { clearDraft, loadDraft, saveDraft } from './storage.ts';
import { CartographerCanvas, type Brush } from './CartographerCanvas.tsx';
import { CartographerInspector } from './CartographerInspector.tsx';
import { CartographerPreview } from './CartographerPreview.tsx';
import { CartographerExport } from './CartographerExport.tsx';

const DEFAULT_DEPLOY_COUNT = 5; // the v1 roster maximum per side

const shippedModel = (key: string): CartographerModel => {
  const spec = shippedMapSpec(key);
  if (spec === undefined) throw new Error(`cartographer: unknown shipped map '${key}'`);
  return { spec, registry: importZoneRegistry() };
};

export function CartographerApp(): ReactElement {
  const [model, setModel] = useState<CartographerModel>(
    () => loadDraft() ?? shippedModel(SHIPPED_MAP_SPECS[0]!.key),
  );
  const [brush, setBrush] = useState<Brush>({ kind: 'inspect' });
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [deployCount, setDeployCount] = useState(DEFAULT_DEPLOY_COUNT);
  const [overlay, setOverlay] = useState<'preview' | 'export' | null>(null);

  useEffect(() => saveDraft(model), [model]);

  const findings = useMemo(() => validateModel(model, deployCount), [model, deployCount]);
  const errors = findings.filter((f) => f.level === 'error');

  const paint = (x: number, y: number): void => {
    setModel((m) => {
      switch (brush.kind) {
        case 'inspect':
          return m;
        case 'elevation':
          return setElevation(m, x, y, brush.value);
        case 'elevation-nudge':
          return nudgeElevation(m, x, y, brush.delta);
        case 'terrain':
          return paintTerrain(m, x, y, brush.terrain);
        case 'terrain-clear':
          return clearTerrainOverride(m, x, y);
        case 'property':
          return toggleProperty(m, x, y, brush.property);
        case 'zone':
          return zonePaint(m, brush.team, brush.subZone, x, y);
        case 'zone-erase':
          return zoneErase(m, x, y);
        case 'deck-toggle':
          return toggleDeck(m, x, y);
      }
    });
  };

  const handleLoad = (value: string): void => {
    const fresh = value === '__new__';
    if (
      !window.confirm(
        `Discard the current draft and ${fresh ? 'start a new map' : `load '${value}'`}?`,
      )
    ) {
      return;
    }
    setModel(fresh ? freshMapModel(importZoneRegistry()) : shippedModel(value));
    setSelected(null);
    setBrush({ kind: 'inspect' });
  };

  const handleReset = (): void => {
    if (!window.confirm('Discard the draft and re-import the shipped modules?')) return;
    clearDraft();
    setModel(shippedModel(SHIPPED_MAP_SPECS[0]!.key));
    setSelected(null);
    setBrush({ kind: 'inspect' });
  };

  return (
    <div style={rootStyle}>
      <div style={toolbarStyle}>
        <span style={brandStyle}>Cartographer</span>
        <span style={subbrandStyle}>battle-map editor — terrain + deployment tier</span>
        <select
          style={selectStyle}
          value={shippedMapSpec(model.spec.key) !== undefined ? model.spec.key : '__custom__'}
          onChange={(e) => handleLoad(e.target.value)}
        >
          {SHIPPED_MAP_SPECS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
          <option value="__custom__" disabled>
            {model.spec.label} (draft)
          </option>
          <option value="__new__">+ New map…</option>
        </select>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          style={buttonStyle}
          disabled={errors.length > 0}
          title={errors.length > 0 ? 'Fix validation errors first' : 'Preview on the real battle renderer'}
          onClick={() => setOverlay('preview')}
        >
          Preview
        </button>
        <button
          type="button"
          style={primaryStyle}
          disabled={errors.length > 0}
          title={errors.length > 0 ? 'Fix validation errors first' : 'Generate the map module + zone registry'}
          onClick={() => setOverlay('export')}
        >
          Export{errors.length > 0 ? ` (${errors.length} error${errors.length === 1 ? '' : 's'})` : ''}
        </button>
        <button type="button" style={buttonStyle} onClick={handleReset}>
          Reset to shipped
        </button>
      </div>

      <div style={mainStyle}>
        <div
          style={canvasWrapStyle}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setBrush({ kind: 'inspect' });
          }}
          tabIndex={-1}
        >
          <CartographerCanvas
            key={`${model.spec.key}:${model.spec.width}x${model.spec.height}`}
            model={model}
            brush={brush}
            selected={selected}
            onPaint={paint}
            onSelectTile={setSelected}
          />
        </div>
        <CartographerInspector
          model={model}
          brush={brush}
          selected={selected}
          deployCount={deployCount}
          onBrush={setBrush}
          onDeployCount={setDeployCount}
          onSetLabel={(label) => setModel((m) => setLabel(m, label))}
          onSetKey={(key) => setModel((m) => setKey(m, key))}
          onResize={(w, h) => setModel((m) => resizeMap(m, w, h))}
          onSetBands={(bands) => setModel((m) => setBands(m, bands))}
          onAddSubZone={(team) => setModel((m) => addSubZone(m, team))}
          onRemoveSubZone={(team, i) => setModel((m) => removeSubZone(m, team, i))}
          onSetSubZoneCap={(team, i, cap) => setModel((m) => setSubZoneCap(m, team, i, cap))}
          onSetDeckElevation={(x, y, e) => setModel((m) => setDeckElevation(m, x, y, e))}
        />
      </div>

      <div style={validationStyle}>
        {findings.length === 0 ? (
          <span style={okStyle}>✓ Valid — terrain, zones, and connectivity all clear</span>
        ) : (
          findings.map((f, i) => (
            <span key={i} style={f.level === 'error' ? findingErrorStyle : findingWarnStyle}>
              {f.level === 'error' ? '✕' : '△'} {f.message}
            </span>
          ))
        )}
      </div>

      {overlay === 'preview' && (
        <CartographerPreview model={model} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'export' && <CartographerExport model={model} onClose={() => setOverlay(null)} />}
    </div>
  );
}

// ---- styles (Atlas idiom) ----

const rootStyle: CSSProperties = {
  position: 'relative',
  width: '100vw',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#0e0f12',
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  overflow: 'hidden',
};

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  borderBottom: '1px solid #2c2f36',
  background: '#16181d',
};

const brandStyle: CSSProperties = { fontSize: 16, fontWeight: 700, color: '#d8b26c' };
const subbrandStyle: CSSProperties = { fontSize: 12, color: '#6b707b' };

const buttonStyle: CSSProperties = {
  padding: '7px 12px',
  fontSize: 13,
  borderRadius: 4,
  border: '1px solid #2c2f36',
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#1c1e23',
  color: '#c7ccd6',
};

const primaryStyle: CSSProperties = {
  ...buttonStyle,
  background: 'rgba(216,178,108,.1)',
  color: '#d8b26c',
  borderColor: '#8f7644',
};

const selectStyle: CSSProperties = {
  ...buttonStyle,
  padding: '6px 8px',
};

const mainStyle: CSSProperties = { flex: 1, display: 'flex', minHeight: 0 };
const canvasWrapStyle: CSSProperties = { flex: 1, minWidth: 0, outline: 'none' };

const validationStyle: CSSProperties = {
  maxHeight: 110,
  overflowY: 'auto',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  padding: '8px 16px',
  borderTop: '1px solid #2c2f36',
  background: '#16181d',
  fontSize: 12,
};

const okStyle: CSSProperties = { color: '#7fb58a' };

const findingBaseStyle: CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  borderRadius: 4,
};

const findingErrorStyle: CSSProperties = { ...findingBaseStyle, color: '#d88f8f', border: '1px solid #5a3535' };
const findingWarnStyle: CSSProperties = { ...findingBaseStyle, color: '#d8b26c', border: '1px solid #8f7644' };

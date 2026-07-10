// FormationScreen — the campaign's deploy-selection step (TABA M0).
//
// Picks up to K of the N `active` roster units to bring into the upcoming
// node. The minimal campaign-side UI M0 builds: a thin selection list over
// `CampaignUnit[]` that feeds the existing deployment phase (the chosen
// units are folded into the node template, then DeploymentScreen places
// them). N/K are parameters — the cap is the node's `deployCap`.

import { useState, type CSSProperties, type ReactElement } from 'react';
import type { CampaignUnit } from '@campaign/index.ts';
import type { Catalog, ClassId } from '@engine/index.ts';
import { unitLegality } from './formation/gear-view-model.ts';

export interface FormationScreenProps {
  readonly nodeName: string;
  readonly roster: ReadonlyArray<CampaignUnit>; // `active` units only
  readonly deployCap: number; // K
  // For class display names — kept consistent with the deployment roster
  // panel (catalog name, e.g. "Geosage", not the raw id "earth_mage").
  readonly catalog: Catalog;
  readonly onConfirm: (selected: ReadonlyArray<CampaignUnit>) => void;
  readonly onQuit: () => void;
}

export function FormationScreen({
  nodeName,
  roster,
  deployCap,
  catalog,
  onConfirm,
  onQuit,
}: FormationScreenProps): ReactElement {
  const classLabel = (classId: ClassId): string =>
    catalog.hasClass(classId) ? catalog.getClass(classId).name : String(classId);
  // M3 Stage 2 — battle entry is BLOCKED for invalid loadouts (the same
  // shared-resolver verdict the Loadout tab surfaces; createInitialState
  // would throw on these, so they never reach the fold). The unit stays
  // listed with its warning — the player fixes it in Manage Roster.
  const invalidIds = new Set(
    roster.filter((u) => !unitLegality(u, catalog).valid).map((u) => u.id),
  );
  // Pre-select the first K deployable so the screen has a valid default.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        roster
          .filter((u) => !invalidIds.has(u.id))
          .slice(0, deployCap)
          .map((u) => u.id),
      ),
  );

  const atCap = selectedIds.size >= deployCap;

  function toggle(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < deployCap) next.add(id);
      return next;
    });
  }

  const selected = roster.filter((u) => selectedIds.has(u.id));
  const canDeploy = selected.length >= 1 && selected.length <= deployCap;

  return (
    <div style={rootStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Formation — {nodeName}</h1>
          <div style={subtitleStyle}>Deploy up to {deployCap} of {roster.length} units</div>
        </div>

        <ul style={listStyle}>
          {roster.map((u) => {
            const invalid = invalidIds.has(u.id);
            const on = selectedIds.has(u.id);
            const disabled = invalid || (!on && atCap);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => toggle(u.id)}
                  disabled={disabled}
                  title={invalid ? 'Loadout invalid — fix it in Manage Roster before deploying' : undefined}
                  style={{
                    ...rowStyle,
                    ...(on ? rowSelectedStyle : null),
                    ...(disabled ? rowDisabledStyle : null),
                  }}
                  aria-pressed={on}
                >
                  <span style={invalid ? warnCheckStyle : checkStyle}>{invalid ? '⚠' : on ? '✓' : ''}</span>
                  <span style={nameStyle}>{u.name}</span>
                  <span style={metaStyle}>{classLabel(u.classId)}</span>
                  <span style={metaStyle}>Lv {u.level}</span>
                  <span style={metaStyle}>
                    {invalid ? 'loadout invalid' : `HP ${u.vitals.hp} · MP ${u.vitals.mp}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div style={footerStyle}>
          <span style={countStyle}>
            {selected.length} / {deployCap} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={secondaryButtonStyle} onClick={onQuit}>
              Quit to Title
            </button>
            <button
              type="button"
              style={canDeploy ? primaryButtonStyle : disabledButtonStyle}
              disabled={!canDeploy}
              onClick={() => onConfirm(selected)}
            >
              Deploy →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- styles ----

const rootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0e0f12',
};

const panelStyle: CSSProperties = {
  width: 560,
  maxHeight: '86vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#16181d',
  border: '1px solid #2c2f36',
  borderRadius: 8,
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #2c2f36',
};

const titleStyle: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 600 };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: 13, color: '#9aa0ac' };

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 8,
  overflowY: 'auto',
  flex: 1,
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px 1.4fr 1.2fr 56px 1.4fr',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '10px 12px',
  margin: '2px 0',
  textAlign: 'left',
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#e7e9ee',
  background: '#1c1e23',
  border: '1px solid #2c2f36',
  borderRadius: 5,
  cursor: 'pointer',
};

const rowSelectedStyle: CSSProperties = {
  background: '#243042',
  borderColor: '#3d5170',
};

const rowDisabledStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

const checkStyle: CSSProperties = { color: '#7fb2ff', fontWeight: 700 };
const warnCheckStyle: CSSProperties = { color: '#e2965f', fontWeight: 700 };
const nameStyle: CSSProperties = { fontWeight: 600 };
const metaStyle: CSSProperties = { color: '#9aa0ac' };

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 20px',
  borderTop: '1px solid #2c2f36',
};

const countStyle: CSSProperties = { fontSize: 13, color: '#9aa0ac' };

const buttonBaseStyle: CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#2a3140',
  color: '#e7e9ee',
  borderColor: '#3a4150',
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#1c1e23',
  color: '#c7ccd6',
  borderColor: '#2c2f36',
  cursor: 'pointer',
};

const disabledButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#1c1e23',
  color: '#888',
  borderColor: '#2c2f36',
  cursor: 'not-allowed',
  opacity: 0.55,
};

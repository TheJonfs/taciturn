// Training — the JP-spend tab (TABA M2 UI, dossier View 2).
//
// The current class's unlockable components as typed, grouped, priced rows:
// Items (Alchemist) · Math Skill (Calculator params/values) · Command Set
// (actives) · Passives (R/S/M). "Learn" spends the class purse via the parent's
// `onBuy` (which runs `purchaseComponent` — spend + any threshold-cross grant).
// Row states convey the ability-type semantics:
//   - actives/items/math = unlock-to-USE ("Learn · X JP" → "✓ Learned").
//   - R/S/M passives = two states ("Learn · X JP" → "✓ Innate" + a carry note);
//     enabler passives (Expert Former, Mathematician) note their command-set
//     condition but are never blocked.

import { type ReactElement } from 'react';
import type { Catalog, ClassId } from '@engine/index.ts';
import { COMPONENT_CATALOG, type CampaignUnit, type ComponentCatalog, type UnlockToken } from '@campaign/index.ts';
import { DOMAIN_COLOR } from './roster-view-model.ts';
import { tierEntryOf } from '@campaign/index.ts';
import {
  TYPE_NAME,
  buildTrainingGroups,
  type ComponentType,
  type TrainingRow,
} from './training-view-model.ts';

export interface TrainingProps {
  readonly unit: CampaignUnit;
  readonly catalog: Catalog;
  // The class whose tree is being viewed/spent — set by the constellation star
  // click (or the unit's current class by default). Spending a class's JP does
  // not require BEING that class (JP is per-class); you just need to have earned
  // it, which happens by being that class in battle.
  readonly classId: ClassId;
  readonly onBuy: (token: UnlockToken) => void;
  // True when the viewed class isn't the unit's current class — surfaced as a note.
  readonly isCurrentClass?: boolean;
  readonly componentCatalog?: ComponentCatalog;
}

export function Training({
  unit,
  catalog,
  classId,
  onBuy,
  isCurrentClass = true,
  componentCatalog = COMPONENT_CATALOG,
}: TrainingProps): ReactElement {
  const className = catalog.getClass(classId).name;
  const col = DOMAIN_COLOR[tierEntryOf(classId).half];
  const g = buildTrainingGroups(unit, classId, catalog, componentCatalog);

  return (
    <div>
      <div className="tf-train-head">
        {className} purse: <b>{g.purse.toLocaleString()} JP</b> · {g.affordableCount} affordable now ·
        spendable only on {className}
        {isCurrentClass ? null : (
          <span className="tf-train-note"> · not your current class — reclass on the Loadout tab to earn its JP</span>
        )}
      </div>

      {g.items.length > 0 ? (
        <Section
          title="Items"
          note="Compound & Throw Item are always ready — unlock items to fill them"
          col={col}
          rows={g.items}
          onBuy={onBuy}
        />
      ) : null}
      {g.math.length > 0 ? (
        <Section
          title="Math Skill"
          note="The cast is always ready — unlock Parameters and Values to aim it"
          col={col}
          rows={g.math}
          onBuy={onBuy}
        />
      ) : null}
      {g.actives.length > 0 ? (
        <Section
          title="Command Set"
          note={`Actives — unlock to wield as ${className}`}
          col={col}
          rows={g.actives}
          onBuy={onBuy}
        />
      ) : null}
      {g.passives.length > 0 ? (
        <Section
          title="Passives"
          note="Reaction · Support · Movement — the JP price also carries one onto another class"
          col={col}
          rows={g.passives}
          onBuy={onBuy}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  note,
  col,
  rows,
  onBuy,
}: {
  readonly title: string;
  readonly note: string;
  readonly col: string;
  readonly rows: ReadonlyArray<TrainingRow>;
  readonly onBuy: (token: UnlockToken) => void;
}): ReactElement {
  return (
    <div className="tf-sec">
      <div className="tf-sech">
        <h3 style={{ color: col }}>{title}</h3>
        <p>{note}</p>
      </div>
      {rows.map((row) => (
        <Row key={row.key} row={row} onBuy={onBuy} />
      ))}
    </div>
  );
}

function Row({ row, onBuy }: { readonly row: TrainingRow; readonly onBuy: (token: UnlockToken) => void }): ReactElement {
  return (
    <div className={`tf-abil${row.learned ? ' have' : ''}`}>
      <div className="tf-aico" title={TYPE_NAME[row.type]}>
        <TypeGlyph type={row.type} />
      </div>
      <div className="tf-ainfo">
        <div className="tf-anm">{row.name}</div>
        <div className="tf-afx">
          {row.effect}
          {row.condition && !row.learned ? (
            <>
              {row.effect ? ' · ' : ''}
              <span className="tf-cond">needs {row.condition}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="tf-aright">
        <RowState row={row} onBuy={onBuy} />
      </div>
    </div>
  );
}

function RowState({ row, onBuy }: { readonly row: TrainingRow; readonly onBuy: (token: UnlockToken) => void }): ReactElement {
  if (row.learned) {
    if (row.isPassive) {
      return (
        <div className="tf-havet">
          <span className="k">✓ Innate</span>
          <span className="e">{row.condition ? `works with ${row.condition} equipped` : 'carries to other classes'}</span>
        </div>
      );
    }
    return (
      <div className="tf-havet">
        <span className="k">✓ Learned</span>
      </div>
    );
  }
  if (row.affordable) {
    return (
      <button type="button" className="tf-buy" onClick={() => onBuy(row.token)}>
        Learn · {row.cost} JP
      </button>
    );
  }
  return (
    <button type="button" className="tf-buy no" disabled>
      {row.cost} JP · short {row.shortBy}
    </button>
  );
}

// Type glyphs, ported from the celestial-2 mockup ICON set.
function TypeGlyph({ type }: { readonly type: ComponentType }): ReactElement {
  switch (type) {
    case 'A':
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <path d="M8 1.5l1.5 4.9 4.9 1.6-4.9 1.6L8 14.5 6.5 9.6 1.6 8l4.9-1.6z" fill="currentColor" />
        </svg>
      );
    case 'R':
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <path d="M8 1.5l5.4 2v4c0 4-5.4 6.5-5.4 6.5S2.6 11.5 2.6 7.5v-4z" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    case 'S':
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'M':
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <path d="M2.5 8h9M8 4.5l3.6 3.5-3.6 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'I':
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <path d="M6.4 2h3.2M7 2v3.6L4.2 11a2 2 0 0 0 1.8 3h4a2 2 0 0 0 1.8-3L9 5.6V2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'PA':
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <circle cx="8" cy="8" r="4.3" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 1v2.6M8 12.4V15M1 8h2.6M12.4 8H15" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'VA':
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <path d="M6 2.5 4.6 13.5M11.4 2.5 10 13.5M3 6h11M2.5 10h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
  }
}

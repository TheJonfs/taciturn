// ShopScreen — the hub commerce surface (TABA M3 economy, Stage 2).
//
// Two ledgers over the same wallet: BUY from the cumulative story-gated
// stock (every purchase routes through the campaign's buyItem → the
// grantItems receipt door), SELL free inventory instances back at the
// config sell rate (uniques blocked, equipped gear must be unequipped
// first — the block REASON is surfaced on the row, not hidden). A detail
// panel shows the hovered item's full mechanical text (`formatItemDetail`,
// the same source the battle panel reads) so purchases aren't blind.

import { useState, type CSSProperties, type ReactElement } from 'react';
import { useEscapeBack } from './use-escape-back.ts';
import type { Catalog, ItemId } from '@engine/index.ts';
import {
  SELL_RATE,
  freeCount,
  itemPrice,
  ownedCount,
  sellBlockReason,
  sellValue,
  type CampaignState,
  type TabaGearEntry,
} from '@campaign/index.ts';
import { formatItemDetail } from '@ui/index.ts';

export interface ShopScreenProps {
  readonly nodeName: string;
  readonly state: CampaignState;
  readonly stock: ReadonlyArray<TabaGearEntry>;
  readonly catalog: Catalog;
  readonly onBuy: (itemId: ItemId) => void;
  readonly onSell: (itemId: ItemId) => void;
  readonly onExit: () => void;
}

export function ShopScreen({
  nodeName,
  state,
  stock,
  catalog,
  onBuy,
  onSell,
  onExit,
}: ShopScreenProps): ReactElement {
  const [hovered, setHovered] = useState<ItemId | null>(null);
  useEscapeBack(onExit); // S100: ESC leaves the shop, same as the Leave button

  const itemName = (id: ItemId): string => (catalog.hasItem(id) ? catalog.getItem(id).name : String(id));

  // Sellable ledger: everything the party owns, in catalog-name order.
  const owned = Object.keys(state.inventory)
    .map((id) => id as ItemId)
    .sort((a, b) => itemName(a).localeCompare(itemName(b)));

  const detail = hovered !== null && catalog.hasItem(hovered) ? formatItemDetail(catalog.getItem(hovered), catalog) : null;

  return (
    <div style={rootStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>{nodeName} — Shop</h1>
            {/* S95 (WI4): per-hub stock (S94) — the subtitle speaks in the
                town's voice, not the old global-pool's. */}
            <div style={subtitleStyle}>{nodeName} keeps its own shelves. They only ever grow.</div>
          </div>
          <div style={purseStyle} aria-label="Party gil">
            {state.gil} gil
          </div>
        </div>

        <div style={bodyStyle}>
          <section style={columnStyle} aria-label="Buy">
            <h2 style={columnTitleStyle}>Buy</h2>
            <ul style={listStyle}>
              {stock.map((entry) => {
                const price = itemPrice(entry.itemId);
                const affordable = state.gil >= price;
                return (
                  <li
                    key={String(entry.itemId)}
                    style={rowStyle}
                    onMouseEnter={() => setHovered(entry.itemId)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span style={nameStyle}>
                      {itemName(entry.itemId)}
                      {ownedCount(state, entry.itemId) > 0 && (
                        <span style={ownedTagStyle}> owned ×{ownedCount(state, entry.itemId)}</span>
                      )}
                    </span>
                    <span style={priceStyle}>{price} gil</span>
                    <button
                      type="button"
                      style={affordable ? actionStyle : actionDisabledStyle}
                      disabled={!affordable}
                      title={affordable ? undefined : 'Not enough gil'}
                      onClick={() => onBuy(entry.itemId)}
                    >
                      Buy
                    </button>
                  </li>
                );
              })}
              {stock.length === 0 && <li style={emptyStyle}>Nothing in stock yet — clear more of the campaign.</li>}
            </ul>
          </section>

          <section style={columnStyle} aria-label="Sell">
            <h2 style={columnTitleStyle}>Sell — {Math.round(SELL_RATE * 100)}% of value</h2>
            <ul style={listStyle}>
              {owned.map((id) => {
                const blocked = sellBlockReason(state, id);
                const free = freeCount(state, id);
                return (
                  <li
                    key={String(id)}
                    style={rowStyle}
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span style={nameStyle}>
                      {itemName(id)}
                      <span style={ownedTagStyle}>
                        {' '}
                        ×{ownedCount(state, id)}
                        {free < ownedCount(state, id) ? ` (${free} free)` : ''}
                      </span>
                    </span>
                    <span style={priceStyle}>{sellValue(id)} gil</span>
                    <button
                      type="button"
                      style={blocked === undefined ? actionStyle : actionDisabledStyle}
                      disabled={blocked !== undefined}
                      title={blocked}
                      onClick={() => onSell(id)}
                    >
                      Sell
                    </button>
                  </li>
                );
              })}
              {owned.length === 0 && <li style={emptyStyle}>The party owns nothing to sell.</li>}
            </ul>
          </section>

          <aside style={detailStyle} aria-label="Item detail">
            {detail === null ? (
              <div style={detailHintStyle}>Hover an item to inspect it.</div>
            ) : (
              <>
                <div style={detailTitleStyle}>{detail.title}</div>
                {detail.subtitle !== undefined && <div style={detailSubtitleStyle}>{detail.subtitle}</div>}
                {detail.lines.map((line, i) => (
                  <div key={i} style={detailLineStyle}>
                    {line}
                  </div>
                ))}
              </>
            )}
          </aside>
        </div>

        <div style={footerStyle}>
          <button type="button" style={secondaryStyle} onClick={onExit}>
            ← Leave the Shop
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- styles (shop panel: the location-menu family, widened) ----

const rootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0e0f12',
};

const panelStyle: CSSProperties = {
  width: 940,
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#16181d',
  border: '1px solid #2c2f36',
  borderRadius: 8,
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #2c2f36',
};

const titleStyle: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 600 };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: 13, color: '#9aa0ac' };
const purseStyle: CSSProperties = { fontSize: 14, fontWeight: 600, color: '#d8b26c', whiteSpace: 'nowrap' };

const bodyStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 1.2fr 1fr',
  gap: 0,
  minHeight: 0,
};

const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  borderRight: '1px solid #23262d',
  padding: '12px 14px',
};

const columnTitleStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#9aa0ac',
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  overflowY: 'auto',
  maxHeight: '52vh',
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto auto',
  alignItems: 'center',
  gap: 8,
  padding: '6px 4px',
  fontSize: 13,
  borderBottom: '1px solid #1d2027',
};

const nameStyle: CSSProperties = { fontWeight: 600, color: '#e7e9ee' };
const ownedTagStyle: CSSProperties = { fontWeight: 400, fontSize: 11, color: '#9aa0ac' };
const priceStyle: CSSProperties = { color: '#d8b26c', whiteSpace: 'nowrap', fontSize: 12 };
const emptyStyle: CSSProperties = { padding: '10px 4px', fontSize: 13, color: '#6b707b' };

const actionStyle: CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  fontFamily: 'inherit',
  borderRadius: 4,
  border: '1px solid #3a4150',
  background: '#2a3140',
  color: '#e7e9ee',
  cursor: 'pointer',
};

const actionDisabledStyle: CSSProperties = {
  ...actionStyle,
  background: '#1c1e23',
  color: '#6b707b',
  cursor: 'not-allowed',
};

const detailStyle: CSSProperties = {
  padding: '12px 14px',
  fontSize: 12,
  color: '#c7ccd6',
  overflowY: 'auto',
  maxHeight: '56vh',
};

const detailHintStyle: CSSProperties = { color: '#6b707b', fontSize: 12 };
const detailTitleStyle: CSSProperties = { fontWeight: 700, fontSize: 13, color: '#e7e9ee', marginBottom: 2 };
const detailSubtitleStyle: CSSProperties = { color: '#9aa0ac', marginBottom: 6 };
const detailLineStyle: CSSProperties = { marginBottom: 3, lineHeight: 1.4 };

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-start',
  padding: '14px 20px',
  borderTop: '1px solid #2c2f36',
};

const secondaryStyle: CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#1c1e23',
  color: '#c7ccd6',
  borderColor: '#2c2f36',
};

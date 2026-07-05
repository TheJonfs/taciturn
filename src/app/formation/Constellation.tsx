// Constellation — the reclass star-chart tab (TABA M2 UI, dossier View 2).
//
// Renders the class tree as a star-chart from the pure layout. Each class is a
// star whose state comes STRAIGHT off the selectors:
//   - openness  = `reclassableClasses` (the single source of truth — never
//     re-derived here; that was the mockup's click-bug),
//   - brightness/size = `spentInClass` (the derived class-spend),
//   - current   = the unit's `classId` (brass halo),
//   - locked    = dashed, with `lockReason` copy naming the shortfall.
// The two aggregate cards read `spentByTierSlot`. Clicking any OPEN star asks
// the dossier to train there (reclass if not current).

import { useMemo, type ReactElement } from 'react';
import type { Catalog, ClassId } from '@engine/index.ts';
import {
  reclassableClasses,
  spentByTierSlot,
  spentInClass,
  type CampaignUnit,
  type ComponentCatalog,
} from '@campaign/index.ts';
import { DOMAIN_COLOR } from './roster-view-model.ts';
import {
  BANDS,
  COLUMNS,
  HYBRID_CAPSTONE,
  STAR_LAYOUT,
  VIEW_H,
  VIEW_W,
  aggregateCard,
  lockReason,
  type AggregateCard,
  type StarNode,
} from './constellation-layout.ts';

const BRASS = '#d8b26c';
const LOCKED = '#5f6997';

export interface ConstellationProps {
  readonly unit: CampaignUnit;
  readonly catalog: Catalog;
  readonly componentCatalog: ComponentCatalog;
  readonly onPickClass: (id: ClassId) => void;
  readonly justIgnited?: ClassId | null; // class that just crossed a threshold (ignite anim)
}

export function Constellation({
  unit,
  catalog,
  componentCatalog,
  onPickClass,
  justIgnited = null,
}: ConstellationProps): ReactElement {
  const open = useMemo(
    () => new Set(reclassableClasses(unit, componentCatalog).map(String)),
    [unit, componentCatalog],
  );
  const tierSpend = useMemo(() => spentByTierSlot(unit, componentCatalog), [unit, componentCatalog]);
  const className = (id: ClassId): string =>
    catalog.hasClass(id) ? catalog.getClass(id).name : String(id);

  // Faint, stable star-dust (generated once).
  const dust = useMemo(
    () =>
      Array.from({ length: 32 }, () => ({
        x: Math.random() * VIEW_W,
        y: Math.random() * (VIEW_H - 45),
        r: Math.random() * 0.9 + 0.4,
        o: Math.random() * 0.22 + 0.05,
      })),
    [],
  );

  // Draw least-invested first so bright stars layer on top.
  const ordered = useMemo(
    () =>
      [...STAR_LAYOUT].sort(
        (a, b) => spentInClass(unit, a.classId, componentCatalog) - spentInClass(unit, b.classId, componentCatalog),
      ),
    [unit, componentCatalog],
  );

  // Openness is per tier-SLOT (a whole tier opens at once), so a locked slot's
  // reason is identical for every class in it. Render it ONCE, centred under the
  // slot, rather than duplicated (and overlapping) under each star.
  const lockedSlots = useMemo(() => {
    const bySlot = new Map<string, StarNode[]>();
    for (const n of STAR_LAYOUT) {
      if (open.has(String(n.classId))) continue;
      const list = bySlot.get(n.slot) ?? [];
      list.push(n);
      bySlot.set(n.slot, list);
    }
    return [...bySlot.values()].map((nodes) => {
      const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
      return { x: cx, y: nodes[0]!.y, reason: lockReason(nodes[0]!, tierSpend) };
    });
  }, [open, tierSpend]);

  return (
    <div>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="Class constellation: each class is a star whose brightness is the JP invested in it.">
        {dust.map((d, i) => (
          <circle key={`d${i}`} cx={d.x.toFixed(0)} cy={d.y.toFixed(0)} r={d.r.toFixed(1)} fill="#cfd6f5" opacity={d.o.toFixed(2)} />
        ))}

        {BANDS.map((b) => (
          <g key={b.label}>
            <line x1={150} y1={b.y} x2={866} y2={b.y} stroke="#2a3260" strokeWidth={1} opacity={0.45} strokeDasharray="2 5" />
            <text className="tf-band" x={16} y={b.y + 3}>{b.label}</text>
          </g>
        ))}

        {COLUMNS.map((c) => (
          <line key={c.half} x1={c.x} y1={92} x2={c.x} y2={440} stroke={DOMAIN_COLOR[c.half]} strokeWidth={1} opacity={0.12} strokeDasharray="1 6" />
        ))}
        {COLUMNS.map((c) => (
          <text key={`l${c.half}`} className="tf-dom" x={c.x} y={500} fill={DOMAIN_COLOR[c.half]}>{c.label}</text>
        ))}

        {/* Empty hybrid-T3 capstone seam — honest about the undesigned slot. */}
        <g opacity={0.5}>
          <circle cx={HYBRID_CAPSTONE.x} cy={HYBRID_CAPSTONE.y} r={5} fill="none" stroke={LOCKED} strokeWidth={1} strokeDasharray="1 3" />
          <text className="tf-why" x={HYBRID_CAPSTONE.x} y={HYBRID_CAPSTONE.y + 29}>capstone — unforged</text>
        </g>

        {lockedSlots.map((s) => (
          <text key={`r${s.x}-${s.y}`} className="tf-why" x={s.x} y={s.y + 35}>{s.reason}</text>
        ))}

        {ordered.map((node) => (
          <Star
            key={String(node.classId)}
            node={node}
            name={className(node.classId)}
            isOpen={open.has(String(node.classId))}
            isCurrent={node.classId === unit.classId}
            spent={spentInClass(unit, node.classId, componentCatalog)}
            justIgnited={justIgnited === node.classId}
            onPick={onPickClass}
          />
        ))}
      </svg>

      <div className="tf-cap">
        Each star's brightness is the JP invested in that class.{' '}
        <b>Bright = built up · thin outline = open to train · dashed = locked (with what opens it).</b>{' '}
        Tap any lit star to train there.
      </div>

      <div className="tf-aggr">
        <AggregateCardView card={aggregateCard('physical', tierSpend)} />
        <AggregateCardView card={aggregateCard('magical', tierSpend)} />
      </div>
    </div>
  );
}

function Star({
  node,
  name,
  isOpen,
  isCurrent,
  spent,
  justIgnited,
  onPick,
}: {
  readonly node: StarNode;
  readonly name: string;
  readonly isOpen: boolean;
  readonly isCurrent: boolean;
  readonly spent: number;
  readonly justIgnited: boolean;
  readonly onPick: (id: ClassId) => void;
}): ReactElement {
  const col = DOMAIN_COLOR[node.half];
  const visited = spent > 0;
  const r = visited ? Math.min(6 + (spent / 900) * 14, 20) : 6;
  const { x, y } = node;
  const ny = y + r + 16;

  let body: ReactElement;
  if (!isOpen) {
    body = <circle cx={x} cy={y} r={5} fill="none" stroke="#3d456e" strokeWidth={1} strokeDasharray="2 3" />;
  } else if (isCurrent) {
    body = (
      <>
        <circle cx={x} cy={y} r={r + 13} fill={col} opacity={0.1} />
        <circle cx={x} cy={y} r={r + 5} fill="none" stroke={BRASS} strokeWidth={1} opacity={0.85} />
        <circle cx={x} cy={y} r={r} fill={col} />
        <circle cx={x} cy={y} r={r * 0.42} fill="#fff" opacity={0.85} />
      </>
    );
  } else if (visited) {
    body = (
      <>
        <circle cx={x} cy={y} r={r + 9} fill={col} opacity={Number((0.1 + (spent / 900) * 0.14).toFixed(2))} />
        <circle cx={x} cy={y} r={r} fill={col} opacity={Number((0.55 + (spent / 900) * 0.45).toFixed(2))} />
        <circle cx={x} cy={y} r={r * 0.4} fill="#fff" opacity={0.65} />
      </>
    );
  } else {
    body = (
      <>
        <circle cx={x} cy={y} r={r + 7} fill={col} opacity={0.05} />
        <circle cx={x} cy={y} r={r} fill="none" stroke={col} strokeWidth={1.4} opacity={0.85} />
      </>
    );
  }

  const labelColor = isOpen ? col : LOCKED;
  // Locked stars' shortfall copy is rendered once per slot by the parent (it is
  // identical across a slot); here a locked star shows only its dashed marker +
  // name. Open stars show their per-class spend / "not yet trained".
  let sub: ReactElement | null = null;
  if (isOpen && visited) {
    sub = <text className="tf-jpt" x={x} y={ny + 13}>{spent.toLocaleString()} JP</text>;
  } else if (isOpen) {
    sub = <text className="tf-jpt" x={x} y={ny + 13} fill={col} opacity={0.7}>untrained</text>;
  }

  return (
    <g
      className={`tf-starg${isOpen ? ' pick' : ''}${justIgnited ? ' tf-newly' : ''}`}
      onClick={isOpen ? () => onPick(node.classId) : undefined}
    >
      {body}
      <text className="tf-lbl" x={x} y={ny} fill={labelColor}>{name}</text>
      {sub}
      {isOpen ? <circle cx={x} cy={y} r={26} fill="transparent" /> : null}
    </g>
  );
}

function AggregateCardView({ card }: { readonly card: AggregateCard }): ReactElement {
  const col = DOMAIN_COLOR[card.half];
  return (
    <div className="tf-agg">
      <div className="tf-agg-t">
        {card.label} · tier-slot aggregates <span className="tf-agg-note">(the threshold currency)</span>
      </div>
      <SlotRow label="Tier I" val={card.t1} need={card.t1Need} col={col} />
      <SlotRow label="Tier II" val={card.t2} need={card.t2Need} col={col} />
      <div className="tf-agg-nx">{card.nextText}</div>
    </div>
  );
}

function SlotRow({
  label,
  val,
  need,
  col,
}: {
  readonly label: string;
  readonly val: number;
  readonly need: number;
  readonly col: string;
}): ReactElement {
  const met = val >= need;
  const pct = Math.min(100, (val / need) * 100);
  return (
    <div className="tf-slot">
      <div className="tf-sl">
        <span>{label}</span>
        <span className={met ? 'ok' : 'sh'}>
          {val.toLocaleString()} / {need.toLocaleString()}
          {met ? ' ✓' : ''}
        </span>
      </div>
      <div className="tf-bar">
        <i style={{ width: `${pct}%`, background: met ? col : 'var(--brass2)' }} />
      </div>
    </div>
  );
}

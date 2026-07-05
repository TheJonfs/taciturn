// RosterView — the between-battles Formation gallery (TABA M2 UI, View 1).
//
// A portrait-first celestial roster: recognition (face, name, class, level)
// leads, with veterancy/JP signals as accent — an investment aura, a twinkling
// JP-glint for units with spend waiting, and a constellation trace of each
// unit's built-up classes. Filters + sorts drive triage; a click opens the
// unit's dossier.
//
// Pure presentation over `roster-view-model` (which adapts the progression
// selectors). No progression logic lives here — the view-model owns every
// number; this file owns pixels. Aesthetic ports `formation-roster.html`; the
// firm parts (glint iff idle JP, the four sorts, domain filters, trace) are
// exact, the celestial skin is the intended direction.

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Catalog, ClassId, UnitId } from '@engine/index.ts';
import { COMPONENT_CATALOG, type CampaignUnit, type ComponentCatalog } from '@campaign/index.ts';
import {
  DOMAIN_COLOR,
  buildRosterEntries,
  filterAndSortRoster,
  rosterSummary,
  type InvestmentDot,
  type RosterEntry,
  type RosterFilter,
  type RosterSort,
} from './roster-view-model.ts';
import { FORMATION_STYLE } from './formation-style.ts';
import { resolveUnitPortrait } from '../../assets/portraits/index.ts';

export interface RosterViewProps {
  readonly roster: ReadonlyArray<CampaignUnit>;
  readonly catalog: Catalog; // engine catalog — class display names
  readonly onOpenUnit: (id: UnitId) => void;
  // Optional "return to the fight" affordance (pre-battle context). Omitted in
  // neutral world-map management.
  readonly onBack?: () => void;
  readonly backLabel?: string;
  readonly componentCatalog?: ComponentCatalog;
  readonly title?: string;
  readonly subtitle?: string;
}

const FILTERS: ReadonlyArray<{ readonly key: RosterFilter; readonly label: string; readonly swatch?: string }> = [
  { key: 'all', label: 'All' },
  { key: 'has-jp', label: 'Has JP', swatch: '#d8b26c' },
  { key: 'physical', label: 'Physical', swatch: DOMAIN_COLOR.physical },
  { key: 'magical', label: 'Magical', swatch: DOMAIN_COLOR.magical },
  { key: 'hybrid', label: 'Hybrid', swatch: DOMAIN_COLOR.hybrid },
];

const SORTS: ReadonlyArray<{ readonly key: RosterSort; readonly label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'level', label: 'Level ↓' },
  { key: 'newest', label: 'Newest ↓' },
  { key: 'unspent-jp', label: 'Unspent JP ↓' },
];

export function RosterView({
  roster,
  catalog,
  onOpenUnit,
  onBack,
  backLabel = '← To Battle',
  componentCatalog = COMPONENT_CATALOG,
  title = 'Roster of Cadets',
  subtitle = 'Formation',
}: RosterViewProps): ReactElement {
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [sort, setSort] = useState<RosterSort>('name');

  const entries = useMemo(
    () => buildRosterEntries(roster, componentCatalog),
    [roster, componentCatalog],
  );
  const shown = useMemo(() => filterAndSortRoster(entries, filter, sort), [entries, filter, sort]);
  const summary = useMemo(() => rosterSummary(entries), [entries]);

  const className = (id: ClassId): string =>
    catalog.hasClass(id) ? catalog.getClass(id).name : String(id);

  return (
    <div className="tf-root">
      <style>{FORMATION_STYLE}</style>
      <StarField />
      <div className="tf-wrap">
        <div className="tf-head">
          <h1>
            <span className="tf-s">{subtitle}</span>
            {title}
          </h1>
          <div className="tf-summ">
            {summary.total} cadets under your command
            <br />
            <b>{summary.withUnspent}</b> have unspent JP · <b>{summary.totalIdleJp.toLocaleString()}</b> JP idle across the roster
          </div>
        </div>

        <div className="tf-filters">
          <div className="tf-frow">
            <span className="tf-grp">Show</span>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`tf-chip${filter === f.key ? ' on' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.swatch ? <i style={{ background: f.swatch }} /> : null}
                {f.label}
              </button>
            ))}
          </div>
          <div className="tf-frow">
            <span className="tf-grp">Sort</span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`tf-chip${sort === s.key ? ' on' : ''}`}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {onBack ? (
          <button type="button" className="tf-back" onClick={onBack}>
            {backLabel}
          </button>
        ) : null}

        <div className="tf-grid">
          {shown.map((e) => (
            <UnitCard key={String(e.unit.id)} entry={e} className={className} onOpen={onOpenUnit} />
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="tf-empty">No cadets match this filter.</div>
        ) : null}
      </div>
    </div>
  );
}

function UnitCard({
  entry,
  className,
  onOpen,
}: {
  readonly entry: RosterEntry;
  readonly className: (id: ClassId) => string;
  readonly onOpen: (id: UnitId) => void;
}): ReactElement {
  const { unit, domain, idleJp, totalInvested, investment, isUnique } = entry;
  const col = DOMAIN_COLOR[domain];
  // Bespoke plot face where one exists, else the class+gender portrait; the
  // capital-letter monogram remains the final fallback (unregistered class).
  const portraitUrl = resolveUnitPortrait(unit.portrait, unit.classId, unit.gender);
  // Aura brightness scales with total investment (veterancy at a glance).
  const auraSpread = 10 + Math.min(1, totalInvested / 2400) * 22;
  const auraOpacity = Math.min(0.5, 0.12 + Math.min(1, totalInvested / 2400) * 0.4);

  return (
    <div
      className="tf-card"
      style={{ ['--dc' as string]: col }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(unit.id)}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onOpen(unit.id);
        }
      }}
    >
      <div className="tf-top">
        <div className="tf-port">
          {portraitUrl !== null ? (
            <img className="tf-face" src={portraitUrl} alt="" />
          ) : (
            initial(unit.name)
          )}
          <div
            className="tf-aura"
            style={{
              boxShadow: `0 0 ${auraSpread.toFixed(0)}px ${(auraSpread / 3).toFixed(0)}px ${col}`,
              opacity: auraOpacity.toFixed(2),
            }}
          />
        </div>
        {idleJp > 0 ? (
          <div className="tf-glint" title={`${idleJp} unspent JP`}>
            <StarGlyph />
            <b>{idleJp}</b>
          </div>
        ) : null}
        <div className="tf-who">
          <div className="tf-nm">
            {unit.name}
            {isUnique ? (
              <span className="tf-crest" title="Named cadet">
                <CrestGlyph />
              </span>
            ) : null}
          </div>
          <div className="tf-cl">
            <span className="c" style={{ color: col }}>
              {className(unit.classId)}
            </span>{' '}
            <span className="lv">· Lv {unit.level}</span>
          </div>
        </div>
      </div>
      <div className="tf-foot">
        <div className="tf-trace">
          {investment.slice(0, 5).map((d) => (
            <TraceDot key={String(d.classId)} dot={d} />
          ))}
        </div>
        {isUnique ? <span className="tf-uniq">named</span> : null}
      </div>
    </div>
  );
}

function TraceDot({ dot }: { readonly dot: InvestmentDot }): ReactElement {
  const r = Math.max(3, Math.min(7, 3 + dot.spent / 260));
  const opacity = (0.4 + Math.min(0.55, dot.spent / 1300)).toFixed(2);
  return (
    <span
      className="d"
      title={`${dot.spent} JP`}
      style={{
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: DOMAIN_COLOR[dot.domain],
        opacity,
      }}
    />
  );
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function StarGlyph(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <path d="M8 1l1.5 4.9 4.9 1.6-4.9 1.6L8 15 6.5 9.1 1.6 7.5 6.5 5.9z" fill="#d8b26c" />
    </svg>
  );
}

function CrestGlyph(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
      <path
        d="M8 1l1.7 3.4 3.8.6-2.8 2.7.7 3.8L8 9.9 4.6 11.5l.7-3.8L2.5 5l3.8-.6z"
        fill="none"
        stroke="#d8b26c"
        strokeWidth="1.1"
      />
    </svg>
  );
}

// Faint drifting star-field behind the roster. Cosmetic; guarded so a missing
// 2D context (headless/test) is a no-op rather than a throw.
function StarField(): ReactElement {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (cv === null) return;
    const ctx = cv.getContext('2d');
    if (ctx === null) return;
    let raf = 0;
    let stars: ReadonlyArray<{ x: number; y: number; r: number; o: number; tw: number }> = [];
    const init = (): void => {
      const w = (cv.width = cv.offsetWidth);
      const h = (cv.height = cv.offsetHeight);
      stars = Array.from({ length: 80 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.1 + 0.3,
        o: Math.random() * 0.5 + 0.1,
        tw: Math.random() * Math.PI * 2,
      }));
    };
    const draw = (): void => {
      const t = performance.now() / 1000;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const s of stars) {
        const o = s.o * (0.6 + 0.4 * Math.sin(t * 0.5 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 7);
        ctx.fillStyle = `rgba(207,214,245,${o})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    init();
    draw();
    window.addEventListener('resize', init);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', init);
    };
  }, []);
  return <canvas ref={ref} className="tf-sky" aria-hidden />;
}

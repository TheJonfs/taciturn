// Formation roster — the pure view-model (TABA M2 UI).
//
// Adapts the settled progression selectors (`@campaign/progression`) into the
// per-unit numbers the roster gallery renders: current-class domain, total idle
// JP (the "go spend" triage signal), and the per-class investment trace (a
// build fingerprint). All pure and catalog-parameterized — no React, no engine
// Catalog dependency here (class *display names* are resolved in the component
// via the engine catalog; this module owns only progression-derived numbers).
//
// Watch-for (brief): never re-derive thresholds or openness here — that is
// `reclassableClasses`' job on the dossier. The roster only reports *spend* and
// *purse*, both straight off the ledger selectors.

import type { ClassId } from '@engine/index.ts';
import {
  PLOT_UNIT_IDS,
  type CampaignUnit,
  type ComponentCatalog,
  type ClassHalf,
  tierEntryOf,
  availableInClass,
  spentInClass,
} from '@campaign/index.ts';

// The three tree domains. Aliased to the progression `ClassHalf` so the roster
// and the constellation share one vocabulary.
export type Domain = ClassHalf; // 'physical' | 'magical' | 'hybrid'

export const DOMAIN_COLOR: Readonly<Record<Domain, string>> = {
  physical: '#e2965f',
  magical: '#a88fe4',
  hybrid: '#5fc4ae',
};

export const DOMAIN_LABEL: Readonly<Record<Domain, string>> = {
  physical: 'Physical',
  magical: 'Magical',
  hybrid: 'Hybrid',
};

// The domain of the unit's CURRENT class (drives the card frame colour + the
// Physical/Magical/Hybrid filters).
export function unitDomain(unit: CampaignUnit): Domain {
  return tierEntryOf(unit.classId).half;
}

// A plot-unique ("named") cadet, wearing the brass crest. The durable
// marker is the authored plot id (PLOT_UNIT_IDS — all five leads, whether
// or not their class needed an access override). The class-access-override
// fallback stays for hand-authored specials outside the plot roster (the
// dev harness's demo uniques use it). Pre-S86 this read ONLY the override,
// so Lumen and Clio — whose classes sit inside the starting tiers and need
// no override — showed crestless (Chris's report).
const PLOT_ID_SET: ReadonlySet<string> = new Set(
  Object.values(PLOT_UNIT_IDS).map((id) => String(id)),
);
export function isPlotUnique(unit: CampaignUnit): boolean {
  return PLOT_ID_SET.has(String(unit.id)) || (unit.classAccessOverride?.length ?? 0) > 0;
}

// Every class the unit has a JP presence in (earned into — a superset of the
// classes it has spent in, since unlocking requires earning first).
function investedClassIds(unit: CampaignUnit): ReadonlyArray<ClassId> {
  return Object.keys(unit.earnedByClass) as ClassId[];
}

// Total spendable JP across ALL the unit's classes — the glint badge number and
// the "go spend" triage signal. `availableInClass` is `earned − derived-spent`;
// clamped at 0 per class defensively (a well-formed ledger never goes negative).
export function unitIdleJp(unit: CampaignUnit, catalog: ComponentCatalog): number {
  let sum = 0;
  for (const cid of investedClassIds(unit)) {
    sum += Math.max(0, availableInClass(unit, cid, catalog));
  }
  return sum;
}

// One class the unit has built up, for the constellation trace.
export interface InvestmentDot {
  readonly classId: ClassId;
  readonly domain: Domain;
  readonly spent: number; // derived class-spend (== the learned set by construction)
}

// The unit's invested classes, brightest-first — a build fingerprint. Only
// classes with actual spend appear (a class with idle-but-unspent JP is not yet
// "built up"). `spentInClass` is the derived star-brightness quantity.
export function unitInvestment(
  unit: CampaignUnit,
  catalog: ComponentCatalog,
): ReadonlyArray<InvestmentDot> {
  const dots: InvestmentDot[] = [];
  for (const cid of investedClassIds(unit)) {
    const spent = spentInClass(unit, cid, catalog);
    if (spent > 0) dots.push({ classId: cid, domain: tierEntryOf(cid).half, spent });
  }
  return dots.sort((a, b) => b.spent - a.spent);
}

// Total JP the unit has spent across every class — drives the portrait aura's
// brightness (veterancy at a glance).
export function unitTotalInvested(unit: CampaignUnit, catalog: ComponentCatalog): number {
  let sum = 0;
  for (const cid of investedClassIds(unit)) sum += spentInClass(unit, cid, catalog);
  return sum;
}

// --- filters + sorts (roster triage) ---------------------------------------

export type RosterFilter = 'all' | 'has-jp' | Domain;
export type RosterSort = 'name' | 'level' | 'newest' | 'unspent-jp';

// A fully-derived roster entry — everything the card needs except the class
// display name (resolved in the component from the engine catalog).
export interface RosterEntry {
  readonly unit: CampaignUnit;
  // Recruitment order proxy: the unit's index in the roster array. Until
  // recruitment ships (M3), append-order IS join-order. (Brief data-dep: a
  // monotonic `recruitedAt` becomes worthwhile when recruits arrive.)
  readonly joinIndex: number;
  readonly domain: Domain;
  readonly idleJp: number;
  readonly totalInvested: number;
  readonly investment: ReadonlyArray<InvestmentDot>;
  readonly isUnique: boolean;
  // S100 (Fix 3): permadeath-lost, retained on the roster (D-D). The card
  // renders memorialized — a "fallen" STATE, not a deletion, so a future
  // revival mechanic clears it without a data migration.
  readonly isFallen: boolean;
}

export function buildRosterEntries(
  roster: ReadonlyArray<CampaignUnit>,
  catalog: ComponentCatalog,
): ReadonlyArray<RosterEntry> {
  return roster.map((unit, joinIndex) => ({
    unit,
    joinIndex,
    domain: unitDomain(unit),
    idleJp: unitIdleJp(unit, catalog),
    totalInvested: unitTotalInvested(unit, catalog),
    investment: unitInvestment(unit, catalog),
    isUnique: isPlotUnique(unit),
    isFallen: unit.fate === 'lost',
  }));
}

function matches(entry: RosterEntry, filter: RosterFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'has-jp':
      return entry.idleJp > 0;
    default:
      return entry.domain === filter;
  }
}

// Stable comparators. `newest` = highest join-index first; `unspent-jp` and
// `level` descend; ties fall back to name so ordering is deterministic.
const COMPARATORS: Readonly<Record<RosterSort, (a: RosterEntry, b: RosterEntry) => number>> = {
  name: (a, b) => a.unit.name.localeCompare(b.unit.name),
  level: (a, b) => b.unit.level - a.unit.level || a.unit.name.localeCompare(b.unit.name),
  newest: (a, b) => b.joinIndex - a.joinIndex,
  'unspent-jp': (a, b) => b.idleJp - a.idleJp || a.unit.name.localeCompare(b.unit.name),
};

export function filterAndSortRoster(
  entries: ReadonlyArray<RosterEntry>,
  filter: RosterFilter,
  sort: RosterSort,
): ReadonlyArray<RosterEntry> {
  return entries.filter((e) => matches(e, filter)).slice().sort(COMPARATORS[sort]);
}

// Roster-wide summary line (count · with-unspent · total idle JP).
export interface RosterSummary {
  readonly total: number;
  readonly withUnspent: number;
  readonly totalIdleJp: number;
}

export function rosterSummary(entries: ReadonlyArray<RosterEntry>): RosterSummary {
  let withUnspent = 0;
  let totalIdleJp = 0;
  for (const e of entries) {
    if (e.idleJp > 0) withUnspent += 1;
    totalIdleJp += e.idleJp;
  }
  return { total: entries.length, withUnspent, totalIdleJp };
}

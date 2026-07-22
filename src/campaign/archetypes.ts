// TABA M4 — skirmish enemy archetypes + location scoping (WI4).
//
// An ARCHETYPE is the authorable cast of a generated encounter: a weighted
// class pool, optional composition minimums, and a flavor label. Archetype
// supplies WHO shows up (flavor/location); level supplies the POWER — the
// two dials never mix. A skirmish first rolls an archetype from its node's
// eligible list, then rolls each unit's class from the archetype's pool.
//
// Ch1 pools are deliberately tight and thematic (brief: Hunters, Monks,
// mages, the occasional Knight/Thief — NEVER an Assassin/Calculator; that
// gate is test-pinned). Later chapters open the pools as the player's own
// class access broadens — the Ch2/Ch3 registries are authored when those
// chapters' skirmish content lands (flagged in the M4 handoff).
//
// Lean by design (brief): a hand-authored registry keyed by node id.
// Atlas/Cartographer authoring support is deferred until it chafes, same
// discipline as the deferred beat-editor tier.
//
// Composition minimums FAIL SOFT: an unsatisfiable minimum (more required
// slots than party size) fills what it can rather than throwing — a small
// party is a fact about the battlefield, not an authoring error.
//
// STATUS: S99 first draft, Chris review pending — labels, pools, weights,
// and the node mapping are all up for discussion before locking in.

import { classId, deriveActionSeed, type Catalog, type ClassId } from '@engine/index.ts';

export interface EnemyArchetype {
  readonly id: string;
  // Flavor label for menus/logs ("Ordallian Patrol").
  readonly label: string;
  // Unit-name prefix: "Bandit" + class name → "Bandit Monk".
  readonly unitNamePrefix: string;
  // Weighted class pool the party rolls from.
  readonly classPool: ReadonlyArray<{ readonly classId: ClassId; readonly weight: number }>;
  // Composition floors: at least `count` units whose class is in `classIds`
  // (e.g. "≥1 frontline"). Applied after the roll by re-rolling trailing
  // slots; fails soft when the party is too small to satisfy them all.
  readonly minimums?: ReadonlyArray<{
    readonly classIds: ReadonlyArray<ClassId>;
    readonly count: number;
  }>;
}

const pool = (
  ...entries: ReadonlyArray<readonly [string, number]>
): ReadonlyArray<{ readonly classId: ClassId; readonly weight: number }> =>
  entries.map(([id, weight]) => ({ classId: classId(id), weight }));

const classes = (...ids: ReadonlyArray<string>): ReadonlyArray<ClassId> => ids.map(classId);

// --- The Ch1 registry (S99 draft) -------------------------------------------

export const ENEMY_ARCHETYPES: ReadonlyArray<EnemyArchetype> = [
  {
    id: 'ordallian_patrol',
    label: 'Ordallian Patrol',
    unitNamePrefix: 'Ordallian',
    // Disciplined military mix: ranged core, armored point, a field medic.
    classPool: pool(['hunter', 3], ['knight', 2], ['monk', 2], ['alchemist', 1]),
    minimums: [{ classIds: classes('knight', 'monk'), count: 1 }],
  },
  {
    id: 'bandits',
    label: 'Bandits',
    unitNamePrefix: 'Bandit',
    // Opportunists: knives first, a poacher's bow, someone holding the loot.
    classPool: pool(['thief', 3], ['monk', 2], ['hunter', 2], ['alchemist', 1]),
    minimums: [{ classIds: classes('thief'), count: 1 }],
  },
  {
    id: 'hedge_mages',
    label: 'Hedge-Mages',
    unitNamePrefix: 'Hedge',
    // Rural casters of the three elemental schools behind a thin screen.
    classPool: pool(
      ['fire_mage', 2],
      ['water_mage', 2],
      ['earth_mage', 2],
      ['monk', 1],
      ['alchemist', 1],
    ),
    minimums: [{ classIds: classes('monk', 'alchemist'), count: 1 }],
  },
  {
    id: 'poachers',
    label: 'Poachers',
    unitNamePrefix: 'Poacher',
    // Wilds trappers: bows and knives, an earth-witch who knows the terrain.
    classPool: pool(['hunter', 3], ['thief', 2], ['monk', 1], ['earth_mage', 1]),
    minimums: [{ classIds: classes('hunter'), count: 1 }],
  },
] as const;

// The chapter-agnostic fallback for nodes with no authored mapping (and the
// Ch2+ stopgap until those chapters' registries are authored): the whole
// Tier-1 roster plus the occasional Knight/Thief.
export const DEFAULT_ARCHETYPE: EnemyArchetype = {
  id: 'wayfarers',
  label: 'Wayfarers',
  unitNamePrefix: 'Wayside',
  classPool: pool(
    ['monk', 2],
    ['hunter', 2],
    ['alchemist', 2],
    ['fire_mage', 2],
    ['water_mage', 2],
    ['earth_mage', 2],
    ['knight', 1],
    ['thief', 1],
  ),
};

// Node → eligible archetype ids (Ch1; S99 draft mapping). A node with 2+
// entries rolls among them per fight — repeat farming meets a different
// cast, not just a different roll of the same one. Node ids are literals
// matching CAMPAIGN_NODES values (the equipment-pool convention — this
// module stays content-only, no graph import); node.test.ts-style pinning
// lives in archetypes.test.ts.
export const NODE_ARCHETYPES: Readonly<Record<string, ReadonlyArray<string>>> = {
  'node-zarghidas': ['bandits'],
  'node-oskun': ['ordallian_patrol', 'bandits'],
  'node-alvera': ['hedge_mages', 'bandits'],
  'node-zelmonia-castle': ['ordallian_patrol'],
  'node-zelmonia-hills': ['ordallian_patrol', 'poachers'],
  'node-grek-forest': ['poachers', 'bandits'],
  'node-fort-cator': ['ordallian_patrol'],
  'node-ordal-canyon': ['bandits', 'poachers'],
  'node-old-ordal': ['hedge_mages', 'ordallian_patrol'],
  'node-mount-eska': ['poachers', 'hedge_mages'],
  'node-ester-road': ['bandits', 'ordallian_patrol'],
  'node-ruk-village': ['poachers'],
  'node-viura': ['ordallian_patrol', 'hedge_mages'],
};

const byId = new Map(ENEMY_ARCHETYPES.map((a) => [a.id, a]));

// Seed salts (composition streams; enemy-unit streams use 1000+ in
// skirmish.ts, gear slots 100+ in enemy-gear.ts, pair class 1).
const SALT_ARCHETYPE_PICK = 10;
const SALT_CLASS_ROLL = 200;
const SALT_MINIMUM_FILL = 300;

// The archetype a skirmish at this node fights, for this seed. Unknown
// archetype ids in the mapping fail loud (an authoring error, not a
// fallback case); an UNMAPPED node gets the default archetype.
export function archetypeForNode(nodeId: string, seed: number): EnemyArchetype {
  const eligible = NODE_ARCHETYPES[nodeId];
  if (eligible === undefined || eligible.length === 0) return DEFAULT_ARCHETYPE;
  const id = eligible[deriveActionSeed(seed, SALT_ARCHETYPE_PICK) % eligible.length]!;
  const archetype = byId.get(id);
  if (archetype === undefined) {
    throw new Error(`archetypeForNode: node '${nodeId}' maps to unknown archetype '${id}'`);
  }
  return archetype;
}

function weightedPick(
  poolEntries: ReadonlyArray<{ readonly classId: ClassId; readonly weight: number }>,
  roll: number, // [0, 1)
): ClassId {
  const total = poolEntries.reduce((sum, e) => sum + e.weight, 0);
  let cursor = roll * total;
  for (const e of poolEntries) {
    cursor -= e.weight;
    if (cursor < 0) return e.classId;
  }
  return poolEntries[poolEntries.length - 1]!.classId;
}

// Roll a party's classes from the archetype's pool, then enforce the
// composition minimums by re-rolling trailing slots into the deficient
// minimum's class set (fail-soft: a party smaller than the summed minimums
// satisfies what it can, back-to-front).
export function rollArchetypeClasses(
  archetype: EnemyArchetype,
  count: number,
  seed: number,
  catalog: Catalog,
): ClassId[] {
  const poolEntries = archetype.classPool.filter((e) => catalog.hasClass(e.classId));
  if (poolEntries.length === 0) {
    throw new Error(`rollArchetypeClasses: archetype '${archetype.id}' has no catalog classes`);
  }
  const rolled = Array.from({ length: count }, (_, i) =>
    weightedPick(poolEntries, deriveActionSeed(seed, SALT_CLASS_ROLL + i) / 0x100000000),
  );
  let nextReplace = count - 1;
  for (const minimum of archetype.minimums ?? []) {
    const inSet = (c: ClassId): boolean => minimum.classIds.includes(c);
    let have = rolled.filter(inSet).length;
    while (have < minimum.count && nextReplace >= 0) {
      if (!inSet(rolled[nextReplace]!)) {
        const candidates = poolEntries.filter((e) => inSet(e.classId));
        const from = candidates.length > 0 ? candidates : minimum.classIds.map((c) => ({ classId: c, weight: 1 }));
        rolled[nextReplace] = weightedPick(
          from,
          deriveActionSeed(seed, SALT_MINIMUM_FILL + nextReplace) / 0x100000000,
        );
        have++;
      }
      nextReplace--;
    }
  }
  return rolled;
}

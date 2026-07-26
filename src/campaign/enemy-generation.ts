// TABA M4 — THE generated-enemy composer (one composer, three consumers).
//
// Skirmish parties, Cartographer auto/budget kits, and story-battle lineups
// without an authored loadout all resolve through `composeEnemyBuild`: a
// complete enemy build — learned kit, POPULATED loadout, gear — from
// (classId, level, seed) plus optional authored overrides. Before M4,
// generated enemies were barebones: JP bought actives that were never
// deployed past First Action, R/S/M sat empty (silently — unequipped
// passives just never register hooks), and gear was a lone Dagger. The M4
// brief's three moves land here:
//
//   BUY TOWARD THE LOADOUT (WI2). The JP budget buys the primary class's
//   active curriculum first (authoring order — the designed curriculum,
//   same prefix discipline as S94). Budget left after the primary tree
//   diversifies into a seeded PAIR CLASS (Chris's S99 call: mostly/entirely
//   primary before diversifying; pair rolled from the canonical classes at
//   or below the primary's tier — no Tier-3 secondaries on a Ch1 grunt).
//   One pair active bought ⇒ the pair's command set is wielded as the
//   Second Action. Native-class R/S/M passives are free to equip in-class
//   (the export tax is the only JP price a passive has — same rule the
//   player's Formation picker applies), so R/S/M fill to capacity from the
//   native set, then leftover budget pays export taxes on pair-class
//   passives that still fit. Learned = equipped wherever it fits; no
//   deliberate under-equipping (budget stays the LEGIBLE difficulty dial).
//
//   GEAR VIA THE S89 VALUATION (WI3). `assignEnemyGear` (enemy-gear.ts)
//   ranks the level-banded, unique-free, exotic-free pool per slot.
//
//   SAME LEGALITY AS THE PLAYER. Capacity/cost/slot rules run through the
//   shared draft resolver (`draftBucketCapacity`/`draftAbilityCost`, the
//   state-free twins the Team Builder and Cartographer use) — no
//   enemy-specific legality path. Gear is assigned BEFORE passive fill
//   because capacity is equipment-adjusted (Spiked Maul's reaction −3
//   simply leaves less to fill — the composition stays legal).
//
// Deterministic by construction: the only randomness is the seeded pair
// roll and the per-slot gear-band rolls — same (inputs, seed), same build.
// The composer never throws on an ill-formed OVERRIDE combination (the
// Cartographer needs to compose invalid drafts to display their errors);
// the fully-generated path is pinned legal by enemy-generation.test.ts.

import {
  bucketId,
  draftAbilityCost,
  draftBucketCapacity,
  deriveActionSeed,
  EMPTY_UNIT_EQUIPMENT,
  rulesetId,
  type AbilityId,
  type Catalog,
  type ClassId,
  type CommandSetId,
  type Loadout,
  type UnitEquipment,
} from '@engine/index.ts';
import type { GearScoreProfile } from '@ai/index.ts';
import { leveledClassStats } from '@content/classes/stat-curves.ts';
import { authoredEnemy } from './authored-enemy.ts';
import { assignEnemyGear } from './enemy-gear.ts';
import { enemyBraveFaith, enemyJpBudget } from './enemy-kit.ts';
import { withInnatePassives } from './innate-passives.ts';
import type { CampaignUnit } from './types.ts';
import {
  CLASS_TIER_MAP,
  COMPONENT_CATALOG,
  COMPONENT_ENTRIES,
  tierEntryOf,
  tokenKey,
  type ComponentMeta,
  type UnlockToken,
} from './progression/index.ts';

// All campaign composition runs on the one shipped ruleset (capacity
// baselines live there). Same value as node-content's CAMPAIGN_RULESET_ID —
// restated locally because importing node-content from here would cycle
// (node-content → lineup → this module).
const GENERATION_RULESET = rulesetId('default');

// Seed salt for the pair-class roll (gear slots use 100+ in enemy-gear.ts).
const SALT_PAIR_CLASS = 1;

// Fold a string id (lineup key, node id) into a 32-bit seed root — FNV-1a,
// branched further with `deriveActionSeed`. Shared by the lineup slot seeds
// and the skirmish seed so every generation stream derives the same way.
export function stringSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export interface ComposeEnemyArgs {
  readonly classId: ClassId;
  readonly level: number;
  // Deterministic stream root: same (args, seed) → same build.
  readonly seed: number;
  readonly catalog: Catalog;
  // --- kit source (first match wins): explicit tokens > jpBudget > level ---
  readonly unlocks?: ReadonlyArray<UnlockToken>;
  readonly jpBudget?: number;
  // --- authored overrides (Cartographer Tier 3): each replaces its
  // generated half wholesale; absent = generated default ---
  readonly equipment?: UnitEquipment;
  readonly passiveBuckets?: Loadout['passiveBuckets'];
  readonly secondaryCommandSet?: CommandSetId;
  // Scope for the pair-class roll (an archetype may narrow it); defaults to
  // every canonical class at or below the primary's tier.
  readonly secondaryClassPool?: ReadonlyArray<ClassId>;
}

export interface ComposedEnemyBuild {
  readonly unlocks: ReadonlyArray<UnlockToken>;
  readonly loadout: Loadout;
  readonly equipment: UnitEquipment;
  // The rolled (or token-derived) second class, when the kit reached one.
  readonly secondaryClass?: ClassId;
}

// The class's unrestricted curriculum rows, in authoring order.
function curriculumOf(cls: ClassId): ReadonlyArray<ComponentMeta> {
  return COMPONENT_ENTRIES.filter(
    (meta) => meta.nativeClass === cls && meta.restrictedToUnit === undefined,
  );
}

// Buy the class's ACTIVE curriculum as a budget-limited prefix (authoring
// order, stop at the first unaffordable — the S94 discipline; passives are
// never JP-bought in their native class and pair passives are priced
// separately below). `completed` reports whether the WHOLE active tree was
// bought — diversification into a pair class is gated on it (Chris's S99
// call: primary before secondary; a low-level enemy stays single-class).
function buyActivePrefix(
  cls: ClassId,
  budget: number,
  catalog: Catalog,
): { tokens: UnlockToken[]; spent: number; completed: boolean } {
  let remaining = Math.max(0, budget);
  const tokens: UnlockToken[] = [];
  let completed = true;
  for (const meta of curriculumOf(cls)) {
    if (meta.token.kind === 'ability') {
      if (!catalog.hasAbility(meta.token.id) || catalog.getAbility(meta.token.id).kind !== 'active') {
        continue;
      }
    }
    if (meta.cost > remaining) {
      completed = false;
      break;
    }
    remaining -= meta.cost;
    tokens.push(meta.token);
  }
  return { tokens, spent: Math.max(0, budget) - remaining, completed };
}

// The seeded pair-class roll: canonical classes at or below the primary's
// tier (legibility guard — a Ch1 grunt never moonlights as an Assassin),
// lexicographic order for a stable stream.
function rollPairClass(
  primary: ClassId,
  seed: number,
  pool: ReadonlyArray<ClassId> | undefined,
): ClassId | undefined {
  const primaryTier = tierEntryOf(primary).tier;
  const candidates = (pool ?? [...CLASS_TIER_MAP.keys()])
    .filter((c) => c !== primary && tierEntryOf(c).tier <= primaryTier)
    .sort((a, b) => String(a).localeCompare(String(b)));
  if (candidates.length === 0) return undefined;
  return candidates[deriveActionSeed(seed, SALT_PAIR_CLASS) % candidates.length];
}

// For an explicit token list: the non-native class with the most active-
// ability tokens (ties break lexicographically) — the class whose command
// set "learned = equipped" wields as the Second Action.
function pairClassFromTokens(
  primary: ClassId,
  tokens: ReadonlyArray<UnlockToken>,
  catalog: Catalog,
): ClassId | undefined {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (token.kind !== 'ability') continue;
    const meta = COMPONENT_CATALOG.get(tokenKey(token));
    if (meta === undefined || meta.nativeClass === primary) continue;
    if (!catalog.hasAbility(token.id) || catalog.getAbility(token.id).kind !== 'active') continue;
    counts.set(String(meta.nativeClass), (counts.get(String(meta.nativeClass)) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [cls, n] of counts) {
    if (best === undefined || n > counts.get(best)! || (n === counts.get(best)! && cls < best)) {
      best = cls;
    }
  }
  return best as ClassId | undefined;
}

// Whether the composed kit spends MP (scales maxMp/MP-discount gear value).
function kitUsesMp(
  cls: ClassId,
  tokens: ReadonlyArray<UnlockToken>,
  catalog: Catalog,
): boolean {
  const activeIds: AbilityId[] = [...catalog.getClass(cls).freeAbilities];
  for (const token of tokens) {
    if (token.kind === 'ability') activeIds.push(token.id);
  }
  return activeIds.some((id) => {
    if (!catalog.hasAbility(id)) return false;
    const def = catalog.getAbility(id);
    return def.kind === 'active' && def.mpCost > 0;
  });
}

export function composeEnemyBuild(args: ComposeEnemyArgs): ComposedEnemyBuild {
  const { classId: cls, level, seed, catalog } = args;

  // --- the kit (what the enemy "learned") ---------------------------------
  let tokens: UnlockToken[];
  let remaining: number;
  let pairClass: ClassId | undefined;
  if (args.unlocks !== undefined) {
    tokens = [...args.unlocks];
    remaining = 0; // explicit kits carry no leftover budget to spend
    pairClass = pairClassFromTokens(cls, tokens, catalog);
  } else {
    const budget = args.jpBudget ?? enemyJpBudget(level);
    const primary = buyActivePrefix(cls, budget, catalog);
    tokens = primary.tokens;
    remaining = budget - primary.spent;
    if (primary.completed && remaining > 0) {
      pairClass = rollPairClass(cls, seed, args.secondaryClassPool);
      if (pairClass !== undefined) {
        const pair = buyActivePrefix(pairClass, remaining, catalog);
        if (pair.tokens.length > 0) {
          tokens = [...tokens, ...pair.tokens];
          remaining -= pair.spent;
        } else {
          pairClass = undefined; // couldn't afford a single pair active
        }
      }
    }
  }

  // --- action buckets ------------------------------------------------------
  const secondarySet: CommandSetId | undefined =
    args.secondaryCommandSet ??
    (pairClass !== undefined ? catalog.getClass(pairClass).firstActionCommandSet : undefined);
  const actionBuckets: Loadout['actionBuckets'] = {
    [bucketId('first_action')]: [catalog.getClass(cls).firstActionCommandSet],
    ...(secondarySet !== undefined
      ? { [bucketId('secondary_command_sets')]: [secondarySet] }
      : {}),
  };

  const innateOnly = withInnatePassives({ actionBuckets, passiveBuckets: {} }, cls, catalog);

  // One R/S/M fill pass against a given equipment set (capacity is
  // equipment-adjusted). Native passives are free in-class; an explicit
  // kit's exported passives are already paid for; `buyPairPassives` lets
  // the pass spend leftover budget on pair-class export taxes — only for
  // passives that actually fit (buy toward the loadout — never convert
  // budget into unequippable learning).
  const fillPassives = (
    equipment: UnitEquipment,
    buyPairPassives: boolean,
  ): { passiveBuckets: Loadout['passiveBuckets']; bought: UnlockToken[]; spent: number } => {
    const passiveBuckets: Record<string, AbilityId[]> = Object.fromEntries(
      Object.entries(innateOnly.passiveBuckets).map(([bucket, ids]) => [bucket, [...ids]]),
    );
    const bought: UnlockToken[] = [];
    let spent = 0;
    const usedIn = (bucket: string): number =>
      (passiveBuckets[bucket] ?? []).reduce((sum, id) => sum + draftAbilityCost(cls, id, catalog), 0);
    const tryEquip = (abilityIdToEquip: AbilityId): boolean => {
      const def = catalog.getAbility(abilityIdToEquip);
      const bucket = String(def.bucket);
      const ids = (passiveBuckets[bucket] ??= []);
      if (ids.includes(abilityIdToEquip)) return false;
      const capacity = draftBucketCapacity(equipment, def.bucket, catalog, GENERATION_RULESET);
      const cost = draftAbilityCost(cls, abilityIdToEquip, catalog);
      if (usedIn(bucket) + cost > capacity) return false;
      ids.push(abilityIdToEquip);
      return true;
    };
    const ownedKeys = new Set(tokens.map(tokenKey));
    for (const meta of COMPONENT_ENTRIES) {
      if (meta.token.kind !== 'ability' || meta.restrictedToUnit !== undefined) continue;
      const id = meta.token.id;
      if (!catalog.hasAbility(id) || catalog.getAbility(id).kind !== 'passive') continue;
      if (meta.nativeClass === cls) {
        // Native passives are free to equip in-class (the export tax is the
        // only JP price a passive has) — fill greedily in curriculum order.
        tryEquip(id);
      } else if (ownedKeys.has(tokenKey(meta.token))) {
        // An explicit kit's exported passive: already paid for — equip it.
        tryEquip(id);
      } else if (
        buyPairPassives &&
        pairClass !== undefined &&
        meta.nativeClass === pairClass &&
        meta.cost <= remaining - spent
      ) {
        if (tryEquip(id)) {
          bought.push(meta.token);
          spent += meta.cost;
        }
      }
    }
    return { passiveBuckets, bought, spent };
  };

  // --- gear ---------------------------------------------------------------
  // The gear step needs the loadout the unit will WEAR (dual-wield grants,
  // the Eagle Eye hit-chance probe), but capacity is equipment-adjusted —
  // so: a PROVISIONAL fill against bare-equipment capacity informs the
  // gear pick, then the AUTHORITATIVE fill re-runs against the real gear.
  const provisionalBuckets: Loadout['passiveBuckets'] =
    args.passiveBuckets !== undefined
      ? withInnatePassives({ actionBuckets, passiveBuckets: args.passiveBuckets }, cls, catalog)
          .passiveBuckets
      : fillPassives(EMPTY_UNIT_EQUIPMENT, false).passiveBuckets;
  const provisionalLoadout: Loadout = { actionBuckets, passiveBuckets: provisionalBuckets };

  const stats = leveledClassStats(cls, level);
  const profile: GearScoreProfile = {
    classId: cls,
    pa: stats.pa,
    ma: stats.ma,
    usesMp: kitUsesMp(cls, tokens, catalog),
  };
  const equipment: UnitEquipment =
    args.equipment ??
    assignEnemyGear({ classId: cls, level, seed, loadout: provisionalLoadout, profile, catalog });

  // --- R/S/M fill (authoritative) ------------------------------------------
  if (args.passiveBuckets !== undefined) {
    // Authored passives replace the fill wholesale (innates already merged
    // into the provisional loadout, exactly as for every campaign unit).
    return {
      unlocks: tokens,
      loadout: provisionalLoadout,
      equipment,
      ...(pairClass !== undefined ? { secondaryClass: pairClass } : {}),
    };
  }
  const fill = fillPassives(equipment, args.unlocks === undefined);
  tokens = [...tokens, ...fill.bought];
  remaining -= fill.spent;

  const loadout: Loadout = { actionBuckets, passiveBuckets: fill.passiveBuckets };
  return { unlocks: tokens, loadout, equipment, ...(pairClass !== undefined ? { secondaryClass: pairClass } : {}) };
}

// One fully-framed generated enemy: the composed build (kit + populated
// loadout + gear) plus the deterministic Brave/Faith band roll. The shared
// constructor behind skirmish parties and default lineup slots (moved here
// from enemy-kit.ts when M4 unified the composer).
export function generatedEnemyUnit(args: {
  readonly id: string;
  readonly name: string;
  readonly classId: ClassId;
  readonly level: number;
  // Slot index — salts the deterministic Brave/Faith roll so a party
  // doesn't share one statline.
  readonly index: number;
  // Composition stream root (pair class + gear-band rolls).
  readonly seed: number;
  readonly catalog: Catalog;
  readonly secondaryClassPool?: ReadonlyArray<ClassId>;
}): CampaignUnit {
  const { id, name, classId: cls, level, index, seed, catalog } = args;
  const build = composeEnemyBuild({
    classId: cls,
    level,
    seed,
    catalog,
    ...(args.secondaryClassPool !== undefined
      ? { secondaryClassPool: args.secondaryClassPool }
      : {}),
  });
  return authoredEnemy({
    id,
    name,
    classId: cls,
    level,
    loadout: build.loadout,
    equipment: build.equipment,
    unlocks: build.unlocks,
    ...enemyBraveFaith(level, index),
  });
}

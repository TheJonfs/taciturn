// Data-import layer.
//
// The single doorway through which the guide reads game content. Every
// mechanical value the handbook prints — class stats, movement, ability
// costs and effects — flows through here from ../src/content. Page
// templates import from this module (and its sibling ability-format.ts),
// never from @content directly, so the game-coupling surface stays in
// one auditable place.
//
// Read-only with respect to ../src. See guide/CLAUDE.md.

import { loadDefaultCatalog } from '@content/index.ts';
import {
  classBaselineStats,
  type ClassBaselineStats,
} from '@content/classes/baseline-stats.ts';
import { riverRidge } from '@content/maps/river-ridge.ts';
import { stonebridge } from '@content/maps/stonebridge.ts';
import { marshmoor } from '@content/maps/marshmoor.ts';
import { mountainPass } from '@content/maps/mountain-pass.ts';
import { classId, rulesetId } from '@engine/index.ts';
import type {
  AbilityId,
  ActiveAbilityDefinition,
  BattleMap,
  Catalog,
  ClassDefinition,
  ClassId,
  DamageTag,
  ItemDefinition,
  PassiveAbilityDefinition,
  RulesetDefinition,
} from '@engine/index.ts';

let cached: Catalog | undefined;

/** The game catalog, loaded once per build. */
export function catalog(): Catalog {
  cached ??= loadDefaultCatalog();
  return cached;
}

/** All classes, in catalog order. */
export function classes(): ReadonlyArray<ClassDefinition> {
  return catalog().classes();
}

/** A single class by id. Throws if the id is unknown (loud failure). */
export function classById(id: ClassId): ClassDefinition {
  return catalog().getClass(id);
}

/** All items (the armory), in catalog order. */
export function items(): ReadonlyArray<ItemDefinition> {
  return catalog().items();
}

/** The default ruleset — CT costs, bucket capacities, terrain costs, etc. */
export function defaultRuleset(): RulesetDefinition {
  return catalog().getRuleset(rulesetId('default'));
}

/** River Ridge — the Academy's first training-field map. */
export function riverRidgeMap(): BattleMap {
  return riverRidge;
}

/** Stonebridge — the Academy's second training-field map (S47). */
export function stonebridgeMap(): BattleMap {
  return stonebridge;
}

/** Marshmoor — the Academy's third training-field map (S52). */
export function marshmoorMap(): BattleMap {
  return marshmoor;
}

/** Mountain Pass — the Academy's fourth training-field map (S70). */
export function mountainPassMap(): BattleMap {
  return mountainPass;
}

/** One spoke of the elemental wheel, derived from a Mage class's baseline. */
export interface ElementSpoke {
  /** The element this discipline embodies — 'earth' | 'fire' | 'water' | 'lightning'. */
  readonly element: DamageTag;
  /** The Mage class that embodies it. */
  readonly className: string;
  /** The element this one resists (+50 baseline). */
  readonly resists: DamageTag;
  /** The element this one is weak to (−50 baseline). */
  readonly weakTo: DamageTag;
}

// element → the Mage class that embodies it.
const ELEMENT_CLASSES: ReadonlyArray<readonly [DamageTag, string]> = [
  ['fire', 'fire_mage'],
  ['earth', 'earth_mage'],
  ['lightning', 'lightning_mage'],
  ['water', 'water_mage'],
];

/**
 * The elemental wheel, derived from the four Mage classes' baseline
 * resistances — each discipline resists one element (+50) and is weak
 * to another (−50). The order returned is the "beats" cycle: each
 * spoke is weak to the one before it.
 */
export function elementalWheel(): ReadonlyArray<ElementSpoke> {
  return ELEMENT_CLASSES.map(([element, classKey]) => {
    const cls = catalog().getClass(classId(classKey));
    const res = cls.baselineResistances;
    if (!res) {
      throw new Error(`Class "${classKey}" has no baseline resistances for the elemental wheel.`);
    }
    let resists: DamageTag | undefined;
    let weakTo: DamageTag | undefined;
    for (const [tag, value] of res) {
      if (value > 0) resists = tag;
      else if (value < 0) weakTo = tag;
    }
    if (resists === undefined || weakTo === undefined) {
      throw new Error(`Class "${classKey}" baseline resistances are not a clean resist/weak pair.`);
    }
    return { element, className: cls.name, resists, weakTo };
  });
}

/**
 * The class-differentiated L25 baseline stats (HP/MP/PA/MA/Speed).
 * Source of truth: ../src/content/classes/baseline-stats.ts.
 */
export function baselineStats(id: ClassId): ClassBaselineStats {
  const stats = classBaselineStats.get(id);
  if (!stats) {
    // Loud failure — a class with no baseline stats is a content gap,
    // not something the guide should paper over (see CLAUDE.md).
    throw new Error(`No baseline stats registered for class "${id}".`);
  }
  return stats;
}

/** A class's displayable abilities, partitioned by kind. */
export interface ClassAbilities {
  readonly actives: ReadonlyArray<ActiveAbilityDefinition>;
  readonly passives: ReadonlyArray<PassiveAbilityDefinition>;
}

/**
 * Resolve the abilities a class spread should show: the class's free
 * abilities (the universal Attack, granted passives) plus the members
 * of its pinned First Action command set. Partitioned into actives and
 * passives by the definition's own `kind` discriminant.
 *
 * Insertion order is preserved: free abilities first (Attack leads, as
 * the Knight authors it first), then command-set members in declared
 * order.
 */
export function classAbilities(cls: ClassDefinition): ClassAbilities {
  const ids = new Set<AbilityId>();
  for (const id of cls.freeAbilities) ids.add(id);
  for (const id of catalog().getCommandSet(cls.firstActionCommandSet).members) {
    ids.add(id);
  }

  const actives: ActiveAbilityDefinition[] = [];
  const passives: PassiveAbilityDefinition[] = [];
  for (const id of ids) {
    const def = catalog().getAbility(id);
    if (def.kind === 'active') actives.push(def);
    else passives.push(def);
  }
  return { actives, passives };
}

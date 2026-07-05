// DamageContext and supporting types — the value flowing through the
// seven-stage damage pipeline. See docs/design/action-resolution.md
// ("Damage pipeline").
//
// Why these types live in `engine/types/` rather than `engine/damage/`:
// `HookSignatures.onDamageDealt` and `onDamageReceived` need to name
// `DamageContext` in their args/return shapes (so handlers are typed
// without `unknown`), and `engine/hooks/` already imports from `types/`.
// Putting these here keeps the layering arrow `types/ → ø` while letting
// hook signatures, runners, the pipeline orchestrator, and any future
// damage-aware subsystem all reference the same shape.
//
// Identity by ID (CLAUDE rule 4): the context references the source
// ability via `sourceAbilityId` rather than the full definition. Pipeline
// handlers resolve the ability through the catalog when they need its
// fields. Unit refs are kept inline because the pipeline does not mutate
// state mid-run — final damage application happens at the orchestration
// layer after all stages complete.

import type { AbilityId, UnitId } from './ids.ts';
import type { ProposedAction } from './action.ts';
import type { Unit } from './unit.ts';
import type { EquipmentSlotId } from './equipment-slot.ts';

// Damage / healing tags used by stage handlers and resistance checks.
// The set is closed today; new tags arrive with the content that needs
// them (see docs/design/status-effects.md "Tags" for the parallel
// status-tag pattern). The convention: a class or ability that
// introduces a new tag extends this union in the same change. Adding a
// tag here is one edit; existing handlers stay correct because they
// discriminate on tag presence.
//
// 'healing' is the polarity flip — its presence causes the finalize
// stage to add to HP rather than subtract. Per ADR-0016, 'healing'
// also opts out of resistance modulation entirely.
export type DamageTag =
  | 'physical'
  | 'magical'
  | 'weapon'
  | 'holy'
  | 'dark'
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'earth'    // Added 13.7 ahead of Earth Mage (session 16).
  | 'water'    // Added S44 to close the union gap — element tag for Mage War water content (Water Strike, Tidal Wave, Maelstrom, Wand of Depths).
  | 'poison'   // Added 17b alongside Poison status (system_damage source).
  | 'dot'      // Added S44 — damage-over-time source marker on tick damage (Burn), parallel to 'poison'.
  | 'sword'    // Added 17c with Long Sword equipment (per ADR-0028) — weapon-category tag for future anti-sword content.
  | 'knife'    // Added S40 with the knife weapon class — weapon-category tag; gates the Speed-based dynamic variance source on knife-tagged weapons.
  | 'bow'      // Added S45 with the bow weapon class (Longbow, Riptide Bow) — weapon-category tag mirroring 'sword'/'knife'/'axe'.
  | 'axe'      // Added S44 — weapon-category tag (War Axe, Bolt Hammer) mirroring 'sword'/'knife'.
  | 'staff'    // Added S44 — weapon-category tag (Staff of Power, Staff of Abundance).
  | 'wand'     // Added S44 — weapon-category tag (Wand of Deepwood, Wand of Depths).
  | 'lance'    // Added S62 — weapon-category tag (Lance, Imp Halberd); marks the two-handed piercing Lance class (Jump's ×2 reads it).
  | 'healing';

// Per-source labelled multiplier applied at finalize. The product of
// every multiplier, then the variance roll, then the cap, produces the
// final value. `source` is for log/debug only — replay reads finalDamage
// from the outcome and never re-runs the pipeline.
export interface DamageMultiplier {
  readonly source: string;
  readonly factor: number;
}

// Per-source labelled additive applied at finalize. Added to the base
// damage before multipliers fold in.
export interface DamageAdditive {
  readonly source: string;
  readonly amount: number;
}

// Variance band as a [min, max] pair on the unit-multiplier scale.
// `{ min: 1, max: 1 }` means no variance. The variance stage rolls
// uniformly within the band using the action's seed.
export interface DamageVariance {
  readonly min: number;
  readonly max: number;
}

// The flowing context. Each pipeline stage receives the current context
// and returns the next one (immutable updates). `finalDamage` is set at
// the finalize stage; reading it before then is a programmer error.
//
// `hit` is set during the pipeline if a stage handler decides the action
// missed (an evasion check, e.g.). v1 ships with no evasion handlers, so
// the orchestrator initializes `hit: true` and lets future handlers
// override. Damage is only applied when hit is true.
export interface DamageContext {
  readonly attacker: Unit;
  readonly target: Unit;
  readonly sourceActionSeq: number;
  readonly sourceAbilityId: AbilityId;
  readonly damageTags: ReadonlySet<DamageTag>;

  readonly baseDamage: number;
  readonly multipliers: ReadonlyArray<DamageMultiplier>;
  readonly additives: ReadonlyArray<DamageAdditive>;
  readonly variance: DamageVariance;

  readonly hit: boolean;
  readonly finalDamage?: number;

  // Per-AoE-cluster size — the number of targets the dispatcher resolved
  // against this cast. Single-target callers pass 1; AoE callers pass
  // `affected.length`. Read by base-stage handlers that scale damage with
  // cluster size (Chain Lightning's `damage.chainBonus`). Per ADR-0032.
  // Defaults to 1 in the orchestrator when the caller omits it (older
  // callers / tests stay correct).
  readonly targetCount: number;

  // Per ADR-0027, pipeline-stage handlers may emit system actions
  // (status_remove for Sleep wake-on-damage, future Vulnerable consume,
  // etc.). The orchestrator threads this list across stages; the caller
  // (`resolveAbilityEffect`) reads it after the pipeline returns and
  // forwards the emissions onto the reducer's `generatedActions`.
  // Defaults to an empty array — handlers that don't emit don't touch it.
  readonly emittedActions?: ReadonlyArray<ProposedAction>;

  // Per-action (or per-target-dispatch) seed, mirroring the pipeline
  // orchestrator's `env.seed`. Exposed on the context so source-tier
  // hook handlers (status / equipment / passive) — which see args rather
  // than env — can roll deterministically off the same stream as
  // pipeline-stage handlers. v1 consumer: `attackProcContributor`'s
  // proc-roll lane. Defaults to undefined on context shapes built by
  // tests that don't need a seed; handlers that read it gate accordingly.
  // Per ADR-0064 (Session 30).
  readonly actionSeed?: number;

  // Per-swing weapon scope (Session 42, multi-swing). When set, this
  // attack is one swing of a specific equipped weapon slot: the base
  // handler (`physicalPaWp`) reads that slot's weapon for WP/tags, and
  // the equipment proc contributor (`attackProcContributor`) fires only
  // that slot's procs. When undefined (every pre-S42 caller and every
  // single-weapon attack), behavior is unchanged — `getEquippedWeapon`
  // resolves the dominant weapon and procs fire from all equipped items.
  readonly attackingWeaponSlot?: EquipmentSlotId;

  // TABA Seam 1: the battle's opaque `GameState.scenarioTier`, copied onto
  // the context so source-tier damage hooks — which see `args.ctx`, not the
  // full state — can read the battle-wide magnitude. Lumen's fire-multiplier
  // (`onDamageDealt`) and Chris's cover fraction (`onDamageReceived`) scale
  // off it. Defaults to `DEFAULT_SCENARIO_TIER` when the state omits it.
  readonly scenarioTier?: number;

  // Session 49 / ADR-0086: additive bump applied to the ability's
  // effective `power_coefficient` for this cast. The Math Skill
  // dispatcher passes the resolved SP bonus (Mathematician returns +1)
  // through here so base-stage handlers add it on top of the
  // ability's declared scalar — without mutating the catalog. Defaults
  // to 0 / undefined for every non-Math caller; the lookup in
  // `effectivePowerCoefficient` is no-op when absent.
  readonly additionalPowerCoefficient?: number;
}

// Resolved outcome of a single pipeline run. The orchestrator returns
// this so reducers can apply finalDamage to vitals and log it.
// `direction: 'damage' | 'healing'` is read off the tag set; storing it
// here saves consumers a tag-set rescan.
export interface DamageResolution {
  readonly attackerId: UnitId;
  readonly targetId: UnitId;
  readonly hit: boolean;
  readonly finalDamage: number;
  readonly direction: 'damage' | 'healing';
  readonly tags: ReadonlySet<DamageTag>;
}

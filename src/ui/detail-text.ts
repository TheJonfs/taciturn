// detail-text — pure formatters for hover-tooltip detail content on
// abilities and equipment items. Pulls everything from the catalog's
// existing fields (no new schema); auto-generates a mechanical summary
// readable at-a-glance.
//
// Session 31.5 candidate: extend with an authored `description?: string`
// field on AbilityCommon + EquipmentBase + content-side author pass.
// Until then, the small `PASSIVE_DESCRIPTIONS` map below carries
// short placeholder strings for the most opaque passives so the hover
// surface is useful in v1 demo playtest. New passives without an entry
// fall back to a "(not yet summarized)" placeholder — flagged in the
// returned content so authors notice.

import {
  abilityId,
  statusTypeId,
  type AbilityDefinition,
  type AbilityId,
  type ActiveAbilityDefinition,
  type Catalog,
  type CommandSetDefinition,
  type ConsumableDefinition,
  type DamageTag,
  type EquipmentDefinition,
  type ItemDefinition,
  type PassiveAbilityDefinition,
  type StatusEffectType,
  type StatusInstance,
  type StatusTypeId,
  type WeaponEquipment,
} from '@engine/index.ts';
import { bucketLabel } from './labels.ts';

export interface DetailContent {
  readonly title: string;
  readonly subtitle?: string;
  readonly lines: ReadonlyArray<string>;
}

// Short authored placeholders for v1 demo statuses. Same convention as
// PASSIVE_DESCRIPTIONS below: minimum prose that beats "read the source"
// for the most opaque entries. New statuses without an entry fall back
// to the auto-generated mechanical summary plus a hook-list line.
const STATUS_DESCRIPTIONS: ReadonlyMap<StatusTypeId, string> = new Map([
  [statusTypeId('burn'), 'Periodic fire damage that ticks on the affected unit’s CT cadence. Each tick consumes one stack; expires when stacks reach zero.'],
  [statusTypeId('poison'), 'Periodic damage that ticks on the affected unit’s CT cadence. Persists until cleared.'],
  [statusTypeId('regen'), 'Periodic healing on the affected unit’s CT cadence. Expires when duration runs out.'],
  [statusTypeId('regen_auto'), 'Battle-long Regen — same healing math as cast Regen, but never expires on time. Granted by equipment (Tintinibar).'],
  [statusTypeId('shell'), 'Magical damage taken is reduced — +50 magical resistance while active. Composes additively with native resistance.'],
  [statusTypeId('protect'), 'Physical damage taken is reduced — +50 physical resistance while active. Composes additively with native resistance.'],
  [statusTypeId('haste'), 'Speed increased. Composes multiplicatively with the unit’s base Speed.'],
  [statusTypeId('stop'), 'CT freezes — the unit takes no turns and queued charged actions pause until the status expires.'],
  [statusTypeId('silence'), 'Magical abilities can’t be cast. Physical actions are unaffected.'],
  [statusTypeId('blind'), 'Hit chance against the affected unit’s attacks is reduced.'],
  [statusTypeId('dont_move'), 'Can’t use the Move action this turn. Knockback and other forced movement still apply.'],
  [statusTypeId('dont_act'), 'Can’t use abilities or Attack this turn. Reactions (Counter, etc.) still fire.'],
  [statusTypeId('charging'), 'Carrying a queued charged ability. Resolves automatically when the charge timer completes.'],
  [statusTypeId('taunted'), 'Will preferentially target the taunter on AI decisions.'],
  [statusTypeId('vulnerable'), 'Next damage taken is amplified. Consumed on the next hit.'],
  [statusTypeId('pa_up'), 'PA increased — raises physical damage output for the duration.'],
  [statusTypeId('pa_down'), 'PA decreased — reduces physical damage output for the duration.'],
  [statusTypeId('ma_up'), 'MA increased — raises magical damage and healing output for the duration.'],
  [statusTypeId('ma_down'), 'MA decreased — reduces magical damage and healing output for the duration.'],
  [statusTypeId('speed_down'), 'Speed decreased for the duration.'],
  [statusTypeId('movement_self_buff'), '+Move Range while active. Self-applied movement buff.'],
  [statusTypeId('movement_debuff'), '−Move Range while active.'],
  [statusTypeId('crit_modifier'), 'Crit chance / multiplier modified for the duration.'],
  [statusTypeId('tagged_resistance_shift'), 'Per-tag resistance shift carried as instance customState. Composes additively across multiple applications; opposite-signed shifts cancel.'],
  // S50 — Reaction-granted accumulating buffs (parallel pattern across
  // four classes). Each applies +1 to one stat per enemy hit; permanent
  // through KO; Remedy never clears them.
  [statusTypeId('combat_focus'), '+1 PA per stack — granted by the Alchemist’s Combat Focus reaction on enemy damage taken. Permanent through KO.'],
  [statusTypeId('speed_save'), '+1 Speed per stack — granted by the Assassin’s Speed Save reaction on enemy damage taken. Permanent through KO.'],
  [statusTypeId('updraft'), '+1 Jump per stack — granted by the Hunter’s Updraft reaction on enemy damage taken. Permanent through KO.'],
  [statusTypeId('cornered_focus'), '+1 MA per stack — granted by the Calculator’s Cornered Focus reaction on enemy damage taken. Permanent through KO.'],
  [statusTypeId('engineered_defenses'), '+10 per elemental resistance and +5% per-facing evade per stack — granted by the Calculator’s Engineered Defenses cast. Permanent.'],
]);

// Short authored placeholders for the demo passives. Each line is the
// minimum prose that beats "you have to read the source." Replace with
// fuller authored descriptions in the Session 31.5 content pass.
const PASSIVE_DESCRIPTIONS: ReadonlyMap<AbilityId, string> = new Map([
  [abilityId('counter'), 'On taking a non-healing physical hit, swing back at the attacker with the same weapon.'],
  [abilityId('move_plus_1'), '+1 Move Range.'],
  [abilityId('float'), 'Treat water tiles as walkable.'],
  [abilityId('fly'), 'Ignore terrain and jump entirely — move freely over any tile.'],
  [abilityId('earth_resilience'), 'On taking a non-healing hit, gain +1 Move (stackable, lingering).'],
  [abilityId('earth_communion'), '× 1.25 status application chance on every cast.'],
  [abilityId('bedrock_stride'), '+1 Move Range. Falling damage is suppressed.'],
  [abilityId('tidal_pull'), 'On taking damage, the attacker is pulled toward the reactor (Water Mage CT push back on hit).'],
  [abilityId('flow_state'), 'On committing a magical action, refund some CT to the caster.'],
  [abilityId('tidewalker'), 'Water tiles cost 1 less to move through (minimum 1) — shallow water 2→1, deep water 3→2. Does not change Move Range.'],
  [abilityId('smolder'), 'On taking damage, apply 1 stack of Burn to the attacker (uses reactor MA).'],
  [abilityId('ignition'), 'Fire-tagged casts also apply 1 stack of Burn at the proc rate.'],
  [abilityId('aether_bloom'), 'AoE casts gain +1 tile to their area shape.'],
  [abilityId('hotfoot'), '+1 Move Range, +1 Speed.'],
  [abilityId('discharge'), 'On taking damage, retaliate with a Lightning swing at the attacker.'],
  [abilityId('conductor'), '× 1.25 MA multiplier — boosts every magical cast.'],
  [abilityId('quickstep'), 'After any turn where the unit Moved (Move-only or Move + Act both qualify), refund CT equal to MA.'],
  [abilityId('damage_reduction'), 'Reduce incoming non-healing damage by a flat amount.'],
  [abilityId('static_embrace'), '+20 Crit Modifier (passive — drives crit damage when the wielder lands one).'],
  [abilityId('magnetic_mark'), 'Apply Vulnerable to a target on hit — next damage taken is amplified.'],
  // Session 39b — Alchemist R/S/M.
  [abilityId('combat_focus'), 'When hit by an enemy, has a chance to raise PA by 1.'],
  [abilityId('field_kit'), 'Begin the fight with a Potion, Phoenix Down, and Remedy already stocked.'],
  [abilityId('field_recovery'), 'Restores HP equal to the square of the number of spaces moved.'],
  // S41 — Knight R/S/M.
  [abilityId('martial_expertise'), '× 1.25 PA — sharpens every physical hit (Knight’s Support parity to the Lightning Mage’s Conductor on MA).'],
  [abilityId('bravestrider'), '+1 Move Range and +10 Brave — the Knight pushes reactions and Brave-gated status applications harder.'],
  // S48: Bulwark Stance suppressed (no class home; was the original
  // `modifyEvasion` consumer but had no live registration).
  // S42 — Assassin R/S/M.
  [abilityId('two_weapons'), 'Holding a weapon in both hands lets each one swing on basic Attack / Counter / Power Attack. Each swing reads PA × 0.75 — the dual-wield tax.'],
  [abilityId('speed_save'), 'On taking enemy damage, gain +1 Speed permanently. Stacks across the battle and persists through KO.'],
  [abilityId('fleet_of_foot'), '+1 Move Range and +1 Jump — a two-axis mobility package.'],
  // S45 — Hunter R/S/M.
  [abilityId('eagle_eye'), '× 2 physical hit chance — takes the bow’s bare 33 accuracy to ~66%, and saturates the clamp on high-accuracy weapons.'],
  [abilityId('updraft'), 'On taking enemy damage, gain +1 Jump permanently. Stacks across the battle and persists through KO.'],
  [abilityId('high_jump'), '+2 Jump — reach the high ground bows’ elevation-variance rewards.'],
  // S49 — Calculator R/S/M.
  [abilityId('cornered_focus'), 'On taking enemy damage, gain +1 MA permanently. Stacks across the battle and persists through KO — the Calculator sharpens under pressure.'],
  [abilityId('mathematician'), 'Math Skill abilities gain +1 SP (damage / heal / CT push all read +1 to power), and the per-target MP cost drops from 3 to 1 per matching unit.'],
  [abilityId('thoughtful_pacing'), 'Restores MP equal to 2 × spaces moved at the end of each Move action.'],
  // S54 — Terraformer R/S/M (descriptions added S55; S54 shipped the abilities
  // without tooltip lines, so the builder showed the placeholder).
  [abilityId('damage_split'), 'On taking a non-healing hit and surviving, reflect the full damage back at the attacker and heal yourself for half of it.'],
  [abilityId('ignore_height'), 'Ignore Jump height limits entirely — climb or descend any elevation change in one step.'],
  [abilityId('expert_former'), '+2 to the Worldcraft active-effect cap (2 → 4) — twice as many terrain changes / barriers persist at once before the oldest reverts.'],
  // S62 — Templar R/S/M (the four innates).
  [abilityId('faithstrider'), '+1 Move Range and +10 Faith — stronger healing and revival, but more magical damage taken (Faith cuts both ways).'],
  [abilityId('monkeygrip'), 'Two-handed weapons need only one hand — pair a two-hander with a shield, or (with Two Weapons) a second two-hander.'],
  [abilityId('emissary'), '+25% to all healing this unit applies — boosts Cure, Raise, and any healing item it throws. Does not affect Regen.'],
  [abilityId('unified_calling'), 'On receiving a one-time heal (a healing spell, or a Potion / Phoenix Down used on you), recover MP equal to your PA. Not from Regen.'],
]);

// Authored lead-lines for active abilities whose mechanics don't read off
// the auto-generated cost/target/damage lines — currently the S54 Worldcraft
// command set, whose effect is a geometric terrain mutation (no damage/AoE
// spec to format) plus the bounded effect-queue interaction. Prepended to the
// detail lines in `formatActiveDetail` (S55 — the auto lines alone read as a
// bare "Cost: MP 8 · Target: tile", which playtest found unhelpful). The auto
// Cost/Target lines still render below, so these describe the *effect* and the
// queue cost, not the MP/range already shown.
const ACTIVE_DESCRIPTIONS: ReadonlyMap<AbilityId, string> = new Map([
  [abilityId('pillar'), 'Raise a single tile by 4 elevation. Counts as 1 active Worldcraft effect (cap 2; the oldest reverts when exceeded).'],
  [abilityId('pit'), 'Lower a single tile by 4, dropping any unit on it for fall damage. Counts as 1 active Worldcraft effect.'],
  [abilityId('hill'), 'Raise a 3×3 area — center +3, edges +2, corners +1. Counts as 1 active Worldcraft effect.'],
  [abilityId('valley'), 'Lower a 3×3 area — center −3, edges −2, corners −1 — dealing fall damage to occupants. Counts as 1 active Worldcraft effect.'],
  [abilityId('barrier'), 'Spawn a line of 3–5 barrier tiles. Barriers block movement and line of sight, persist ~5 rounds, and take damage from attacks. Counts as 1 active Worldcraft effect.'],
  // S62 — Templar Arts.
  [abilityId('cure'), 'Heal a 1-square cross (≈ MA × 8 × Faith). Friendly fire is on — it heals allies AND any enemies in the cross, and the caster too.'],
  [abilityId('raise'), 'Revive a KO’d ally and heal them (≈ MA × 10 × Faith). On a living target it simply heals.'],
  [abilityId('jump'), 'Leap off-field — untargetable while charging — then land on a tile for PA × WP, doubled with a Lance. Reaches far and high; the target can dodge by leaving the tile. Charges faster the higher your Speed.'],
]);

// Tiny formatting helpers — kept inline rather than a regex zoo so the
// output is easy to scan and edit.
function formatRange(h: number, v: number): string {
  if (h === v) return `${h} tiles`;
  return `${h}H · ${v}V`;
}

function formatPercent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function formatVarianceBand(min: number, max: number): string {
  return `[${min.toFixed(2)}, ${max.toFixed(2)}]`;
}

// Equipment kind label for the tooltip subtitle.
function kindLabel(item: EquipmentDefinition): string {
  switch (item.kind) {
    case 'weapon': {
      const w = item as WeaponEquipment;
      const tag = w.tags?.[0];
      return tag !== undefined ? `Weapon · ${String(tag)}` : 'Weapon';
    }
    case 'shield':
      return 'Shield';
    case 'armor':
      return 'Body Armor';
    case 'headgear':
      return 'Headgear';
    case 'accessory':
      return 'Accessory';
  }
}

// Stat-mod entries → "+2 PA · +30 MP · ×1.5 MaxMP" etc.
function formatStatMods(
  add: EquipmentDefinition['statMods'],
  mul: EquipmentDefinition['statModsMultiplicative'],
): string[] {
  const parts: string[] = [];
  if (add !== undefined) {
    for (const [stat, value] of Object.entries(add)) {
      if (value === undefined) continue;
      const sign = value >= 0 ? '+' : '';
      parts.push(`${sign}${value} ${statShortLabel(stat)}`);
    }
  }
  if (mul !== undefined) {
    for (const [stat, factor] of Object.entries(mul)) {
      if (factor === undefined) continue;
      parts.push(`×${factor} ${statShortLabel(stat)}`);
    }
  }
  return parts;
}

function statShortLabel(key: string): string {
  switch (key) {
    case 'pa':
      return 'PA';
    case 'ma':
      return 'MA';
    case 'spd':
      return 'Spd';
    case 'maxHpBase':
    case 'maxHp':
      return 'HP';
    case 'maxMpBase':
    case 'maxMp':
      return 'MP';
    case 'brave':
      return 'Brave';
    case 'faith':
      return 'Faith';
    case 'crit_chance':
      return 'Crit';
    case 'crit_multiplier':
      return 'Crit×';
    default:
      return key;
  }
}

export function formatItemDetail(item: ItemDefinition, catalog: Catalog): DetailContent {
  // Session 39a: consumables get their own detail render (HP/MP restore
  // amounts, Compound MP cost). S39b will replace this with a fuller
  // panel — until then, the catalog never exposes consumables through
  // any UI surface that calls into here.
  if (item.kind === 'consumable') {
    return formatConsumableDetail(item);
  }
  const lines: string[] = [];

  // Weapon block — WP / accuracy / variance / weapon tags.
  if (item.kind === 'weapon') {
    const w = item as WeaponEquipment;
    const bits: string[] = [`WP ${w.wp}`, `Acc ${w.accuracy}`];
    if (w.range !== undefined) {
      // Session 45: ranged (bow) weapons advertise their reach. Min
      // defaults to 1 (adjacent) when omitted; vertical is shown only
      // when the weapon overrides it (bows shoot across elevation).
      bits.push(`Rng ${w.range.min ?? 1}-${w.range.max}`);
    }
    if (w.rangeFromHeightBonus !== undefined) {
      // Session 52: FFT-canon range-from-height — extra horizontal reach
      // per N tiles the shooter sits above its target. Stacks with the
      // height-delta damage variance ("Var by elevation" below).
      const rh = w.rangeFromHeightBonus;
      bits.push(`+${rh.deltaHorizontal} Rng per ${rh.perDeltaVertical} elev down`);
    }
    if (w.twoHanded === true) bits.push('Two-handed');
    if (w.physicalVariance !== undefined) {
      const pv = w.physicalVariance;
      if (pv.kind === 'static') {
        bits.push(`Var ${formatVarianceBand(pv.min, pv.max)}`);
      } else if (pv.kind === 'attacker_speed') {
        // Speed-based: render the dynamic source so the player sees why
        // the band shifts with the wielder. The actual numerical band
        // (Speed/10 ± spread) lives on the forecast panel for the
        // currently-equipped unit; this surface is the item itself,
        // shown without a wielder context.
        bits.push(`Var Speed/10 ±${pv.spread.toFixed(2)}`);
      } else {
        // Height-delta (bows): variance tracks the elevation the shot is
        // taken from — more from above, less from below.
        bits.push('Var by elevation');
      }
    }
    lines.push(bits.join(' · '));
    if (w.tags !== undefined && w.tags.length > 0) {
      lines.push(`Tags: ${w.tags.map(String).join(', ')}`);
    }
  }

  // Stat modifications (additive + multiplicative).
  const statBits = formatStatMods(item.statMods, item.statModsMultiplicative);
  if (statBits.length > 0) {
    lines.push(`Stats: ${statBits.join(' · ')}`);
  }

  // Movement mods (Move / Jump from non-stat slot — e.g., Lightfoot).
  if (item.movementMods !== undefined) {
    const mm: string[] = [];
    if (item.movementMods.moveRange !== undefined) {
      const v = item.movementMods.moveRange;
      mm.push(`${v >= 0 ? '+' : ''}${v} Move`);
    }
    if (item.movementMods.jump !== undefined) {
      const v = item.movementMods.jump;
      mm.push(`${v >= 0 ? '+' : ''}${v} Jump`);
    }
    if (mm.length > 0) lines.push(`Movement: ${mm.join(' · ')}`);
  }

  // Bucket capacity (Steel Helm, Augmentor, Magus Crown).
  if (item.bucketCapacityMods !== undefined && item.bucketCapacityMods.size > 0) {
    const parts: string[] = [];
    for (const [bucket, delta] of item.bucketCapacityMods) {
      parts.push(`${delta >= 0 ? '+' : ''}${delta} ${bucketLabel(bucket)} capacity`);
    }
    lines.push(parts.join(' · '));
  }

  // Per-tag resistance shifts (Capacitor Ring, future wards).
  if (item.resistanceMods !== undefined && item.resistanceMods.size > 0) {
    const parts: string[] = [];
    for (const [tag, delta] of item.resistanceMods) {
      parts.push(`${delta >= 0 ? '+' : ''}${delta} ${String(tag)} res`);
    }
    lines.push(`Resistance: ${parts.join(' · ')}`);
  }

  // Per-facing evasion (Steel Helm).
  if (item.evasionMods !== undefined) {
    const parts: string[] = [];
    if (item.evasionMods.front !== undefined) {
      parts.push(`${item.evasionMods.front >= 0 ? '+' : ''}${item.evasionMods.front} front`);
    }
    if (item.evasionMods.side !== undefined) {
      parts.push(`${item.evasionMods.side >= 0 ? '+' : ''}${item.evasionMods.side} side`);
    }
    if (item.evasionMods.back !== undefined) {
      parts.push(`${item.evasionMods.back >= 0 ? '+' : ''}${item.evasionMods.back} back`);
    }
    if (parts.length > 0) lines.push(`Evasion: ${parts.join(' · ')}`);
  }

  // Ability-range modifiers (Wand of Depths +1H on water spells). Skip
  // zero deltas — S51's wand refit moved vertical reach off this surface
  // onto `aoeVerticalToleranceModifiers`, so the H/V combined render
  // would emit a meaningless "+0V" suffix.
  if (item.abilityRangeModifiers !== undefined && item.abilityRangeModifiers.length > 0) {
    for (const mod of item.abilityRangeModifiers) {
      const dh = mod.deltaHorizontal ?? 0;
      const dv = mod.deltaVertical ?? 0;
      const parts: string[] = [];
      if (dh !== 0) parts.push(`${dh >= 0 ? '+' : ''}${dh}H`);
      if (dv !== 0) parts.push(`${dv >= 0 ? '+' : ''}${dv}V`);
      if (parts.length === 0) continue;
      const tag = mod.tagFilter?.[0] !== undefined ? `${String(mod.tagFilter[0])}-tagged` : 'all';
      lines.push(`Range: ${parts.join(' · ')} on ${tag} casts`);
    }
  }

  // S51: AoE vertical-tolerance modifiers (Wand of Depths refit, Battle
  // Dictionary book). Renders alongside the range line; widens which
  // elevation bands an AoE actually covers vs. the targeting reach above.
  if (item.aoeVerticalToleranceModifiers !== undefined && item.aoeVerticalToleranceModifiers.length > 0) {
    for (const mod of item.aoeVerticalToleranceModifiers) {
      const tag = mod.tagFilter?.[0] !== undefined ? `${String(mod.tagFilter[0])}-tagged` : 'all';
      lines.push(
        `AoE elevation: ${mod.delta >= 0 ? '+' : ''}${mod.delta} on ${tag} casts`,
      );
    }
  }

  // Action-speed (charge-rate) modifiers (Wand of Deepwood +5 on earth).
  if (item.actionSpeedModifiers !== undefined && item.actionSpeedModifiers.length > 0) {
    for (const mod of item.actionSpeedModifiers) {
      const tag = mod.tagFilter?.[0] !== undefined ? `${String(mod.tagFilter[0])}-tagged` : 'all';
      lines.push(
        `Spell speed: ${mod.delta >= 0 ? '+' : ''}${mod.delta} on ${tag} casts`,
      );
    }
  }

  // MP-cost multipliers (Staff of Power ×1.20).
  if (item.mpCostMultipliers !== undefined && item.mpCostMultipliers.length > 0) {
    for (const factor of item.mpCostMultipliers) {
      const pct = Math.round((factor - 1) * 100);
      const sign = pct >= 0 ? '+' : '';
      lines.push(`MP cost: ${sign}${pct}% on all casts`);
    }
  }

  // Outgoing hit chance multipliers (Arcane Lens × 1.10).
  if (item.outgoingHitChanceMultipliers !== undefined && item.outgoingHitChanceMultipliers.length > 0) {
    for (const factor of item.outgoingHitChanceMultipliers) {
      lines.push(`Hit chance × ${factor.toFixed(2)} on outgoing attacks`);
    }
  }

  // Incoming status modifiers (Focus Band × 0.75 negative; Pointy Hat × 0.5 Silence).
  if (item.incomingStatusModifiers !== undefined && item.incomingStatusModifiers.length > 0) {
    for (const mod of item.incomingStatusModifiers) {
      const factor = mod.chanceMultiplier;
      const subject =
        mod.kind === 'by_type'
          ? catalog.hasStatusType(mod.statusTypeId)
            ? catalog.getStatusType(mod.statusTypeId).name
            : String(mod.statusTypeId)
          : `${String(mod.statusTag)}-tagged statuses`;
      lines.push(`Incoming ${subject}: × ${factor.toFixed(2)} apply chance`);
    }
  }

  // Status-tick-amount (Purifier × 2 negative).
  if (item.statusTickAmountMultipliers !== undefined && item.statusTickAmountMultipliers.length > 0) {
    for (const mod of item.statusTickAmountMultipliers) {
      const subject =
        mod.statusTypeId !== undefined
          ? catalog.hasStatusType(mod.statusTypeId)
            ? catalog.getStatusType(mod.statusTypeId).name
            : String(mod.statusTypeId)
          : mod.statusTag !== undefined
            ? `${String(mod.statusTag)}-tagged statuses`
            : 'every status';
      lines.push(`Tick rate × ${mod.factor.toFixed(2)} on ${subject}`);
    }
  }

  // Status-application stack-count modifiers (Wand of Lumen — fire casts
  // land Burn with one extra stack).
  if (
    item.statusApplicationStackCountModifiers !== undefined &&
    item.statusApplicationStackCountModifiers.length > 0
  ) {
    for (const mod of item.statusApplicationStackCountModifiers) {
      const subject =
        mod.statusTypeId !== undefined
          ? catalog.hasStatusType(mod.statusTypeId)
            ? catalog.getStatusType(mod.statusTypeId).name
            : String(mod.statusTypeId)
          : mod.statusTag !== undefined
            ? `${String(mod.statusTag)}-tagged statuses`
            : 'statuses';
      const gate =
        mod.sourceAbilityTagAll !== undefined && mod.sourceAbilityTagAll.length > 0
          ? `${mod.sourceAbilityTagAll.map(String).join('+')}-tagged casts`
          : 'all casts';
      const stacks = Math.abs(mod.delta) === 1 ? 'stack' : 'stacks';
      lines.push(
        `On ${gate}: ${subject} applies with ${mod.delta >= 0 ? '+' : ''}${mod.delta} ${stacks}`,
      );
    }
  }

  // attackProcs (Bolt Hammer, Flametongue, wands).
  if (item.attackProcs !== undefined && item.attackProcs.length > 0) {
    for (const proc of item.attackProcs) {
      const procName = catalog.hasAbility(proc.abilityId)
        ? catalog.getAbility(proc.abilityId).name
        : String(proc.abilityId);
      lines.push(`On hit: ${formatPercent(proc.chance)} chance to trigger ${procName}`);
    }
  }

  // damageMpDrainPercent (Rasp Pendant).
  if (item.damageMpDrainPercent !== undefined && item.damageMpDrainPercent > 0) {
    lines.push(`On hit: drain ${item.damageMpDrainPercent}% of final damage as MP from target`);
  }

  // attackSwingMultiplier (The Offering — swings-per-weapon on basic Attack).
  if (item.attackSwingMultiplier !== undefined && item.attackSwingMultiplier > 1) {
    lines.push(
      `Basic Attack: each equipped weapon swings ${item.attackSwingMultiplier}× ` +
        `(stacks with Two Weapons; not reactions or Battle Skills)`,
    );
  }

  // Status grants (Auto-Haste, Auto-Shell, Auto-Regen).
  if (item.statusGrants !== undefined && item.statusGrants.length > 0) {
    const names = item.statusGrants.map((id) =>
      catalog.hasStatusType(id) ? catalog.getStatusType(id).name : String(id),
    );
    lines.push(`Grants at battle start: ${names.join(', ')}`);
  }

  // Class restrictions (mage-only robes, Knight-only shields).
  if (item.classRestrictions !== undefined && item.classRestrictions.length > 0) {
    const names = item.classRestrictions.map((id) =>
      catalog.hasClass(id) ? catalog.getClass(id).name : String(id),
    );
    lines.push(`Class restricted: ${names.join(', ')}`);
  }

  // Item-level damage tags (separate from weapon-specific tags shown above).
  if (item.kind !== 'weapon' && item.tags !== undefined && item.tags.length > 0) {
    lines.push(`Tags: ${item.tags.map(String).join(', ')}`);
  }

  if (lines.length === 0) lines.push('(no mechanical effect declared)');

  return {
    title: item.name,
    subtitle: kindLabel(item),
    lines,
  };
}

function formatConsumableDetail(item: ConsumableDefinition): DetailContent {
  const lines: string[] = [];
  lines.push(`Compound: MP ${item.compoundMpCost}`);
  const fx = item.effects;
  if (fx.removeKO === true) {
    lines.push('Revives KO');
  }
  if (fx.hpRestore !== undefined) {
    lines.push(`Restores PA × ${fx.hpRestore.coefficient} HP`);
  }
  if (fx.mpRestore !== undefined) {
    lines.push(`Restores PA × ${fx.mpRestore.coefficient} MP`);
  }
  if (fx.clearStatuses !== undefined) {
    lines.push('Clears negative statuses');
  }
  if (lines.length === 1) lines.push('(no on-throw effect declared)');
  return {
    title: item.name,
    subtitle: 'Consumable',
    lines,
  };
}

export function formatAbilityDetail(
  ability: AbilityDefinition,
  catalog: Catalog,
): DetailContent {
  if (ability.kind === 'active') return formatActiveDetail(ability, catalog);
  return formatPassiveDetail(ability, catalog);
}

function formatActiveDetail(ability: ActiveAbilityDefinition, catalog: Catalog): DetailContent {
  const lines: string[] = [];

  // Authored effect description (Worldcraft etc.) leads, when present.
  const authored = ACTIVE_DESCRIPTIONS.get(ability.id);
  if (authored !== undefined) lines.push(authored);

  // Cost line: MP cost + action speed (charge time).
  const costParts: string[] = [];
  if (ability.mpCost > 0) costParts.push(`MP ${ability.mpCost}`);
  if (ability.actionSpeed > 0) costParts.push(`Charge ${ability.actionSpeed}`);
  if (costParts.length > 0) lines.push(`Cost: ${costParts.join(' · ')}`);

  // Targeting.
  if (
    ability.targeting.kind === 'single_unit' ||
    ability.targeting.kind === 'tile' ||
    ability.targeting.kind === 'unit_or_tile'
  ) {
    const range = ability.targeting.range;
    const mode = ability.targeting.rangeMode;
    const label =
      ability.targeting.kind === 'tile'
        ? 'tile'
        : ability.targeting.kind === 'unit_or_tile'
          ? 'unit or tile'
          : 'unit';
    lines.push(`Target: ${label} · ${formatRange(range.horizontal, range.vertical)} (${mode})`);
  } else if (ability.targeting.kind === 'self') {
    lines.push('Target: self');
  }

  // Damage spec.
  const dmg = ability.effects.damage;
  if (dmg !== undefined) {
    const tagSeg = dmg.tags.map(String).join(', ');
    const power = dmg.power_coefficient ?? 1;
    if (dmg.tags.includes('healing')) {
      lines.push(`Heal: MA × ${power} × Faith`);
    } else if (dmg.tags.includes('magical')) {
      lines.push(`Damage: MA × ${power} × Faith [${tagSeg}]`);
    } else if (dmg.tags.includes('physical')) {
      lines.push(`Damage: PA × WP × ${power} × Brave [${tagSeg}]`);
    }
    if (dmg.variance !== undefined) {
      lines.push(`Variance: ${formatVarianceBand(dmg.variance.min, dmg.variance.max)}`);
    }
    if (dmg.ctPush !== undefined) {
      lines.push(`CT push (on hit): −${dmg.ctPush.factor} × caster MA`);
    }
    if (dmg.knockback !== undefined) {
      // `knockback.chance` is authored in 0–100 scale (engine reads it as
      // baseChance against Faith × MA factors), distinct from `proc.chance`
      // / `formatPercent`'s 0–1 probability convention.
      const chanceSeg = dmg.knockback.chance === undefined ? '(always)' : `at ${Math.round(dmg.knockback.chance)}%`;
      lines.push(`Knockback: ${dmg.knockback.distance} tiles ${chanceSeg}`);
    }
    if (dmg.chainBonus !== undefined) {
      lines.push(`Chain bonus: +${dmg.chainBonus.powerPerAdditionalTarget} power per extra target`);
    }
  }

  // AoE.
  if (ability.effects.aoe !== undefined) {
    const a = ability.effects.aoe;
    lines.push(`AoE: ${a.shape.kind}${a.anchorMode === 'caster' ? ' (caster-anchored)' : ''}`);
  }

  // Status effects.
  if (ability.effects.statusEffects !== undefined) {
    for (const fx of ability.effects.statusEffects) {
      const name = catalog.hasStatusType(fx.typeId)
        ? catalog.getStatusType(fx.typeId).name
        : String(fx.typeId);
      const chance =
        fx.applyAlways === true
          ? 'always'
          : fx.baseChance !== undefined
            ? `${fx.baseChance}% base`
            : '100% base';
      const target = fx.target === 'caster' ? 'self' : 'target';
      const stacks = fx.stackQuantity !== undefined && fx.stackQuantity > 1 ? ` × ${fx.stackQuantity}` : '';
      lines.push(`Apply ${name}${stacks} to ${target} (${chance})`);
    }
  }

  // CT effects.
  if (ability.effects.ctEffects !== undefined) {
    for (const fx of ability.effects.ctEffects) {
      const sign = fx.factor >= 0 ? '+' : '';
      const target = fx.target === 'caster' ? 'self' : 'target';
      const chance = fx.baseChance !== undefined ? `${fx.baseChance}% base` : '100% base';
      lines.push(`CT: ${sign}${fx.factor} × caster MA on ${target} (${chance})`);
    }
  }

  // Self-damage (Storm Caller).
  if (ability.selfDamage !== undefined) {
    lines.push(`Self-damage: ${Math.round(ability.selfDamage.fraction * 100)}% of caster MaxHP per cast`);
  }

  // Hit roll presence.
  if (ability.hitRoll !== undefined) {
    if (ability.hitRoll.accuracy !== undefined) {
      lines.push(`Accuracy override: ${ability.hitRoll.accuracy}`);
    } else if (dmg !== undefined && !dmg.tags.includes('magical')) {
      // Physical attack — uses weapon accuracy.
      lines.push('Accuracy: from equipped weapon');
    }
  }

  // Tags line (if not already implied by damage tags).
  if (ability.tags !== undefined && ability.tags.length > 0 && dmg === undefined) {
    lines.push(`Tags: ${ability.tags.map(String).join(', ')}`);
  }

  if (lines.length === 0) lines.push('(no mechanical effect declared)');

  return {
    title: ability.name,
    subtitle: `${bucketLabel(ability.bucket)} ability`,
    lines,
  };
}

// Per-member one-liner for command-set tooltips (S48). Compact enough
// to render five abilities in a single tooltip card without overflowing
// the panel; the full per-ability detail content remains available via
// the action menu in battle.
function formatActiveOneLiner(
  ability: ActiveAbilityDefinition,
  catalog: Catalog,
): string {
  const parts: string[] = [];
  if (ability.mpCost > 0) parts.push(`MP ${ability.mpCost}`);
  if (ability.actionSpeed > 0) parts.push(`Charge ${ability.actionSpeed}`);
  const dmg = ability.effects.damage;
  if (dmg !== undefined) {
    // Tag-driven shorthand: "Heal MA×P", "Magical MA×P", "Physical PA×WP×P".
    const power = dmg.power_coefficient ?? 1;
    if (dmg.tags.includes('healing')) {
      parts.push(`Heal MA×${power}`);
    } else if (dmg.tags.includes('magical')) {
      parts.push(`MA×${power}`);
    } else if (dmg.tags.includes('physical')) {
      parts.push(`PA×WP×${power}`);
    }
  }
  if (ability.effects.aoe !== undefined) {
    parts.push(`AoE ${ability.effects.aoe.shape.kind}`);
  }
  if (ability.effects.statusEffects !== undefined) {
    const names = ability.effects.statusEffects.map((fx) =>
      catalog.hasStatusType(fx.typeId)
        ? catalog.getStatusType(fx.typeId).name
        : String(fx.typeId),
    );
    parts.push(`+${names.join('/')}`);
  }
  return `${ability.name}${parts.length > 0 ? ' — ' + parts.join(' · ') : ''}`;
}

// Command-set hover content (S48). Lists the set's member abilities
// with a compact one-liner per ability so a player can compare the
// secondary-set picks at a glance without leaving the team builder.
// The full per-ability detail (range, accuracy, variance, knockback,
// etc.) renders during battle on the action menu's existing tooltip.
export function formatCommandSetDetail(
  set: CommandSetDefinition,
  catalog: Catalog,
): DetailContent {
  const lines: string[] = [];
  if (set.members.length === 0) {
    lines.push('(empty set — no member abilities)');
  } else {
    for (const memberId of set.members) {
      if (!catalog.hasAbility(memberId)) {
        lines.push(`${String(memberId)} (unregistered)`);
        continue;
      }
      const ability = catalog.getAbility(memberId);
      if (ability.kind === 'active') {
        lines.push(formatActiveOneLiner(ability, catalog));
      } else {
        // Passives don't normally live inside a command set, but the
        // shape allows it. Fall back to the authored description.
        const desc = PASSIVE_DESCRIPTIONS.get(ability.id);
        lines.push(`${ability.name}${desc !== undefined ? ' — ' + desc : ''}`);
      }
    }
  }
  if (set.baseCost > 0) {
    lines.push(`Set cost: ${set.baseCost}`);
  }
  return {
    title: set.name,
    subtitle: `Command Set · ${set.members.length} abilit${set.members.length === 1 ? 'y' : 'ies'}`,
    lines,
  };
}

function formatPassiveDetail(ability: PassiveAbilityDefinition, catalog: Catalog): DetailContent {
  void catalog;
  const lines: string[] = [];

  // Authored description (preferred).
  const desc = PASSIVE_DESCRIPTIONS.get(ability.id);
  if (desc !== undefined) {
    lines.push(desc);
  } else {
    lines.push(`(Description not yet authored — flag for Session 31.5 content pass.)`);
    // Best-effort hook-name summary so the curious reader sees what
    // surfaces the passive registers against.
    const hookNames = new Set<string>();
    for (const h of ability.hooks) hookNames.add(h.name);
    if (hookNames.size > 0) {
      lines.push(`Registers hooks: ${Array.from(hookNames).join(', ')}`);
    }
  }

  // Cost (visible across all passives — relevant when capacity matters).
  lines.push(`Cost: ${ability.baseCost} · ${bucketLabel(ability.bucket)}`);

  // Tags.
  if (ability.tags !== undefined && ability.tags.length > 0) {
    lines.push(`Tags: ${ability.tags.map(String).join(', ')}`);
  }

  return {
    title: ability.name,
    subtitle: `${bucketLabel(ability.bucket)} passive`,
    lines,
  };
}

// Status-effect hover content. Session 31.5 extension: the same
// DetailHover surface that abilities + items use now covers active
// statuses on units. Pulls from the status type's catalog fields plus
// the optional per-instance state (`magnitude`, `stacks`, `remainingDuration`,
// `customState`) so the tooltip surfaces the live values when an
// instance is available (unit detail panel, tile-info chip) and falls
// back to the static type-level summary when not.
//
// Title prefers the instance's `customState.displayName` when present
// (the parametric `tagged_resistance_shift` carries per-application
// names like "Wand of the Depths Resonance"); otherwise the type name.
export function formatStatusDetail(
  type: StatusEffectType,
  instance: StatusInstance | null = null,
): DetailContent {
  const lines: string[] = [];

  // 1. Authored description (preferred), else a hook-list fallback.
  const desc = STATUS_DESCRIPTIONS.get(type.id);
  if (desc !== undefined) {
    lines.push(desc);
  } else {
    const hookNames = new Set<string>();
    for (const h of type.hooks) hookNames.add(h.name);
    if (hookNames.size > 0) {
      lines.push(`Hooks: ${Array.from(hookNames).join(', ')}`);
    }
  }

  // 2. Duration (instance-aware).
  const durationLine = formatStatusDuration(type, instance);
  if (durationLine !== null) lines.push(durationLine);

  // 3. Magnitude (instance's value preferred over type default).
  const magnitude = instance?.magnitude ?? type.defaultMagnitude;
  if (magnitude !== undefined) {
    lines.push(`Magnitude: ${magnitude}`);
  }

  // 4. Stacks (only when relevant — instance has > 1).
  if (instance?.stacks !== undefined && instance.stacks > 1) {
    lines.push(`Stacks: ${instance.stacks}`);
  }

  // 5. customState — known shapes get specific rendering; unknown
  // shapes get a one-line key:value dump for the curious reader.
  const cs = instance?.customState;
  if (cs !== undefined) {
    if (isTagDeltasState(cs)) {
      const parts: string[] = [];
      for (const [tag, delta] of Object.entries(cs.tagDeltas)) {
        if (delta === undefined || delta === 0) continue;
        const sign = delta > 0 ? '+' : '';
        parts.push(`${tag} ${sign}${delta}`);
      }
      if (parts.length > 0) lines.push(`Shift: ${parts.join(', ')}`);
    }
  }

  // 6. Resistance tag — when present, status application reads through
  // `(100 - resistance)/100` against this tag on the target.
  if (type.resistanceTag !== undefined) {
    lines.push(`Resisted by: ${type.resistanceTag}`);
  }

  // 7. Stacking rule (informational; matters when the player tries to
  // double-apply or wonders whether duration refreshes).
  lines.push(`Stacking: ${type.stackingRule}`);

  // 8. Tags line — `'positive' | 'negative' | 'dispellable' | …`
  if (type.tags.length > 0) {
    lines.push(`Tags: ${type.tags.map(String).join(', ')}`);
  }

  // Title prefers the customState displayName when present (used by
  // tagged_resistance_shift's per-application names).
  let title = type.name;
  if (cs !== undefined && typeof (cs as { displayName?: unknown }).displayName === 'string') {
    title = (cs as { displayName: string }).displayName;
  }

  const subtitle = formatStatusSubtitle(type);

  return { title, subtitle, lines };
}

function formatStatusDuration(
  type: StatusEffectType,
  instance: StatusInstance | null,
): string | null {
  switch (type.durationMode) {
    case 'permanent':
      return 'Duration: permanent';
    case 'permanent_per_unit_ct':
      return 'Duration: permanent (ticks each CT-100)';
    case 'custom':
      return 'Duration: event-driven';
    case 'conditional':
      return 'Duration: until cleared';
    case 'per_unit_ct': {
      if (instance?.remainingDuration !== null && instance?.remainingDuration !== undefined) {
        return `Duration: ${instance.remainingDuration} CT (per-unit cadence)`;
      }
      return 'Duration: per-unit CT';
    }
    case 'turn_based': {
      if (instance?.remainingDuration !== null && instance?.remainingDuration !== undefined) {
        return `Duration: ${instance.remainingDuration} turn(s)`;
      }
      return 'Duration: per turn';
    }
    case 'global_ticks': {
      if (instance?.remainingDuration !== null && instance?.remainingDuration !== undefined) {
        return `Duration: ${instance.remainingDuration} ticks (global)`;
      }
      return 'Duration: global ticks';
    }
  }
}

function formatStatusSubtitle(type: StatusEffectType): string {
  const polarity = type.aiHints?.polarity;
  if (polarity === 'buff') return 'Status · Buff';
  // Match the catalog's documented "default to debuff" convention
  // (status-effect-type.ts) for any status without an aiHints
  // declaration — Burn, Poison, Don't Move, etc. all surface as Debuff.
  if (polarity === 'debuff' || polarity === undefined) return 'Status · Debuff';
  return 'Status';
}

function isTagDeltasState(
  cs: Readonly<Record<string, unknown>>,
): cs is { readonly tagDeltas: Readonly<Record<DamageTag, number>>; readonly displayName?: string } {
  const td = (cs as { tagDeltas?: unknown }).tagDeltas;
  if (td === null || typeof td !== 'object') return false;
  return true;
}

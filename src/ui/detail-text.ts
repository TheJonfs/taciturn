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
  isWeaponDelivered,
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
  [statusTypeId('shell'), 'Halves incoming magical damage (×0.5) after resistance sets the rate. Does not reduce magic you absorb (resistance > 100). Display name "Shell" whether cast or from gear.'],
  [statusTypeId('shell_cast'), 'Halves incoming magical damage (×0.5) after resistance sets the rate. Does not reduce magic you absorb. The timed, cast form of Shell.'],
  [statusTypeId('protect'), 'Halves incoming physical damage (×0.5) after resistance sets the rate. Does not reduce physical you absorb (resistance > 100). Display name "Protect" whether cast or from gear.'],
  [statusTypeId('protect_cast'), 'Halves incoming physical damage (×0.5) after resistance sets the rate. Does not reduce physical you absorb. The timed, cast form of Protect.'],
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
  [statusTypeId('resistance_save'), '+10 to each elemental resistance (earth/water/fire/lightning) per stack — granted by the Enchanter’s Resistance Save reaction on magical damage taken. Permanent through KO; uncapped.'],
  // S76 — the Monk's four mutually-exclusive elemental stances. Holding one
  // replaces any other; Chakra clears to neutral. Resistance only; no tick.
  [statusTypeId('fox_stance'), 'Fox Stance: +50 Fire resistance, −50 Earth. Set by Foxfire. Replaced by another Fist; cleared by Chakra.'],
  [statusTypeId('bear_stance'), 'Bear Stance: +50 Earth resistance, −50 Lightning. Set by Bear’s Heave. Replaced by another Fist; cleared by Chakra.'],
  [statusTypeId('falcon_stance'), 'Falcon Stance: +50 Lightning resistance, −50 Water. Set by Storm Stoop. Replaced by another Fist; cleared by Chakra.'],
  [statusTypeId('serpent_stance'), 'Serpent Stance: +50 Water resistance, −50 Fire. Set by Serpent’s Coil. Replaced by another Fist; cleared by Chakra.'],
  // TABA Ch3 weapon uniques.
  [statusTypeId('speed_up'), '+1 Speed per application, accumulating — the Shadowblade steals tempo for its wielder on each landed proc. Permanent; Remedy never clears it.'],
  [statusTypeId('gilded_focus'), '+1 MA per stack — granted each turn start by the Golden Rod’s pact. Permanent and accumulating for as long as the wielder survives the drain.'],
  [statusTypeId('golden_rod_pact'), 'Every turn start: lose 10% of Max HP and 10% of Max MP (flat, of the maximum — the HP loss CAN kill), then gain one Gilded Focus stack (+1 MA, permanent). Carried by the Golden Rod; removed only by unequipping it.'],
]);

// Short authored placeholders for the demo passives. Each line is the
// minimum prose that beats "you have to read the source." Replace with
// fuller authored descriptions in the Session 31.5 content pass.
const PASSIVE_DESCRIPTIONS: ReadonlyMap<AbilityId, string> = new Map([
  [abilityId('counter'), 'On taking a non-healing physical hit, swing back at the attacker with the same weapon.'],
  [abilityId('move_plus_1'), '+1 Move Range.'],
  [abilityId('float'), 'Cross shallow and deep water at no extra move cost (both drop to 1 per tile), and take no damage from falls — knockback off a ledge or a tile collapsing underfoot. No elevation change: it’s not flight.'],
  [abilityId('fly'), 'Ignore terrain and jump entirely — move freely over any tile.'],
  [abilityId('earth_resilience'), 'On taking a non-healing hit, gain +1 Move (stackable, lingering).'],
  [abilityId('earth_communion'), '× 1.25 status application chance on every cast.'],
  [abilityId('bedrock_stride'), '+1 Move Range. Falling damage is suppressed.'],
  [abilityId('tidal_pull'), 'On taking a non-healing hit, gain +20 CT — your next turn comes sooner. (It pulls your own turn forward, not the enemy toward you.)'],
  [abilityId('flow_state'), 'On committing a magical action, refund some CT to the caster.'],
  [abilityId('tidewalker'), 'Water tiles cost 1 less to move through (minimum 1) — shallow water 2→1, deep water 3→2. Does not change Move Range.'],
  [abilityId('smolder'), 'On taking damage, apply 1 stack of Burn to the attacker (uses reactor MA).'],
  [abilityId('ignition'), 'On dealing magical damage of any element (not just fire), apply 1 stack of Burn to the target. Healing doesn’t trigger it.'],
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
  [abilityId('eagle_eye'), '× 2 physical hit chance — takes the bows’ bare 40 accuracy to ~80%, and saturates the clamp on high-accuracy weapons.'],
  [abilityId('vantage'), 'Your attacks resolve as if you stood 2 elevation higher: bigger downhill bow damage, +5% high-ground accuracy, longer bow range-from-height, and line of sight that can clear cover (even a Barrier). Attacker-only — never affects you as a target, your movement, or area effects.'],
  [abilityId('updraft'), 'On taking enemy damage, gain +1 Jump permanently. Stacks across the battle and persists through KO.'],
  // S72 — Enchanter R/S/M.
  [abilityId('resistance_save'), 'On taking magical damage, gain +10 to every elemental resistance (earth/water/fire/lightning), permanently. Stacks across the battle and persists through KO — uncapped, so prolonged magical fire hardens you toward immunity.'],
  [abilityId('short_charge'), 'All your charged spells resolve ~33% sooner (the charge accumulates faster). Works on any class’s charged abilities; instant actions are unaffected.'],
  [abilityId('aura_mastery'), 'The buffs you cast land ~33% stronger — deeper Haste, Protect, Shell, Regen, Engineered Defenses, and Crit boosts. Only your spell-cast buffs; equipment-granted buffs and flat stat boosts (PA/MA/Move/Jump Up) are unaffected.'],
  [abilityId('high_jump'), '+2 Jump — reach the high ground bows’ elevation-variance rewards.'],
  // S49 — Calculator R/S/M.
  [abilityId('cornered_focus'), 'On taking enemy damage, gain +1 MA permanently. Stacks across the battle and persists through KO — the Calculator sharpens under pressure.'],
  [abilityId('mathematician'), 'Math Skill abilities gain +1 SP (damage / heal / CT push all read +1 to power), and the per-target MP cost drops from 3 to 1 per matching unit.'],
  [abilityId('thoughtful_pacing'), 'Restores MP equal to 2 × spaces moved at the end of each Move action.'],
  // S54 — Terraformer R/S/M (descriptions added S55; S54 shipped the abilities
  // without tooltip lines, so the builder showed the placeholder).
  [abilityId('damage_split'), 'On taking a non-healing hit and surviving, reflect half the damage back at the attacker and heal yourself for the other half.'],
  [abilityId('ignore_height'), 'Ignore Jump height limits entirely — climb or descend any elevation change in one step.'],
  [abilityId('expert_former'), '+2 to the Worldcraft active-effect cap (2 → 4) — twice as many terrain changes / barriers persist at once before the oldest reverts.'],
  // S62 — Templar R/S/M (the four innates).
  [abilityId('faithstrider'), '+1 Move Range and +10 Faith — stronger healing and revival, but more magical damage taken (Faith cuts both ways).'],
  [abilityId('monkeygrip'), 'Two-handed weapons need only one hand — pair a two-hander with a shield, or (with Two Weapons) a second two-hander.'],
  [abilityId('emissary'), '+25% to all healing this unit applies — boosts Cure, Raise, and any healing item it throws. Does not affect Regen.'],
  [abilityId('unified_calling'), 'On receiving a one-time heal (a healing spell, or a Potion / Phoenix Down used on you), recover MP equal to your PA. Not from Regen.'],
  // Thief — the three native R/S/M.
  [abilityId('slip_free'), 'When a debuff lands on you, immediately advance it one tick — a 1-turn debuff is shrugged off entirely. Brave-gated, like a reaction.'],
  [abilityId('momentum'), 'After any non-magical action — the basic Attack included — refund a little CT. Keeps MP-banking turns tempo-positive.'],
  [abilityId('move_plus_2'), '+2 Move Range.'],
  // S76 — the Monk's three innate passives.
  [abilityId('barehanded'), 'While both hands are empty, your Weapon Power becomes your PA — so the basic Attack (punch) hits for PA² instead of the unarmed PA × 1. The four Fists are NOT weapon strikes, so they stay at PA × coefficient and never PA²-explode.'],
  [abilityId('counterpunch'), 'On taking a non-healing physical hit from an adjacent attacker, swing back for PA × 4 with a PA-scaled chance to knock them back 1 tile. Ranged and magical hits don’t trigger it. Brave-gated like any reaction.'],
  [abilityId('vigilance'), 'Raises evasion on ALL facings — front, side, and back — by half your PA. Lifting back evasion off the floor means you resist flanking, the core of the Monk’s anti-physical profile.'],
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
  [abilityId('cure'), 'Heal a 1-square diamond (≈ MA × 8 × Faith). Friendly fire is on — it heals allies AND any enemies in the area, and the caster too.'],
  [abilityId('raise'), 'Revive a KO’d ally and heal them (≈ MA × 10 × Faith). Targets only KO’d units — it can’t be used as a heal on a living ally.'],
  [abilityId('jump'), 'Leap off-field — untargetable while charging — then land on a tile for PA × WP, doubled with a Lance. Reaches far and high; the target can dodge by leaving the tile. Charges faster the higher your Speed.'],
  // Thief — Thievery (the resource-theft kit).
  [abilityId('steal_hp'), 'A weapon strike for ~75% damage that heals you for half the damage dealt. Uses the equipped weapon’s range (melee, or a bow’s reach); evadable, and only heals on damage actually dealt.'],
  [abilityId('steal_mp'), 'Drain PA × 3 MP from the target and recover half of what was actually taken — no free MP off a near-empty target. Uses the equipped weapon’s range; evadable.'],
  [abilityId('steal_buffs'), 'Strip every positive status off the target and apply them all to yourself. Chance scales with PA and your Brave minus theirs (base 33%).'],
  [abilityId('steal_heart'), 'Charm an enemy of the opposite gender for 3 turns — you control them while it lasts. Low chance scaling with PA and Brave (base 10%); any damage they take has a 50% chance to snap them out early.'],
  // S72 — Auramancy (Enchanter). The three buffs share a chance (~90% on a
  // normal-Faith ally, climbing with MA, dropping hard on low-Faith allies);
  // friendly fire is on, so the diamond also catches the caster and any enemy
  // standing in it. Each buff lasts ~6 of the target's turns, then fades.
  [abilityId('enchant_haste'), 'Buff a 1-square diamond with Haste (Speed ×1.5) for several turns. ~90% to land on a normal-Faith ally — higher with more MA, lower on faithless allies. Friendly fire: also buffs you and any enemy in the area.'],
  [abilityId('enchant_protect'), 'Buff a 1-square diamond with Protect (half incoming physical damage) for several turns. ~90% to land on a normal-Faith ally, scaling with MA / target Faith. Friendly fire: also buffs you and any enemy in the area.'],
  [abilityId('enchant_shell'), 'Buff a 1-square diamond with Shell (half incoming magical damage) for several turns. ~90% to land on a normal-Faith ally, scaling with MA / target Faith. Friendly fire: also buffs you and any enemy in the area.'],
  [abilityId('esuna'), 'Cleanse a 1-square diamond — strip every ailment (Poison, Blind, Silence, Stop, Don’t Act/Move, Slow, Burn…) from each unit. Always works; ignores Faith. Leaves committed stat-downs (PA/MA Down, etc.) alone. Friendly fire: also cleanses you and any enemy in the area.'],
  // S76 — Martial Arts (Monk). Chakra plus the four elemental Fists. Each Fist
  // hits for PA × coefficient (element-tagged, reduced by the target's
  // resistance in that element — absorbed if they resist it past 100), sets a
  // stance, and replaces any stance already up.
  [abilityId('chakra'), 'Heal HP and restore MP for yourself and everyone in a 1-square diamond, scaling off PA (no Faith, never crits). Friendly fire: also mends enemies in the area. Clears your stance to neutral — the turn you heal, your elemental guard drops.'],
  [abilityId('foxfire'), 'Fire Fist (PA × 8): a melee strike tagged Fire with a 50% chance to apply Burn, landing via the PA + Brave path. Sets Fox Stance (+50 Fire / −50 Earth).'],
  [abilityId('bears_heave'), 'Grapple-throw: grab an adjacent unit (enemy or ally) and place it on any tile within 2 — onto a hazard, off a ledge (the fall hurts), or an ally to safety. No direct damage. Sets Bear Stance (+50 Earth / −50 Lightning).'],
  [abilityId('storm_stoop'), 'Lightning Fist (PA × 7): a 3-tile line tagged Lightning — reach down a lane and hit everyone in it. Sets Falcon Stance (+50 Lightning / −50 Water).'],
  [abilityId('serpents_coil'), 'Water Fist (PA × 7): a melee strike tagged Water that, on a hit, refunds Speed × 2 CT so your next turn comes sooner. Sets Serpent Stance (+50 Water / −50 Fire).'],
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

// Resonance procs (the four wands) fire a hidden ability that applies a
// parametric `tagged_resistance_shift`; the actual resistance deltas live on
// that ability's per-instance `customState.tagDeltas`. Surface them so the
// wand tooltip names which resistances move and which direction (S71 #8),
// rather than a bare "triggers <Resonance>".
function formatResonanceShift(procAbilityId: AbilityId, catalog: Catalog): string | null {
  if (!catalog.hasAbility(procAbilityId)) return null;
  const ability = catalog.getAbility(procAbilityId);
  if (ability.kind !== 'active') return null;
  const specs = ability.effects.statusEffects;
  if (specs === undefined) return null;
  for (const spec of specs) {
    if (spec.typeId !== statusTypeId('tagged_resistance_shift')) continue;
    const tagDeltas = (spec.customState as { tagDeltas?: Record<string, number> } | undefined)
      ?.tagDeltas;
    if (tagDeltas === undefined) continue;
    const parts: string[] = [];
    for (const [tag, delta] of Object.entries(tagDeltas)) {
      if (delta === undefined || delta === 0) continue;
      parts.push(`${delta > 0 ? '+' : ''}${delta} ${tag}`);
    }
    if (parts.length > 0) return parts.join(' · ');
  }
  return null;
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

  // Action-speed (charge-rate) modifiers (Wand of Deepwood +5 on earth;
  // Trident +5 on Templar Arts members via commandSetFilter).
  if (item.actionSpeedModifiers !== undefined && item.actionSpeedModifiers.length > 0) {
    for (const mod of item.actionSpeedModifiers) {
      const scope =
        mod.commandSetFilter !== undefined
          ? `${catalog.hasCommandSet(mod.commandSetFilter) ? catalog.getCommandSet(mod.commandSetFilter).name : String(mod.commandSetFilter)} casts`
          : mod.tagFilter?.[0] !== undefined
            ? `${String(mod.tagFilter[0])}-tagged casts`
            : 'all casts';
      lines.push(`Spell speed: ${mod.delta >= 0 ? '+' : ''}${mod.delta} on ${scope}`);
    }
  }

  // Spell-power (magical power_coefficient) modifiers (Wand of Potential
  // +1 SP on lightning casts; Moon Robe ×1.5 on water). Tag-gated,
  // caster-side — mirrors the action-speed / range rider shape above. A
  // factor entry renders multiplicatively (its delta is authored 0 —
  // "SP +0" was the Ch3-brief missing-arm bug); per-extra-target deltas
  // name their scaling.
  if (item.spellPowerModifiers !== undefined && item.spellPowerModifiers.length > 0) {
    for (const mod of item.spellPowerModifiers) {
      const tag = mod.tagFilter?.[0] !== undefined ? `${String(mod.tagFilter[0])}-tagged` : 'all';
      if (mod.factor !== undefined && mod.factor !== 1) {
        lines.push(`Spell Power: × ${mod.factor.toFixed(2)} on ${tag} casts`);
      } else if (mod.perExtraTarget === true) {
        lines.push(
          `Spell Power: ${mod.delta >= 0 ? '+' : ''}${mod.delta} SP per target beyond the first on ${tag} casts`,
        );
      } else {
        lines.push(`Spell Power: ${mod.delta >= 0 ? '+' : ''}${mod.delta} SP on ${tag} casts`);
      }
    }
  }

  // Lance pierce (S95 display sweep — the field shipped S62/ADR-0102 with
  // no detail arm, so all five lances hid their signature behavior).
  if (item.kind === 'weapon' && item.pierces === true) {
    lines.push(
      'Basic Attack: pierces — strikes a 2-tile line (the target and the unit behind; ' +
        'an intervening ally is hit too)',
    );
  }

  // Weapon-attack AoE (Volley Bow — the target-anchored attack-shape seam).
  if (item.kind === 'weapon' && item.attackAoe !== undefined) {
    lines.push(
      `Basic Attack: strikes every unit in a diamond-${item.attackAoe.radius} area ` +
        `around the aimed tile (empty ground aimable) — allies included`,
    );
  }

  // Cast-time MP dump (Del's Stave — the dynamic-SP-from-MP seam).
  if (item.kind === 'weapon' && item.castMpDump !== undefined) {
    lines.push(
      `On any magical cast: spends ALL current MP; ` +
        `+1 Spell Power per ${item.castMpDump.mpPerBonusSp} MP spent beyond the spell's cost`,
    );
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
      // S95 display sweep: the `sourceAbilityTagAny` gate (Prism Wand)
      // rendered as "all casts" — the any-of arm was missing.
      const gateParts: string[] = [];
      if (mod.sourceAbilityTagAll !== undefined && mod.sourceAbilityTagAll.length > 0) {
        gateParts.push(`${mod.sourceAbilityTagAll.map(String).join('+')}-tagged`);
      }
      if (mod.sourceAbilityTagAny !== undefined && mod.sourceAbilityTagAny.length > 0) {
        gateParts.push(`${mod.sourceAbilityTagAny.map(String).join('/')}-tagged`);
      }
      const gate = gateParts.length > 0 ? `${gateParts.join(' ')} casts` : 'all casts';
      const stacks = Math.abs(mod.delta) === 1 ? 'stack' : 'stacks';
      lines.push(
        `On ${gate}: ${subject} applies with ${mod.delta >= 0 ? '+' : ''}${mod.delta} ${stacks}`,
      );
    }
  }

  // attackProcs (Bolt Hammer, Flametongue, wands). Wand Resonance procs
  // describe the resistance shift they apply; other procs name the
  // triggered ability.
  if (item.attackProcs !== undefined && item.attackProcs.length > 0) {
    for (const proc of item.attackProcs) {
      const resonance = formatResonanceShift(proc.abilityId, catalog);
      if (resonance !== null) {
        const when = proc.chance >= 1 ? 'on hit' : `${formatPercent(proc.chance)} on hit`;
        lines.push(`Resonance (${when}): shift target's ${resonance} resistance`);
        continue;
      }
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

  // physicalReflectPercent (Spiked Mail). Deterministic retaliation —
  // reflects a share of incoming physical damage back at the attacker.
  if (item.physicalReflectPercent !== undefined && item.physicalReflectPercent > 0) {
    lines.push(
      `On taking physical damage: reflect ${item.physicalReflectPercent}% back at the attacker`,
    );
  }

  // attackSwingMultiplier (The Offering — swings-per-weapon on basic Attack).
  if (item.attackSwingMultiplier !== undefined && item.attackSwingMultiplier > 1) {
    lines.push(
      `Basic Attack: each equipped weapon swings ${item.attackSwingMultiplier}× ` +
        `(stacks with Two Weapons; not reactions or Battle Skills)`,
    );
  }

  // --- TABA M3 rider surface (S86 enrichment pass). These fields shipped
  // with ADR-0142's equipment expansion but predated no detail arm, so the
  // gear pickers showed "(no mechanical effect declared)" for the most
  // exotic pieces. Each arm renders the rider in player terms; the
  // status-subject phrasing follows the incoming/tick arms above. ---

  // A helper-shaped subject used by the four status riders below.
  const statusSubject = (statusTypeId?: StatusTypeId, statusTag?: string): string =>
    statusTypeId !== undefined
      ? catalog.hasStatusType(statusTypeId)
        ? catalog.getStatusType(statusTypeId).name
        : String(statusTypeId)
      : statusTag !== undefined
        ? `${statusTag}-tagged statuses`
        : 'every status';

  // attackStat swap (Manaeater Blade — swings scale off MA).
  if (item.kind === 'weapon' && item.attackStat === 'ma') {
    lines.push('Attacks scale off MA instead of PA');
  }

  // attackResolvesAsHeal (Healer's Staff — strikes heal their target).
  if (item.kind === 'weapon' && item.attackResolvesAsHeal === true) {
    lines.push('Weapon strikes HEAL their target instead of damaging');
  }

  // basicAttackCtRefundPaFactor (Epee — CT refund on basic Attack).
  if (item.basicAttackCtRefundPaFactor !== undefined && item.basicAttackCtRefundPaFactor > 0) {
    lines.push(`Basic Attack: refunds PA × ${item.basicAttackCtRefundPaFactor} CT to the wielder`);
  }

  // damageCtDrainPercent (tempo drains — CT stolen on hit).
  if (item.damageCtDrainPercent !== undefined && item.damageCtDrainPercent > 0) {
    lines.push(`On hit: drain ${item.damageCtDrainPercent}% of final damage as CT from target`);
  }

  // damageLifestealMods (Star Robe — heal for a share of damage dealt).
  if (item.damageLifestealMods !== undefined && item.damageLifestealMods.length > 0) {
    for (const mod of item.damageLifestealMods) {
      const gate =
        mod.tagFilter !== undefined && mod.tagFilter.length > 0
          ? `${mod.tagFilter.map(String).join('/')} damage`
          : 'damage';
      lines.push(`Lifesteal: heal ${mod.percent}% of ${gate} you deal`);
    }
  }

  // magicalReflectPercent (the magical twin of Spiked Mail).
  if (item.magicalReflectPercent !== undefined && item.magicalReflectPercent > 0) {
    lines.push(
      `On taking magical damage: reflect ${item.magicalReflectPercent}% back at the attacker`,
    );
  }

  // battleStartCt (openers — the wearer starts the battle with extra CT).
  if (item.battleStartCt !== undefined && item.battleStartCt !== 0) {
    lines.push(`Battle start: ${item.battleStartCt >= 0 ? '+' : ''}${item.battleStartCt} CT`);
  }

  // spellProcs (Void Robe — on matching spell damage, chance to fire an ability).
  if (item.spellProcs !== undefined && item.spellProcs.length > 0) {
    for (const proc of item.spellProcs) {
      const procName = catalog.hasAbility(proc.abilityId)
        ? catalog.getAbility(proc.abilityId).name
        : String(proc.abilityId);
      const gate = proc.tagFilter.map(String).join('/');
      lines.push(`On ${gate} damage: ${formatPercent(proc.chance)} chance to trigger ${procName}`);
    }
  }

  // spellResolvedSelfStatuses (Terra Robe — once per matching spell, self-status).
  if (item.spellResolvedSelfStatuses !== undefined && item.spellResolvedSelfStatuses.length > 0) {
    for (const mod of item.spellResolvedSelfStatuses) {
      const name = catalog.hasStatusType(mod.statusTypeId)
        ? catalog.getStatusType(mod.statusTypeId).name
        : String(mod.statusTypeId);
      lines.push(
        `After each ${mod.damageTagAll.map(String).join('+')} spell: gain ${name} (once per cast)`,
      );
    }
  }

  // resistanceFromMaTags (Abjurer's Codex — MA-scaled elemental resistance).
  if (item.resistanceFromMaTags !== undefined && item.resistanceFromMaTags.length > 0) {
    lines.push(
      `Resistance: +MA to ${item.resistanceFromMaTags.map(String).join(', ')} (scales with the wearer's MA)`,
    );
  }

  // incomingStatusStatShrugs (Talisman of Endurance — stat-scaled shrug).
  if (item.incomingStatusStatShrugs !== undefined && item.incomingStatusStatShrugs.length > 0) {
    for (const mod of item.incomingStatusStatShrugs) {
      lines.push(
        `Incoming ${statusSubject(mod.statusTypeId, mod.statusTag !== undefined ? String(mod.statusTag) : undefined)}: ` +
          `apply chance × (1 − max(PA, MA)/100)`,
      );
    }
  }

  // outgoingStatusMagnitudeMods (caster-side status strength).
  if (item.outgoingStatusMagnitudeMods !== undefined && item.outgoingStatusMagnitudeMods.length > 0) {
    for (const mod of item.outgoingStatusMagnitudeMods) {
      lines.push(
        `${statusSubject(mod.statusTypeId, mod.statusTag !== undefined ? String(mod.statusTag) : undefined)} you apply: ` +
          `magnitude × ${mod.factor.toFixed(2)}`,
      );
    }
  }

  // outgoingStatusDurationMods (Choir Staff — your buffs last longer).
  if (item.outgoingStatusDurationMods !== undefined && item.outgoingStatusDurationMods.length > 0) {
    for (const mod of item.outgoingStatusDurationMods) {
      lines.push(
        `${statusSubject(mod.statusTypeId, mod.statusTag !== undefined ? String(mod.statusTag) : undefined)} you apply: ` +
          `${mod.delta >= 0 ? '+' : ''}${mod.delta} duration`,
      );
    }
  }

  // conditionalIncomingDamageMods (Channeler's Hat — safer while charging).
  if (item.conditionalIncomingDamageMods !== undefined && item.conditionalIncomingDamageMods.length > 0) {
    for (const mod of item.conditionalIncomingDamageMods) {
      const status = catalog.hasStatusType(mod.whileStatusTypeId)
        ? catalog.getStatusType(mod.whileStatusTypeId).name
        : String(mod.whileStatusTypeId);
      const gate =
        mod.tagFilter !== undefined && mod.tagFilter.length > 0
          ? `${mod.tagFilter.map(String).join('/')} damage`
          : 'damage';
      lines.push(`While ${status}: incoming ${gate} × ${mod.factor.toFixed(2)}`);
    }
  }

  // aoeShapeEnlargeModifiers (Wand of Expanse — bigger matching AoEs).
  if (item.aoeShapeEnlargeModifiers !== undefined && item.aoeShapeEnlargeModifiers.length > 0) {
    for (const mod of item.aoeShapeEnlargeModifiers) {
      const gate =
        mod.tagFilter !== undefined && mod.tagFilter.length > 0
          ? `${mod.tagFilter.map(String).join('/')}-tagged`
          : 'all';
      lines.push(`AoE size: +${mod.steps} on ${gate} casts`);
    }
  }

  // equipLegality (Freelancer's Charm — the generalist travels light).
  if (item.equipLegality?.forbidClassRestrictedInSlots !== undefined &&
      item.equipLegality.forbidClassRestrictedInSlots.length > 0) {
    lines.push(
      `While worn: no class-restricted gear in ` +
        `${item.equipLegality.forbidClassRestrictedInSlots.join(', ')}`,
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
    // S96: a weapon-delivered ability's reach is the equipped weapon's, not
    // the authored band — say so instead of printing numbers that only hold
    // for one weapon class.
    const reach = isWeaponDelivered(ability)
      ? 'weapon range'
      : formatRange(range.horizontal, range.vertical);
    lines.push(`Target: ${label} · ${reach} (${mode})`);
  } else if (ability.targeting.kind === 'self') {
    lines.push('Target: self');
  }

  // Damage spec.
  const dmg = ability.effects.damage;
  if (dmg !== undefined) {
    const tagSeg = dmg.tags.map(String).join(', ');
    const power = dmg.power_coefficient ?? 1;
    if (dmg.tags.includes('healing')) {
      // S76: respect the heal's scaling stat (Chakra reads PA, not MA) and
      // whether Faith applies (Chakra is noFaithScaling).
      const healStat = dmg.healingStat === 'pa' ? 'PA' : 'MA';
      const faithSeg = dmg.noFaithScaling === true ? '' : ' × Faith';
      lines.push(`Heal: ${healStat} × ${power}${faithSeg}`);
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

  // S76: MP restore (Chakra) — a non-damage refill, shown alongside the heal.
  if (ability.effects.mpRestore !== undefined) {
    const mp = ability.effects.mpRestore;
    const mpStat = mp.stat === 'ma' ? 'MA' : 'PA';
    lines.push(`Restore MP: ${mpStat} × ${mp.power_coefficient}`);
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

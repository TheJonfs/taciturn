// Ability formatter — turns a catalog AbilityDefinition into structured
// display facts the page templates can arrange however they like.
//
// This is presentation logic, not game logic: it reads the engine's
// ability shapes and produces human-readable fields. It does not
// compute or simulate anything — every value traces straight back to
// the catalog. The four Phase 3 spread variants share this formatter so
// they all quote the same mechanical truth, only laid out differently.

import { catalog, defaultRuleset } from './data.ts';
import type {
  AbilityDefinition,
  ActiveAbilityDefinition,
  PassiveAbilityDefinition,
} from '@engine/index.ts';

/** Structured, display-ready facts about one ability. */
export interface AbilityFacts {
  readonly id: string;
  readonly name: string;
  readonly kind: 'active' | 'passive';
  /** Display label for the ability's bucket — "First Action", "Reaction", … */
  readonly bucketLabel: string;
  /** Pre-modifier capacity cost (`baseCost`). */
  readonly capacityCost: number;
  /** Active-only: MP cost. */
  readonly mpCost?: number;
  /** Active-only: targeting + range, e.g. "Melee (1)", "Line, range 4", "Self". */
  readonly range?: string;
  /** Active-only: "Instant" or "Charged (speed N)". */
  readonly chargeLabel?: string;
  /** Active-only: true when the ability rolls to hit (physical attacks). */
  readonly rollsToHit?: boolean;
  /** Short effect descriptors — "Physical damage (×1.5)", "Applies Taunted (50%)", … */
  readonly effects: ReadonlyArray<string>;
  /** Passive-only: reaction trigger summary, when the passive is a reaction. */
  readonly trigger?: string;
}

const BUCKET_LABELS: Record<string, string> = {
  first_action: 'First Action',
  secondary_command_sets: 'Secondary',
  reaction: 'Reaction',
  support: 'Support',
  movement: 'Movement',
};

function bucketLabel(bucket: string): string {
  return BUCKET_LABELS[bucket] ?? bucket;
}

function titleCase(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function rangeText(active: ActiveAbilityDefinition): string {
  const t = active.targeting;
  if (t.kind === 'self') return 'Self';
  // Session 49: Math Skill targets every unit on the field whose chosen
  // parameter matches the chosen value (CT / Height / Level / current HP
  // ÷ a divisor of 3, 4, or 5, or *prime* as a special test). No tile
  // range; no rangeMode. The picker — parameter row + value row — is the
  // controller's whole "aim." Render that as a one-line shape; the
  // Calculator's `commandSetIntro` carries the longer explanation.
  if (t.kind === 'math_skill') return 'Field-wide (parameter × value)';
  const r = t.range;
  // Minimum horizontal (bows can't hit adjacent foes — Pin Down is
  // range 2–5, not range 5) is mechanically meaningful; surface it
  // when present so the line reads as the actual tactical envelope.
  const hMin = r.minHorizontal;
  const hStr = hMin !== undefined && hMin > 0 ? `${hMin}–${r.horizontal}` : `${r.horizontal}`;
  // Vertical: only surface when it's a genuine identifying feature.
  // S47 made vertical 99 (the "unbounded" sentinel) the universal
  // default for both bows and spells, so it stays implicit. Ordinary
  // melee/spell verticals (2–3) also stay implicit. A self-move whose
  // vertical exceeds its horizontal and is *bounded* — Scramble's
  // 1 horizontal × 5 vertical leap — surfaces explicitly.
  let vSuffix = '';
  if (
    active.effects.selfMove &&
    r.vertical > r.horizontal &&
    r.vertical < 10
  ) {
    vSuffix = `, vertical ${r.vertical}`;
  }
  switch (t.rangeMode) {
    case 'melee':
      return `Melee (${hStr})${vSuffix}`;
    case 'straight_line':
      return `Line, range ${hStr}${vSuffix}`;
    case 'arc':
      return `Arc, range ${hStr}${vSuffix}`;
  }
}

function damageText(active: ActiveAbilityDefinition): string | undefined {
  const dmg = active.effects.damage;
  if (!dmg) return undefined;
  // Magical-tagged damage reads as Spell Power N (the in-world term for
  // a spell's coefficient); physical damage keeps the descriptor +
  // multiplier form so weapon-coefficient strikes ("Physical damage
  // ×1.5") still surface their scale.
  const coeff = dmg.power_coefficient;
  if (dmg.tags.includes('magical')) {
    return `Spell Power ${coeff ?? 1}`;
  }
  // 'weapon' is a composition marker, not a flavour — skip it for the
  // primary descriptor.
  const primary = dmg.tags.find((tag) => tag !== 'weapon') ?? dmg.tags[0] ?? 'damage';
  const scale = coeff !== undefined && coeff !== 1 ? ` (×${coeff})` : '';
  return `${titleCase(primary)} damage${scale}`;
}

function joinAnd(items: ReadonlyArray<string>): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]!}`;
}

function activeEffects(active: ActiveAbilityDefinition): string[] {
  const out: string[] = [];

  const dmg = damageText(active);
  if (dmg) out.push(dmg);

  // Status applications. Consecutive entries flagged `linkRoll: true`
  // share the leading entry's roll (Fire Strike's PA Down + MA Down,
  // Fire Embrace's PA Up + MA Up): they apply or fail together, so
  // they read as one coalesced "Applies X and Y (N%)" line, not two
  // independent rolls. Stack quantity > 1 surfaces explicitly (Spark's
  // 2 stacks of Burn) so the line matches the engine's actual payoff.
  const statuses = active.effects.statusEffects ?? [];
  let i = 0;
  while (i < statuses.length) {
    const head = statuses[i]!;
    const linked = [head];
    while (i + 1 < statuses.length && statuses[i + 1]!.linkRoll) {
      linked.push(statuses[i + 1]!);
      i++;
    }
    const names = linked.map((s) => catalog().getStatusType(s.typeId).name);
    let chance = '';
    if (!head.applyAlways && head.baseChance !== undefined) {
      chance = ` (${head.baseChance}%)`;
    }
    if (linked.length === 1 && head.stackQuantity && head.stackQuantity > 1) {
      out.push(`Applies ${head.stackQuantity} stacks of ${names[0]}${chance}`);
    } else {
      out.push(`Applies ${joinAnd(names)}${chance}`);
    }
    i++;
  }

  if (active.effects.damage?.ctPush) out.push('Pushes target CT');
  if (active.effects.damage?.knockback) {
    out.push(`Knockback ${active.effects.damage.knockback.distance}`);
  }
  for (const _ct of active.effects.ctEffects ?? []) out.push('Adjusts CT');
  if (active.effects.aoe) {
    // `rangeMode` and `aoe.shape` are separate concerns: rangeMode
    // governs how the caster *aims* (the target tile is just the aim
    // point); aoe.shape describes what the spell actually *hits*. For
    // caster-anchored shapes (cone, line) the AoE projects from the
    // caster's tile in the aimed cardinal direction, not from where
    // the player clicked — so the rangeMode line is the aim envelope
    // and the shape line is the hit footprint.
    //
    // verticalTolerance: per-ability override wins; otherwise the
    // ruleset's `aoeVerticalTolerance` (S47/ADR-0085: 3) is the default.
    // We surface the number ONLY when the ability overrides the default
    // (Flame Lance's vertical 5, e.g.) — repeating the universal "3" on
    // every diamond spell adds wrap risk for no information.
    const aoe = active.effects.aoe;
    const shape = aoe.shape;
    let shapeText: string;
    switch (shape.kind) {
      case 'tile':
        shapeText = 'Area effect';
        break;
      case 'diamond':
        shapeText = `Diamond, radius ${shape.radius}`;
        break;
      case 'square':
        shapeText = `Square, radius ${shape.radius}`;
        break;
      case 'cross':
        shapeText = `Cross, radius ${shape.radius}`;
        break;
      case 'cone':
        shapeText = `Cone from caster, reach ${shape.rows.length}`;
        break;
      case 'line':
        shapeText = `Line from caster, length ${shape.length}`;
        break;
      case 'custom':
        shapeText = 'Area effect, custom shape';
        break;
    }
    const override = aoe.verticalTolerance;
    out.push(
      override !== undefined ? `${shapeText} (vertical ${override})` : shapeText,
    );
  }
  // Scramble's self-relocating hop carries no damage and no status —
  // without surfacing selfMove the line reads as empty effects.
  if (active.effects.selfMove) out.push('Self-move');
  if (active.selfDamage) {
    out.push(`Self-cost: ${Math.round(active.selfDamage.fraction * 100)}% max HP`);
  }

  return out;
}

function reactionTrigger(passive: PassiveAbilityDefinition): string | undefined {
  const fields = passive.reactionFields;
  if (!fields) return undefined;
  const cond = fields.triggerCondition;
  if (cond === undefined) return 'Triggers on a reaction condition';
  if (cond.type === 'damage_received') {
    const tags = cond.damageTagsAny;
    const kind = tags && tags.length > 0 ? `${tags.join('/')} ` : '';
    return `Triggers on ${kind}damage taken`;
  }
  // Other reaction-condition types summarise generically until a
  // consumer needs richer wording.
  return 'Triggers on a reaction condition';
}

/** Describe one ability as structured, display-ready facts. */
export function describeAbility(ability: AbilityDefinition): AbilityFacts {
  if (ability.kind === 'active') {
    return {
      id: ability.id,
      name: ability.name,
      kind: 'active',
      bucketLabel: bucketLabel(ability.bucket),
      capacityCost: ability.baseCost,
      mpCost: ability.mpCost,
      range: rangeText(ability),
      chargeLabel:
        ability.actionSpeed === 0
          ? 'Instant'
          : `Charged (speed ${ability.actionSpeed})`,
      rollsToHit: ability.hitRoll !== undefined,
      effects: activeEffects(ability),
    };
  }

  const trigger = reactionTrigger(ability);
  return {
    id: ability.id,
    name: ability.name,
    kind: 'passive',
    bucketLabel: bucketLabel(ability.bucket),
    capacityCost: ability.baseCost,
    effects: [],
    ...(trigger !== undefined ? { trigger } : {}),
  };
}

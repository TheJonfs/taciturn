// Reaction compiler — translates declarative `ReactionAbilityFields`
// into one or more `PassiveHookRegistration`s consumed by the existing
// engine machinery.
//
// Per ADR-0017's implementation note (and ADR-0024 which lands the
// session 16 implementation): reaction abilities are data-driven —
// `triggerOn` names the hook(s) to listen on, `triggerCondition` filters
// when the reaction fires, and `effects` describes what happens when it
// does. The compiler builds the matching hook handler.
//
// v1 supports three effect kinds, sufficient for the sessions 16-18
// content surface:
//   - `use_ability` — emit a use_ability ProposedAction with an existing
//     ability targeting the attacker. Counter is the worked example.
//   - `apply_status` — emit a `system_apply_status` ProposedAction
//     applying a status to self or attacker. Earth Resilience uses this.
//   - `ct_push` — emit a `system_ct_push` ProposedAction adjusting the
//     selected target's CT by a flat signed delta. Tidal Pull uses this
//     with `targetSelector: 'self'` and `delta: 20`.
// Future effect kinds (raw damage / heal / knockback / etc.) extend the
// union; the compiler handles the dispatch in one place.
//
// v1 supports two trigger kinds:
//   - `damage_received` — gates on damage tags and a minimum damage
//     amount. Counter uses `{ damageTagsAny: ['physical'], damageTagsNone:
//     ['healing'] }` (BMG-faithful: triggers on attempt regardless of
//     landed damage). Earth Resilience uses `{ minDamage: 1, damageTagsNone:
//     ['healing'] }` (only triggers on actual damage; healing-tagged
//     hits don't trigger).
//   - `always` — always fires when the trigger hook fires.
//
// Brave gating is automatic — `runOnActionTargeted` in the runners
// applies the Brave roll to every reaction returned. The compiler does
// not need to handle Brave; per ADR-0021 the runner owns that.

import type {
  AbilityId,
  DamageTag,
  ProposedAction,
  StatusTypeId,
  UnitId,
} from '../types/index.ts';
import type { PassiveHookRegistration } from './hooks.ts';
import { passiveHook } from './hooks.ts';

// What target an effect resolves to. `attacker` reads the incoming
// action's actorId; `self` is the reactor (the unit the hook fired on).
export type ReactionTargetSelector = 'self' | 'attacker';

export type ReactionEffect =
  | {
      readonly kind: 'use_ability';
      readonly abilityId: AbilityId;
      readonly targetSelector: ReactionTargetSelector;
    }
  | {
      readonly kind: 'apply_status';
      readonly statusTypeId: StatusTypeId;
      readonly targetSelector: ReactionTargetSelector;
      readonly magnitude?: number;
      readonly duration?: number;
      readonly customState?: Readonly<Record<string, unknown>>;
      // Per ADR-0030: stack quantity forwarded into composeApplyState.
      // Smolder applies 1 Burn stack on the attacker; Burn-applying
      // reactions with bigger payloads pass higher counts.
      readonly stackQuantity?: number;
    }
  | {
      readonly kind: 'ct_push';
      readonly targetSelector: ReactionTargetSelector;
      // Signed CT delta applied directly. Positive = forward (toward 100
      // trigger threshold); negative = backward. Per session 18.
      readonly delta: number;
    }
  | {
      // Session 53: reflect the damage just taken back at the attacker as a
      // `system_damage` (bypasses the pipeline — no variance/Faith/resistance,
      // and crucially can't cascade into the attacker's own reactions), and
      // heal the reactor for a fraction of that amount via a paired
      // `system_heal`. Damage Split is the v1 consumer.
      //
      // Reads the incoming damage off the enriched `onActionTargeted` args
      // (`damageDealt`). Hard-gated on the reactor surviving the hit — the
      // runner hands us the post-application unit, so `unit.vitals.hp > 0`
      // distinguishes a survivor from a unit the attack KO'd. The survival
      // gate runs before the runner's Brave roll (it suppresses the emission
      // entirely), matching "survives, then Brave-gates."
      readonly kind: 'reflect_damage';
      // Tags carried on the reflected system_damage — for log/animation
      // attribution only, since system_damage bypasses resistance. Damage
      // Split authors `[]`.
      readonly tags: ReadonlyArray<DamageTag>;
      // Reflected damage = floor(damageDealt × numerator / denominator).
      // Damage Split splits the hit in two — half back, half healed — so it
      // authors numerator 1, denominator 2. A `1/1` author reflects the full
      // amount (the original blueprint behavior).
      readonly reflectNumerator: number;
      readonly reflectDenominator: number;
      // Self-heal = floor(damageDealt × numerator / denominator). Damage
      // Split heals half → numerator 1, denominator 2.
      readonly selfHealNumerator: number;
      readonly selfHealDenominator: number;
    };

export type ReactionTriggerCondition =
  | {
      readonly type: 'damage_received';
      // Minimum landed damage to fire. 0 = trigger on attempt
      // regardless of damage (Counter's BMG-faithful behavior).
      // Defaults to 0 when omitted.
      readonly minDamage?: number;
      // ANY tag in this set must appear on the incoming damage's tag
      // set. Omitted → no positive tag gate.
      readonly damageTagsAny?: ReadonlyArray<DamageTag>;
      // NONE of these tags may appear on the incoming damage's tag set.
      // Counter uses `['healing']` — a Cure that's tagged physical+healing
      // for some future class wouldn't trigger Counter.
      readonly damageTagsNone?: ReadonlyArray<DamageTag>;
    }
  | { readonly type: 'always' };

// `triggerOn` is the closed set of hooks reactions can fire from. v1
// only supports `'onActionTargeted'` because that's the only post-hit
// reaction surface. When future content adds reaction patterns that
// fire on other hooks (e.g., onTurnStart for "react to taking a turn")
// the union grows here.
export type ReactionTriggerHook = 'onActionTargeted';

export interface ReactionAbilityFields {
  readonly triggerOn: ReadonlyArray<ReactionTriggerHook>;
  readonly triggerCondition?: ReactionTriggerCondition;
  readonly effects: ReadonlyArray<ReactionEffect>;
}

// Compile a reaction's fields into one PassiveHookRegistration per
// listed `triggerOn` hook. Today only `'onActionTargeted'` ships; the
// switch is for forward extension.
export function compileReaction(
  fields: ReactionAbilityFields,
): ReadonlyArray<PassiveHookRegistration> {
  const regs: PassiveHookRegistration[] = [];
  for (const hookName of fields.triggerOn) {
    regs.push(compileForHook(hookName, fields));
  }
  return regs;
}

// Bundle: compile the reaction's hooks AND attach the same `fields` to
// the resulting passive ability as `reactionFields`. The decoration
// lets consumers (the AI's reactionPenalty in particular) inspect each
// reaction's trigger condition without running the compiled closure.
//
// Authors should prefer this helper over calling `compileReaction`
// directly — it ensures hooks and decoration stay in lockstep. Direct
// `compileReaction` use is still supported for tests and for legacy
// hand-built reactions where the author opts into the AI treating it
// as always-firing.
//
// `base` is the ability's identity / cost / tag fields; `fields` is
// the reaction's declarative shape. Returns a fully-populated
// `PassiveAbilityDefinition` ready to ship.
export function compileReactionAbility(
  base: Omit<
    import('../catalog/definitions/ability-definition.ts').PassiveAbilityDefinition,
    'kind' | 'hooks' | 'reactionFields'
  >,
  fields: ReactionAbilityFields,
): import('../catalog/definitions/ability-definition.ts').PassiveAbilityDefinition {
  return {
    ...base,
    kind: 'passive',
    hooks: compileReaction(fields),
    reactionFields: fields,
  };
}

function compileForHook(
  hookName: ReactionTriggerHook,
  fields: ReactionAbilityFields,
): PassiveHookRegistration {
  // The closed `triggerOn` enum makes the switch exhaustive today;
  // future hook additions surface the missing branch here.
  switch (hookName) {
    case 'onActionTargeted':
      return passiveHook('onActionTargeted', (args, ctx) => {
        if (!matchesTriggerCondition(fields.triggerCondition, args)) return [];
        const attackerId = extractAttackerId(args.incomingAction);
        if (attackerId === null) return [];
        // Defensive: a unit can't react to its own action.
        if (attackerId === args.unit.id) return [];

        const emissions: ProposedAction[] = [];
        for (const effect of fields.effects) {
          if (effect.kind === 'reflect_damage') {
            // Survival gate (pre-Brave): the reactor must be alive after the
            // hit. `args.unit` is the post-application unit (the runner reads
            // it from workingState), so hp ≤ 0 means the attack KO'd us — no
            // reflect. `damageDealt` is the enriched landed amount.
            const damageDealt = args.damageDealt ?? 0;
            if (damageDealt <= 0) continue;
            if (args.unit.vitals.hp <= 0) continue;
            // Reflect a fraction of the damage at the attacker, system-tagged
            // so it bypasses the pipeline and can't cascade into the
            // attacker's own reactions. Damage Split reflects half.
            const reflectAmount = Math.floor(
              (damageDealt * effect.reflectNumerator) / effect.reflectDenominator,
            );
            if (reflectAmount > 0) {
              emissions.push({
                type: 'system_damage',
                source: 'system',
                payload: {
                  targetId: attackerId,
                  amount: reflectAmount,
                  tags: effect.tags,
                  source: { kind: 'reflect', reactorId: args.unit.id, attackerId },
                },
              });
            }
            // Self-heal a fraction of the reflected amount.
            const heal = Math.floor(
              (damageDealt * effect.selfHealNumerator) / effect.selfHealDenominator,
            );
            if (heal > 0) {
              emissions.push({
                type: 'system_heal',
                source: 'system',
                payload: {
                  targetId: args.unit.id,
                  amount: heal,
                  tags: [],
                  source: { kind: 'reaction', abilityId: ctx.ability.id, unitId: args.unit.id },
                },
              });
            }
            continue;
          }
          const targetUnitId = resolveTargetSelector(effect.targetSelector, {
            self: args.unit.id,
            attacker: attackerId,
          });
          if (targetUnitId === null) continue;
          if (effect.kind === 'use_ability') {
            emissions.push({
              type: 'use_ability',
              source: 'system',
              actorId: args.unit.id, // the reactor is the actor
              payload: {
                abilityId: effect.abilityId,
                target: { kind: 'unit', unitId: targetUnitId },
              },
            });
          } else if (effect.kind === 'apply_status') {
            // apply_status: emit a system_apply_status that bypasses
            // the BMG application formula. The reaction's Brave roll
            // (runOnActionTargeted) has already gated whether the
            // reaction fires; the application itself is deterministic.
            //
            // S50 fix: thread the registering reaction passive's own
            // ability tags through as `sourceAbilityTags` (symmetric
            // to the Ignition fix). For Smolder (tagged ['magical',
            // 'fire']) emitting Burn to its attacker, a Wand of
            // Lumen-equipped Smolder wielder lands +1 stack via the
            // wand's fire-gated rider. Pre-S50 this field was absent
            // → modifier chain saw `sourceAbilityTags: []` → fire
            // gate failed silently.
            emissions.push({
              type: 'system_apply_status',
              source: 'system',
              payload: {
                targetId: targetUnitId,
                statusTypeId: effect.statusTypeId,
                sourceUnitId: args.unit.id,
                sourceAbilityTags: ctx.ability.tags ?? [],
                ...(effect.magnitude !== undefined ? { magnitude: effect.magnitude } : {}),
                ...(effect.duration !== undefined ? { duration: effect.duration } : {}),
                ...(effect.customState !== undefined ? { customState: effect.customState } : {}),
                ...(effect.stackQuantity !== undefined ? { stackQuantity: effect.stackQuantity } : {}),
              },
            });
          } else {
            // ct_push: emit a system_ct_push that bypasses the
            // ability-chance roll. Brave gating already decided whether
            // the reaction fires. Tidal Pull is the v1 consumer.
            emissions.push({
              type: 'system_ct_push',
              source: 'system',
              payload: {
                targetId: targetUnitId,
                delta: effect.delta,
                source: {
                  kind: 'reaction',
                  abilityId: ctx.ability.id,
                  attackerId: attackerId,
                },
              },
            });
          }
        }
        return emissions;
      });
  }
}

function matchesTriggerCondition(
  cond: ReactionTriggerCondition | undefined,
  args: {
    readonly damageDealt?: number;
    readonly damageTags?: ReadonlySet<DamageTag>;
  },
): boolean {
  if (cond === undefined) return true; // default: always match
  if (cond.type === 'always') return true;
  if (cond.type === 'damage_received') {
    const tags = args.damageTags;
    if (cond.damageTagsAny !== undefined) {
      if (tags === undefined) return false;
      const any = cond.damageTagsAny.some((t) => tags.has(t));
      if (!any) return false;
    }
    if (cond.damageTagsNone !== undefined) {
      if (tags !== undefined) {
        const blocked = cond.damageTagsNone.some((t) => tags.has(t));
        if (blocked) return false;
      }
    }
    const minDamage = cond.minDamage ?? 0;
    if (minDamage > 0) {
      const dealt = args.damageDealt ?? 0;
      // damageDealt is positive for damage and negative for healing
      // (per runOnActionTargeted's enrichment); compare against the
      // positive-only damage threshold.
      if (dealt < minDamage) return false;
    }
    return true;
  }
  return true;
}

function extractAttackerId(incoming: ProposedAction): UnitId | null {
  if (incoming.type !== 'use_ability') return null;
  if (!('actorId' in incoming)) return null;
  return incoming.actorId;
}

function resolveTargetSelector(
  selector: ReactionTargetSelector,
  ids: { readonly self: UnitId; readonly attacker: UnitId },
): UnitId | null {
  if (selector === 'self') return ids.self;
  if (selector === 'attacker') return ids.attacker;
  return null;
}

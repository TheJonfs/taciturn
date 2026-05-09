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
    }
  | {
      readonly kind: 'ct_push';
      readonly targetSelector: ReactionTargetSelector;
      // Signed CT delta applied directly. Positive = forward (toward 100
      // trigger threshold); negative = backward. Per session 18.
      readonly delta: number;
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
            emissions.push({
              type: 'system_apply_status',
              source: 'system',
              payload: {
                targetId: targetUnitId,
                statusTypeId: effect.statusTypeId,
                sourceUnitId: args.unit.id,
                ...(effect.magnitude !== undefined ? { magnitude: effect.magnitude } : {}),
                ...(effect.duration !== undefined ? { duration: effect.duration } : {}),
                ...(effect.customState !== undefined ? { customState: effect.customState } : {}),
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

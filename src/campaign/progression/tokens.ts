// TABA M2 progression — the unlock token.
//
// A single tagged union naming EVERYTHING a unit can spend JP to unlock.
// The M0 unit-boundary audit + the M2 substrate audit found that the three
// progression surfaces the brief treats separately —
//   - actives / Calculator payloads   (keyed by AbilityId)
//   - Alchemist items                 (keyed by ItemId)
//   - Calculator parameters / values  (keyed by a component token)
// — all reduce to ONE operation: intersect an enumeration against the
// unit's unlocked set. So they share one token type rather than three
// bespoke unlock records. (This is why extending an Alchemist's item list
// or a Calculator's lattice later is just "add a token", not a new system.)
//
// The `ability` case is the only one the substrate session exercises
// (active-use gating). The `item` / `mathParameter` / `mathValue` cases are
// wired at their enumeration sites in the content session; they are named
// here now so the durable `CampaignUnit.unlocks` shape is forward-complete
// and never needs a type migration (end-state-reachable — TABA scope rule).
//
// PLAIN-SERIALIZABLE (TABA D-C): every case is `{ kind, id }` where `id` is
// a branded string or a small literal — no `Map`/`Set`/class. `CampaignUnit`
// stores `ReadonlyArray<UnlockToken>`, which JSON-round-trips cleanly.

import type { AbilityId, ItemId } from '@engine/index.ts';
import type { MathSkillParameter, MathSkillValue } from '@engine/index.ts';

export type UnlockToken =
  | { readonly kind: 'ability'; readonly id: AbilityId }
  | { readonly kind: 'item'; readonly id: ItemId }
  | { readonly kind: 'mathParameter'; readonly id: MathSkillParameter }
  | { readonly kind: 'mathValue'; readonly id: MathSkillValue };

export type UnlockTokenKind = UnlockToken['kind'];

// Canonical string key for a token — the identity used for membership tests,
// dedup, and keying the static component catalog. `mathValue` ids can be a
// number (3/4/5) or the string 'prime'; `String(id)` normalizes both.
export function tokenKey(token: UnlockToken): string {
  return `${token.kind}:${String(token.id)}`;
}

export function tokensEqual(a: UnlockToken, b: UnlockToken): boolean {
  return a.kind === b.kind && String(a.id) === String(b.id);
}

// Whether a token set (as keys) contains a given token.
export function hasToken(unlocked: ReadonlySet<string>, token: UnlockToken): boolean {
  return unlocked.has(tokenKey(token));
}

// Convenience constructor for the ability case — the substrate's only
// exercised kind — so callers don't repeat the literal shape.
export function abilityToken(id: AbilityId): UnlockToken {
  return { kind: 'ability', id };
}

// Per-action seed derivation.
// See docs/design/action-resolution.md ("RNG model") and
// docs/design/core-types.md ("Random determinism").
//
// `seed = hash(masterSeed, sequenceNumber)`. Stable, reproducible,
// independent across actions. The hash is a fast non-cryptographic
// mixer (mulberry32-style) — strong enough for deterministic gameplay
// RNG, not strong enough for security purposes (which we don't need).
//
// Replays read `action.seed` from the log rather than re-deriving, so
// changing this function later wouldn't invalidate old logs that
// already carry seeds. Re-deriving is reserved for the *commit* step
// when the engine seeds an action freshly.

export function deriveActionSeed(masterSeed: number, sequenceNumber: number): number {
  // splitmix32-derived bit mixer — produces well-distributed unsigned
  // 32-bit integers from a 32-bit input stream. Combine masterSeed and
  // sequenceNumber with a stable folding step so two different
  // (masterSeed, seq) pairs yield different seeds.
  let z = (masterSeed ^ Math.imul(sequenceNumber, 0x9e3779b9)) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  z = Math.imul(z, 0x21f0aaad) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  z = Math.imul(z, 0x735a2d97) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  return z >>> 0;
}

// Per-target seed derivation for AoE per-target dispatch (session 17).
// Branches the action seed by `targetIndex` so an AoE that hits N units
// runs N independent random sub-streams — variance, evasion, status
// chance, and Brave reaction rolls all roll independently per target.
//
// `targetIndex === 0` is the identity case: returns the action seed
// unchanged. This keeps single-target callers' RNG behavior bit-identical
// to pre-AoE (no replay drift on existing logs), so `resolveAbilityEffect`
// can call `perTargetSeed(seed, 0)` unconditionally without changing
// outcomes for any non-AoE caller.
//
// For `targetIndex >= 1`, runs the same splitmix32 mixer as
// `deriveActionSeed` so a single derivation step is enough to disperse
// the seed across all sub-streams. Mixing into the high bits is what
// keeps the per-target streams independent of the per-sub-stream offset
// (variance 0, evasion 1, brave 2, status chance 3) that callers XOR
// in on top.
export function perTargetSeed(actionSeed: number, targetIndex: number): number {
  if (targetIndex === 0) return actionSeed >>> 0;
  let z = (actionSeed ^ Math.imul(targetIndex, 0x9e3779b9)) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  z = Math.imul(z, 0x21f0aaad) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  z = Math.imul(z, 0x735a2d97) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  return z >>> 0;
}

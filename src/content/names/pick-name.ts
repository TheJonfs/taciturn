// Name picker — draws from the shared Ivalician pool, excluding any
// names already in use.
//
// Two entry points:
//   - `pickName(usedNames, rng?)`: single name, used by the team builder
//     when auto-populating a unit's name on class assignment.
//   - `pickTeamNames(count, usedNames, rng?)`: N distinct names, used to
//     batch-rename the AI roster at battle-config assembly time so AI
//     names don't collide with each other or with the player's team.
//
// `rng` defaults to `Math.random`. Tests inject a deterministic seeded
// RNG so name-picking is reproducible (per Session 38 decision 2: A for
// player flow, B for tests).
//
// Both functions throw when the pool is exhausted. The pool is ~50; a
// realistic call asks for 4 names with at most 4 already used, so
// exhaustion is a programmer error (mis-sized pool relative to demand)
// rather than a user-facing case.

import { ivalicianNames } from './index.ts';

export type Rng = () => number;

const DEFAULT_RNG: Rng = Math.random;

// Pick one name from the pool, excluding any in `usedNames`. Throws when
// every name is excluded (the pool is exhausted relative to the request).
export function pickName(
  usedNames: ReadonlySet<string>,
  rng: Rng = DEFAULT_RNG,
): string {
  const available = ivalicianNames.filter((name) => !usedNames.has(name));
  if (available.length === 0) {
    throw new Error(
      `pickName: name pool exhausted (${usedNames.size} of ${ivalicianNames.length} excluded)`,
    );
  }
  const index = Math.floor(rng() * available.length);
  return available[index]!;
}

// Pick `count` distinct names from the pool, excluding any in
// `usedNames` and ensuring the returned names don't duplicate each
// other. Throws when the pool can't satisfy the request.
export function pickTeamNames(
  count: number,
  usedNames: ReadonlySet<string>,
  rng: Rng = DEFAULT_RNG,
): string[] {
  if (count < 0) {
    throw new Error(`pickTeamNames: count must be >= 0 (got ${count})`);
  }
  const picked: string[] = [];
  const exclusions = new Set(usedNames);
  for (let i = 0; i < count; i++) {
    const name = pickName(exclusions, rng);
    picked.push(name);
    exclusions.add(name);
  }
  return picked;
}

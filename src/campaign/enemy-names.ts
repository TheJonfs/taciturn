// Generated-enemy identities — personal names from the naming pool (S100).
//
// Before this, procedurally generated enemies were labeled by class
// ("Bandit Knight", or a bare "Monk" on a non-authored story-lineup slot).
// Chris's call: they draw PERSONAL names from the same gendered pools the
// hire/recruit flow uses (recruit.ts), FFT-style — the class stays visible
// on the unit panel; the name is a person. Gender is rolled alongside so
// the name never fights the portrait (the S94 principle).
//
// Party-scoped and deterministic: one call per generated party, seeded by
// the party seed. Names sample WITHOUT replacement per gender (a party
// never fields two Odettes; on pool exhaustion a numeral suffix keeps
// entries distinct, mirroring `hireName`). Same seed → same identities —
// skirmish reloads never reroll (the seed only advances on a win), and a
// story lineup's defaults are stable across sessions.

import { deriveActionSeed, type Gender } from '@engine/index.ts';
import { HIRE_NAMES_FEMALE, HIRE_NAMES_MALE } from './recruit.ts';

// Distinct salt ranges (see skirmish.ts's stream map: unit streams 1000+,
// archetype rolls 200/300+, gear 100+).
const SALT_GENDER = 5000;
const SALT_SHUFFLE = 6000;

export interface EnemyIdentity {
  readonly name: string;
  readonly gender: Gender;
}

// Seeded Fisher-Yates over a name pool — the party's private draw order.
function shuffledPool(pool: ReadonlyArray<string>, seed: number, saltBase: number): string[] {
  const out = [...pool];
  for (let i = out.length - 1; i > 0; i--) {
    const j = deriveActionSeed(seed, saltBase + i) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// The identities for one generated party of `count`, in slot order.
// `forcedGenders` pins a slot's gender (an authored override that sets
// gender but not name still draws a MATCHING-pool name — the name must
// never fight an authored gender any more than a portrait); undefined
// entries roll 50/50 off the seed.
export function generatedEnemyIdentities(
  partySeed: number,
  count: number,
  forcedGenders?: ReadonlyArray<Gender | undefined>,
): ReadonlyArray<EnemyIdentity> {
  const order: Record<Gender, string[]> = {
    male: shuffledPool(HIRE_NAMES_MALE, partySeed, SALT_SHUFFLE),
    female: shuffledPool(HIRE_NAMES_FEMALE, partySeed, SALT_SHUFFLE + 100),
  };
  const drawn: Record<Gender, number> = { male: 0, female: 0 };
  const identities: EnemyIdentity[] = [];
  for (let i = 0; i < count; i++) {
    const gender: Gender =
      forcedGenders?.[i] ??
      (deriveActionSeed(partySeed, SALT_GENDER + i) % 2 === 0 ? 'male' : 'female');
    const pool = order[gender];
    const k = drawn[gender]++;
    const base = pool[k % pool.length]!;
    const round = Math.floor(k / pool.length);
    identities.push({ gender, name: round === 0 ? base : `${base} ${round + 1}` });
  }
  return identities;
}

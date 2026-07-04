// TABA campaign — save/load serialization.
//
// Between-battle save only (TABA D-C): the target is the durable
// `CampaignState` container, never mid-battle `GameState`. Because the
// container is plain-serializable by construction (see types.ts), this is
// a thin JSON round-trip plus a loud structural validation on the way
// back in — no custom replacer/reviver, no `Map` rehydration.
//
// Fail loud (CLAUDE.md anti-pattern: "Don't catch errors silently"). A
// malformed or wrong-version save throws; we never silently coerce a
// half-valid blob into a `CampaignState`.

import { classId as toClassId, EMPTY_LOADOUT, EMPTY_UNIT_EQUIPMENT } from '@engine/index.ts';
import type { CampaignPhase, CampaignState, CampaignUnit, EarnedByClass, UnitFate } from './types.ts';
import { EMPTY_EARNED_BY_CLASS } from './types.ts';
import type { UnlockToken, UnlockTokenKind } from './progression/tokens.ts';

// Persisted-shape version. Bump when `CampaignState`/`CampaignUnit` change
// in a way that invalidates old saves; `deserializeCampaign` rejects any
// other version rather than guessing a migration.
//
// v2 (M1): position widened from a linear `nodeIndex: number` to a branching
// `currentNodeId: string`. Old v1 saves hard-fail to load (loud) rather than
// migrate — acceptable for dev-only localStorage, deliberate not silent.
// v3 (M2): `CampaignUnit` gained the JP progression state (`unlocks`, optional
// `classAccessOverride`, and the JP ledger). v4 (M2, per-class revision): the
// JP ledger is per-class earnings (`earnedByClass`) rather than a single
// `{earned, spent}`. Old saves hard-fail.
export const CAMPAIGN_SCHEMA_VERSION = 4;

const VALID_UNLOCK_KINDS: ReadonlyArray<UnlockTokenKind> = [
  'ability',
  'item',
  'mathParameter',
  'mathValue',
];

const VALID_FATES: ReadonlyArray<UnitFate> = ['active', 'lost'];
const VALID_PHASES: ReadonlyArray<CampaignPhase> = [
  'in_progress',
  'awaiting_route',
  'won',
  'lost',
];

export function serializeCampaign(state: CampaignState): string {
  return JSON.stringify(state);
}

// Parse + validate a serialized campaign. Throws on any structural
// problem so a corrupt save surfaces immediately instead of producing a
// subtly-broken roster downstream. Branded ids round-trip as plain
// strings; the validated object is cast back to the branded shape (the
// runtime checks below stand in for what the brand can't enforce at the
// boundary).
export function deserializeCampaign(json: string): CampaignState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new Error(`deserializeCampaign: input is not valid JSON`, { cause });
  }

  const root = asRecord(parsed, 'campaign state');

  const schemaVersion = asNumber(root['schemaVersion'], 'schemaVersion');
  if (schemaVersion !== CAMPAIGN_SCHEMA_VERSION) {
    throw new Error(
      `deserializeCampaign: unsupported schemaVersion ${schemaVersion} ` +
        `(this build reads ${CAMPAIGN_SCHEMA_VERSION})`,
    );
  }

  const currentNodeId = asNonEmptyString(root['currentNodeId'], 'currentNodeId');

  const phase = root['phase'];
  if (!isPhase(phase)) {
    throw new Error(
      `deserializeCampaign: phase must be one of ${VALID_PHASES.join(' | ')}, ` +
        `got ${JSON.stringify(phase)}`,
    );
  }

  const rawRoster = root['roster'];
  if (!Array.isArray(rawRoster)) {
    throw new Error(`deserializeCampaign: roster must be an array`);
  }
  const roster = rawRoster.map((u, i) => validateUnit(u, i));

  return { schemaVersion, roster, currentNodeId, phase };
}

function validateUnit(raw: unknown, index: number): CampaignUnit {
  const where = `roster[${index}]`;
  const u = asRecord(raw, where);

  const id = asNonEmptyString(u['id'], `${where}.id`);
  const name = asString(u['name'], `${where}.name`);
  const classId = asNonEmptyString(u['classId'], `${where}.classId`);
  const level = asNumber(u['level'], `${where}.level`);
  const brave = asNumber(u['brave'], `${where}.brave`);
  const faith = asNumber(u['faith'], `${where}.faith`);

  const vitalsRec = asRecord(u['vitals'], `${where}.vitals`);
  const vitals = {
    hp: asNumber(vitalsRec['hp'], `${where}.vitals.hp`),
    mp: asNumber(vitalsRec['mp'], `${where}.vitals.mp`),
  };

  const fate = u['fate'];
  if (!isFate(fate)) {
    throw new Error(
      `${where}.fate must be one of ${VALID_FATES.join(' | ')}, got ${JSON.stringify(fate)}`,
    );
  }

  // Loadout/equipment are plain records of branded-string ids; we assert
  // their object shape but trust their interior (the catalog re-validates
  // every id at `createInitialState` when a unit is actually deployed, so
  // a stricter walk here would only duplicate that and still not be
  // authoritative). Defaulting an omitted bucket to the engine's EMPTY_*
  // keeps a hand-trimmed save loadable.
  const loadout = (u['loadout'] ?? EMPTY_LOADOUT) as CampaignUnit['loadout'];
  const equipment = (u['equipment'] ?? EMPTY_UNIT_EQUIPMENT) as CampaignUnit['equipment'];
  asRecord(loadout, `${where}.loadout`);
  asRecord(equipment, `${where}.equipment`);

  // M2 progression state. Omitted fields default (lenient, matching the
  // loadout/equipment handling) so a hand-trimmed save stays loadable; a
  // present value is validated structurally.
  const earnedByClass = validateEarnedByClass(u['earnedByClass'], `${where}.earnedByClass`);
  const unlocks = validateUnlocks(u['unlocks'], `${where}.unlocks`);

  const gender = u['gender'];
  const base = {
    id,
    name,
    classId,
    level,
    brave,
    faith,
    loadout,
    equipment,
    vitals,
    earnedByClass,
    unlocks,
    fate,
  } as CampaignUnit;

  // exactOptionalPropertyTypes: attach optional fields only when present.
  let result = base;
  if (gender === 'male' || gender === 'female') {
    result = { ...result, gender };
  } else if (gender !== undefined) {
    throw new Error(
      `${where}.gender must be 'male' | 'female' when present, got ${JSON.stringify(gender)}`,
    );
  }

  const rawOverride = u['classAccessOverride'];
  if (rawOverride !== undefined) {
    if (!Array.isArray(rawOverride)) {
      throw new Error(`deserializeCampaign: ${where}.classAccessOverride must be an array`);
    }
    const classAccessOverride = rawOverride.map((c, i) =>
      toClassId(asNonEmptyString(c, `${where}.classAccessOverride[${i}]`)),
    );
    result = { ...result, classAccessOverride };
  }

  return result;
}

// earnedByClass: a `Record<classId, number>` of per-class earned JP. Omitted →
// EMPTY_EARNED_BY_CLASS. Each value must be a number; keys are trusted as
// class-id strings (the component catalog re-validates on spend).
function validateEarnedByClass(raw: unknown, where: string): EarnedByClass {
  if (raw === undefined) return EMPTY_EARNED_BY_CLASS;
  const rec = asRecord(raw, where);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(rec)) {
    out[key] = asNumber(value, `${where}.${key}`);
  }
  return out;
}

// unlocks: array of `{ kind, id }`. Omitted → `[]`. `kind` is validated
// against the closed set; `id` is trusted as a string|number (the component
// catalog re-validates every token when spend is computed — a lenient walk
// here mirrors the loadout-id handling and avoids duplicating that gate).
function validateUnlocks(raw: unknown, where: string): ReadonlyArray<UnlockToken> {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`deserializeCampaign: ${where} must be an array`);
  }
  return raw.map((t, i) => {
    const rec = asRecord(t, `${where}[${i}]`);
    const kind = rec['kind'];
    if (!isUnlockKind(kind)) {
      throw new Error(
        `deserializeCampaign: ${where}[${i}].kind must be one of ` +
          `${VALID_UNLOCK_KINDS.join(' | ')}, got ${JSON.stringify(kind)}`,
      );
    }
    const id = rec['id'];
    if (typeof id !== 'string' && typeof id !== 'number') {
      throw new Error(
        `deserializeCampaign: ${where}[${i}].id must be a string or number, ` +
          `got ${JSON.stringify(id)}`,
      );
    }
    return { kind, id } as UnlockToken;
  });
}

function isUnlockKind(v: unknown): v is UnlockTokenKind {
  return typeof v === 'string' && (VALID_UNLOCK_KINDS as ReadonlyArray<string>).includes(v);
}

// --- small typed guards / coercions (each throws loudly) ---

function asRecord(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Error(`deserializeCampaign: ${where} must be an object`);
  }
  return v as Record<string, unknown>;
}

function asNumber(v: unknown, where: string): number {
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw new Error(`deserializeCampaign: ${where} must be a number, got ${JSON.stringify(v)}`);
  }
  return v;
}

function asString(v: unknown, where: string): string {
  if (typeof v !== 'string') {
    throw new Error(`deserializeCampaign: ${where} must be a string, got ${JSON.stringify(v)}`);
  }
  return v;
}

function asNonEmptyString(v: unknown, where: string): string {
  const s = asString(v, where);
  if (s.length === 0) {
    throw new Error(`deserializeCampaign: ${where} must be a non-empty string`);
  }
  return s;
}

function isFate(v: unknown): v is UnitFate {
  return typeof v === 'string' && (VALID_FATES as ReadonlyArray<string>).includes(v);
}

function isPhase(v: unknown): v is CampaignPhase {
  return typeof v === 'string' && (VALID_PHASES as ReadonlyArray<string>).includes(v);
}

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

import { EMPTY_LOADOUT, EMPTY_UNIT_EQUIPMENT } from '@engine/index.ts';
import type { CampaignPhase, CampaignState, CampaignUnit, UnitFate } from './types.ts';

// Persisted-shape version. Bump when `CampaignState`/`CampaignUnit` change
// in a way that invalidates old saves; `deserializeCampaign` rejects any
// other version rather than guessing a migration.
export const CAMPAIGN_SCHEMA_VERSION = 1;

const VALID_FATES: ReadonlyArray<UnitFate> = ['active', 'lost'];
const VALID_PHASES: ReadonlyArray<CampaignPhase> = ['in_progress', 'won', 'lost'];

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

  const nodeIndex = asNumber(root['nodeIndex'], 'nodeIndex');
  if (!Number.isInteger(nodeIndex) || nodeIndex < 0) {
    throw new Error(
      `deserializeCampaign: nodeIndex must be a non-negative integer, got ${nodeIndex}`,
    );
  }

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

  return { schemaVersion, roster, nodeIndex, phase };
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
    fate,
  } as CampaignUnit;

  // exactOptionalPropertyTypes: only attach `gender` when present.
  if (gender === 'male' || gender === 'female') {
    return { ...base, gender };
  }
  if (gender !== undefined) {
    throw new Error(
      `${where}.gender must be 'male' | 'female' when present, got ${JSON.stringify(gender)}`,
    );
  }
  return base;
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

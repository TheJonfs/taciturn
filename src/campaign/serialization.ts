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
import type {
  CampaignFlags,
  CampaignPhase,
  CampaignState,
  CampaignUnit,
  EarnedByClass,
  UnitFate,
} from './types.ts';
import { EMPTY_EARNED_BY_CLASS } from './types.ts';
import { EMPTY_INVENTORY, bootstrapInventory, type InventoryRecord } from './inventory.ts';
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
// `{earned, spent}`. v5 (M2, XP): added the `xp` carry. Old saves hard-fail.
export const CAMPAIGN_SCHEMA_VERSION = 5;

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

  // TABA M3 inventory. Omitted → derived from roster equipment (the
  // lenient-field convention doubles as the pre-inventory-save
  // grandfather: day-one gear is owned). A present record is validated,
  // then STILL bootstrapped — owned must cover equipped or unequipping
  // grandfathered gear would make it vanish from the pool.
  const inventory = bootstrapInventory(
    validateInventory(root['inventory'], 'inventory'),
    roster,
  );

  // TABA M3 economy — the gil wallet. Omitted → 0 (pre-economy saves earned
  // nothing); a present value must be a non-negative integer.
  const gil = validateGil(root['gil'], 'gil');

  // TABA M3 economy — the navigable map's memory. Lenient grandfather for
  // pre-economy saves: `visited` always covers the current node, and a save
  // sitting at `awaiting_route` has by definition cleared the node it sits
  // at, so its beat id (the node id — legacy nodes author no explicit
  // storyBeatId) is seeded. Earlier history is unrecoverable from a legacy
  // save and simply forgotten (dev-only saves; earlier nodes re-open as the
  // player re-clears forward).
  const visited = withEntry(
    validateStringArray(root['visited'], 'visited'),
    currentNodeId,
  );
  const rawCleared = validateStringArray(root['clearedStoryBeats'], 'clearedStoryBeats');
  const clearedStoryBeats =
    root['clearedStoryBeats'] === undefined && phase === 'awaiting_route'
      ? withEntry(rawCleared, currentNodeId)
      : rawCleared;

  // Ch1 substrate — the campaign-flag store. Omitted → empty (pre-Ch1
  // saves set no flags); present values must be JSON scalars.
  const flags = validateFlags(root['flags'], 'flags');

  // S95 (WI2) — per-hub seen-stock memory for the new-stock badge. Omitted →
  // absent (pre-S95 saves: every stocked hub badges once, then self-heals on
  // the next visit — harmless).
  const shopStockSeen = validateShopStockSeen(root['shopStockSeen'], 'shopStockSeen');

  return {
    schemaVersion,
    roster,
    inventory,
    gil,
    currentNodeId,
    visited,
    clearedStoryBeats,
    flags,
    ...(shopStockSeen !== undefined ? { shopStockSeen } : {}),
    phase,
  };
}

// shopStockSeen: a `Record<string, string[]>` (hub node id → seen item ids).
// Omitted → undefined (the field is optional on CampaignState).
function validateShopStockSeen(
  raw: unknown,
  where: string,
): Readonly<Record<string, ReadonlyArray<string>>> | undefined {
  if (raw === undefined) return undefined;
  const rec = asRecord(raw, where);
  const out: Record<string, ReadonlyArray<string>> = {};
  for (const [key, value] of Object.entries(rec)) {
    out[key] = validateStringArray(value, `${where}.${key}`);
  }
  return out;
}

// flags: a `Record<string, boolean | number | string>`. Omitted → empty
// (the lenient-field grandfather, matching `gil`/`inventory`).
function validateFlags(raw: unknown, where: string): CampaignFlags {
  if (raw === undefined) return {};
  const rec = asRecord(raw, where);
  const out: Record<string, boolean | number | string> = {};
  for (const [key, value] of Object.entries(rec)) {
    if (typeof value !== 'boolean' && typeof value !== 'string') {
      // Numbers get the shared NaN guard.
      asNumber(value, `${where}.${key}`);
    }
    out[key] = value as boolean | number | string;
  }
  return out;
}

function withEntry(list: ReadonlyArray<string>, entry: string): ReadonlyArray<string> {
  return list.includes(entry) ? list : [...list, entry];
}

// A (possibly omitted) array of non-empty strings. Omitted → empty.
function validateStringArray(raw: unknown, where: string): ReadonlyArray<string> {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`deserializeCampaign: ${where} must be an array`);
  }
  return raw.map((v, i) => asNonEmptyString(v, `${where}[${i}]`));
}

// gil: a non-negative integer count. Omitted → 0 (the lenient-field
// grandfather, matching `inventory`).
function validateGil(raw: unknown, where: string): number {
  if (raw === undefined) return 0;
  const gil = asNumber(raw, where);
  if (!Number.isInteger(gil) || gil < 0) {
    throw new Error(
      `deserializeCampaign: ${where} must be a non-negative integer, got ${JSON.stringify(gil)}`,
    );
  }
  return gil;
}

// inventory: a `Record<itemId, number>` of owned counts. Omitted →
// empty (bootstrapped from equipment by the caller above). Counts must
// be non-negative integers; zero entries are dropped (they carry no
// information and would accrete forever).
function validateInventory(raw: unknown, where: string): InventoryRecord {
  if (raw === undefined) return EMPTY_INVENTORY;
  const rec = asRecord(raw, where);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(rec)) {
    const count = asNumber(value, `${where}.${key}`);
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(
        `deserializeCampaign: ${where}.${key} must be a non-negative integer, ` +
          `got ${JSON.stringify(count)}`,
      );
    }
    if (count > 0) out[key] = count;
  }
  return out;
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
  const xp = u['xp'] === undefined ? 0 : asNumber(u['xp'], `${where}.xp`);

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
    xp,
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

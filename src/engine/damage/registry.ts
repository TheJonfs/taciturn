// Damage handler registry — the lookup from string handler refs (named
// in `RulesetDamagePipeline.stages`) to the engine functions that
// implement them.
//
// Why a registry rather than directly named functions: rulesets are
// data, and the seven-stage ordering is part of the data. A custom
// ruleset (hardcore mode, tournament mode) can reorder or drop handlers
// without touching engine code. Adding a new handler is one entry here
// plus its implementation; existing rulesets keep working because they
// only reference the handlers they list.
//
// The registry is engine code, not user content. Handlers themselves
// run pure given (ctx, env) — no side effects, no RNG outside the
// passed seed.

import type { Catalog } from '../catalog/index.ts';
import type { DamageContext, DamageStage, GameState } from '../types/index.ts';

// Pure stage function: takes the in-flight context and returns the
// next one. Env supplies state / catalog / seed for handlers that need
// to look up data, fire hooks, or roll variance.
export type DamageHandler = (ctx: DamageContext, env: PipelineEnv) => DamageContext;

export interface PipelineEnv {
  readonly state: GameState;
  readonly catalog: Catalog;
  // Per-action seed. The variance handler folds this with a small
  // sub-stream index ('variance') to derive a deterministic roll.
  readonly seed: number;
  readonly stage: DamageStage;
}

// Registry shape — string-keyed for ruleset authoring. The engine
// resolves refs against this map at pipeline time; an unknown ref
// throws (the ruleset and the registry must agree, by construction).
export type DamageHandlerRegistry = ReadonlyMap<string, DamageHandler>;

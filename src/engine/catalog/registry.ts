// Generic ID-keyed registry. One instance per definition kind inside the
// `Catalog`. The constructor validates the input (no duplicate IDs); reads
// follow ADR-0002 (throw on miss; `has` for predicate use).
//
// Internal to `engine/catalog/` — the public API is the `Catalog` class
// and the per-kind getter methods on it. Callers should not see `Registry`
// directly.

import { DuplicateDefinitionError, UnknownDefinitionError } from './errors.ts';

export class Registry<TId extends string, TDef extends { readonly id: TId }> {
  private readonly entries: ReadonlyMap<TId, TDef>;
  private readonly kindName: string;

  constructor(defs: ReadonlyArray<TDef>, kindName: string) {
    this.kindName = kindName;
    const map = new Map<TId, TDef>();
    for (const def of defs) {
      if (map.has(def.id)) {
        throw new DuplicateDefinitionError(kindName, def.id);
      }
      map.set(def.id, def);
    }
    this.entries = map;
  }

  get(id: TId): TDef {
    const def = this.entries.get(id);
    if (def === undefined) throw new UnknownDefinitionError(this.kindName, id);
    return def;
  }

  has(id: TId): boolean {
    return this.entries.has(id);
  }

  all(): ReadonlyArray<TDef> {
    return Array.from(this.entries.values());
  }
}

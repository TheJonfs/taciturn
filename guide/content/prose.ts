// Content shape for hand-authored class prose.
//
// The instructor's voice lives in content/ as structured data, not as
// markup inside templates (see guide/CLAUDE.md). Each class file exports
// a `ClassProse` object; the page templates compose it with imported
// catalog data. `brief` and `strategy` accept light markdown (the voice
// uses italics for in-world inflection); per-ability notes are short
// enough to stay plain.

/** Per-ability instructor's note, authored at two densities. */
export interface AbilityNote {
  /** Full note — one to three sentences. For block-per-ability layouts. */
  readonly full: string;
  /** Compact note — a tight clause. For table / callout layouts. */
  readonly compact: string;
}

/**
 * Hand-authored notes for one armory item. The mechanical data (stats,
 * hooks, restrictions) flows in from ../src/content; this is only the
 * voice — kept evocative, but mechanically clear about what the item
 * does and when to reach for it.
 */
export interface ItemNote {
  /** 1–3 sentences of character — the Armorer's or the instructor's note. */
  readonly flavor: string;
  /** Brief — when this item earns its place. Light markdown ok. */
  readonly tactical: string;
}

export interface ClassProse {
  /** One-line role tagline. */
  readonly tagline: string;
  /** The instructor's brief — the spread's main prose. Light markdown ok. */
  readonly brief: string;
  /** Per-ability notes, keyed by ability id (e.g. "power_attack"). */
  readonly abilityNotes: Readonly<Record<string, AbilityNote>>;
  /** Specialization strategy note — a paragraph or two. Light markdown ok. */
  readonly strategy: string;
  /**
   * Short marginal asides in the instructor's voice — scribbled, informal.
   * Used by the "Compiled Notes" variant; ignored by the others.
   */
  readonly marginalia?: ReadonlyArray<string>;
}

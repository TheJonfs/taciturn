// Atlas — localStorage draft persistence.
//
// The draft is the WORKING COPY (survives reloads mid-edit); export is the
// deliberate act that produces shipped code. Versioned key: a model-shape
// change bumps the version and older drafts are ignored (a draft is
// disposable scratch — never worth a migration).

import type { AtlasGraph } from './model.ts';

const DRAFT_KEY = 'taciturn-atlas-draft-v1';

export function loadDraft(): AtlasGraph | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as AtlasGraph;
    if (typeof candidate.startId !== 'string') return null;
    if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) return null;
    return candidate;
  } catch {
    return null; // an unreadable draft is a missing draft
  }
}

export function saveDraft(model: AtlasGraph): void {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(model));
}

export function clearDraft(): void {
  window.localStorage.removeItem(DRAFT_KEY);
}

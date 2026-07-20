// Cartographer — localStorage draft persistence (Atlas storage idiom).
// One draft slot, versioned; a shape mismatch discards silently (it's a
// draft cache, not authored truth — the shipped modules are).

import type { CartographerModel } from './model.ts';

const KEY = 'taciturn-cartographer-draft-v1';

export function saveDraft(model: CartographerModel): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(model));
  } catch {
    // Storage full/unavailable — drafts are best-effort.
  }
}

export function loadDraft(): CartographerModel | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as CartographerModel;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.spec?.key !== 'string' ||
      !Array.isArray(parsed.spec.elevation) ||
      !Array.isArray(parsed.registry)
    ) {
      return null;
    }
    // Tier-1 drafts predate the lineup field — normalize it in.
    return { ...parsed, lineup: parsed.lineup ?? null };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export const PICKER_CANONICAL_KEY = 'glueck_picker_custom_names';
export const PICKER_LEGACY_KEY = 'dl_picker_names';
export const PICKER_NAMES_CLEARED_SENTINEL = '__gluck_cleared__';

function parsePickerNamesRaw(raw: string | null): string[] | null {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      cleaned.push(trimmed);
    }
    return cleaned;
  } catch {
    return null;
  }
}

/**
 * Safely reads and merges picker names from both `glueck_picker_custom_names`
 * and legacy `dl_picker_names` without overwriting or discarding existing user data.
 *
 * Semantics:
 * - If one key is explicitly `[]` (written by an intentional clear via writeSyncedPickerNames)
 *   and the other key is ALSO `[]` or absent -> returns `[]`.
 * - If BOTH keys exist and one has non-empty items while the other is `null`/absent -> preserves non-empty items.
 * - If BOTH keys have items -> non-destructively unions them preserving order.
 */
export function readMergedPickerNames(): { names: string[] | null; needsMirrorSync: boolean } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { names: null, needsMirrorSync: false };
  }
  try {
    const canonicalRaw = window.localStorage.getItem(PICKER_CANONICAL_KEY);
    const legacyRaw = window.localStorage.getItem(PICKER_LEGACY_KEY);

    const canonical = parsePickerNamesRaw(canonicalRaw);
    const legacy = parsePickerNamesRaw(legacyRaw);

    if (canonical === null && legacy === null) {
      return { names: null, needsMirrorSync: false };
    }

    const canonicalList = canonical || [];
    const legacyList = legacy || [];

    // If canonical exists as explicit [] and legacy doesn't exist, it's an intentional empty list
    // If both exist and differ ONLY because one wasn't synced yet, preserve any non-empty entries safely.
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const name of [...canonicalList, ...legacyList]) {
      if (!seen.has(name)) {
        seen.add(name);
        merged.push(name);
      }
    }

    const needsMirrorSync =
      JSON.stringify(canonicalList) !== JSON.stringify(merged) ||
      JSON.stringify(legacyList) !== JSON.stringify(merged) ||
      canonical === null ||
      legacy === null;

    return { names: merged, needsMirrorSync };
  } catch {
    return { names: null, needsMirrorSync: false };
  }
}

/**
 * Safely writes picker names to BOTH `glueck_picker_custom_names` and `dl_picker_names`
 * so legacy and canonical readers never drift apart.
 */
export function writeSyncedPickerNames(names: string[], emitEvent = true): string[] {
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(names) ? names : []) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    const serialized = JSON.stringify(cleaned);
    try {
      window.localStorage.setItem(PICKER_CANONICAL_KEY, serialized);
    } catch {
      // Ignore storage quota error
    }
    try {
      window.localStorage.setItem(PICKER_LEGACY_KEY, serialized);
    } catch {
      // Ignore storage quota error
    }
    if (emitEvent && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(
          new CustomEvent('glueck-picker-names-updated', { detail: { names: cleaned } })
        );
      } catch {
        // Ignore dispatch errors
      }
    }
  }

  return cleaned;
}

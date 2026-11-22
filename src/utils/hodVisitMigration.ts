export function mergeHodVisitMigration<T extends { id?: string }>(
  existingVisits: T[],
  legacyVisits: T[],
  alreadyMigrated: boolean = false
): T[] {
  const safeExisting = Array.isArray(existingVisits) ? existingVisits : [];
  if (alreadyMigrated) return safeExisting;
  const safeLegacy = Array.isArray(legacyVisits) ? legacyVisits : [];
  if (safeLegacy.length === 0) return safeExisting;

  const seenIds = new Set<string>(
    safeExisting.map((v) => String(v?.id || '').trim()).filter(Boolean)
  );
  const merged = [...safeExisting];
  for (const item of safeLegacy) {
    if (!item || typeof item !== 'object') continue;
    const itemId = String(item.id || '').trim();
    if (itemId && seenIds.has(itemId)) continue;
    if (itemId) seenIds.add(itemId);
    merged.push(item);
  }
  return merged;
}

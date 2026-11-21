import { VisitRecord } from '../types';

/**
 * One-time import of legacy profile visits into the canonical HOD collection.
 * Canonical records always win by ID, including deletion tombstones. Deleted
 * legacy rows are never imported, and callers must persist the migration flag.
 */
export function mergeHodVisitMigration(
  canonical: VisitRecord[],
  legacy: VisitRecord[],
  migrationAlreadyDone: boolean
): VisitRecord[] {
  const byId = new Map<string, VisitRecord>();
  if (!migrationAlreadyDone) {
    (Array.isArray(legacy) ? legacy : []).forEach((visit) => {
      if (visit?.id && !visit.deleted) byId.set(visit.id, visit);
    });
  }
  (Array.isArray(canonical) ? canonical : []).forEach((visit) => {
    if (visit?.id) byId.set(visit.id, visit);
  });
  return Array.from(byId.values());
}

import { TeacherProfile } from '../types';

/**
 * Returns the teacher's English / German name, specially formatted for certificates and formal diplomas.
 * Prioritizes displayNameEn, nameEn, then displayName.
 */
export function getTeacherEnglishName(
  profile?: TeacherProfile | null,
  fallback: string = 'Teacher'
): string {
  if (!profile) return fallback;
  const en = profile.displayNameEn?.trim() || profile.nameEn?.trim();
  if (en) return en;

  const base = profile.displayName?.trim() || (profile as any).name?.trim();
  if (base && !/[\u0600-\u06FF]/.test(base)) {
    return base;
  }
  return base || fallback;
}

/**
 * Returns the teacher's Arabic name, specially formatted for parent reports, invoices, and WhatsApp summaries.
 * Prioritizes displayNameAr, nameAr, then displayName.
 */
export function getTeacherArabicName(
  profile?: TeacherProfile | null,
  fallback: string = 'المعلم'
): string {
  if (!profile) return fallback;
  const ar = profile.displayNameAr?.trim() || profile.nameAr?.trim();
  if (ar) return ar;

  const base = profile.displayName?.trim() || (profile as any).name?.trim();
  if (base && /[\u0600-\u06FF]/.test(base)) {
    return base;
  }
  return base || fallback;
}

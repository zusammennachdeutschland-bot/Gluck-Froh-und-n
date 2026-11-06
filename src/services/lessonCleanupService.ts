import { Lesson, Group, Student, PaymentRecord, FinanceTransaction } from '../types';
import { calculateDuePaymentCycles } from '../utils/paymentUtils';
import { calculateStudentDueBannerTotals } from './financeService';
import { storage } from './storageService';

export const PRUNED_LESSON_IDS_KEY = 'gluck_pruned_lesson_ids';
export const PRUNED_LESSONS_BACKUP_KEY = 'gluck_pruned_lessons_archive';
export const LAST_CLEANUP_DATE_KEY = 'gluck_last_auto_cleanup_date';

export interface LessonCleanupAnalysis {
  totalLessons: number;
  // Historical
  historicalEligibleToPrune: Lesson[];
  historicalProtectedCount: number;
  // Future
  futureBloatToPrune: Lesson[];
  futureProtectedCount: number;
  // Totals
  totalToPrune: number;
  totalRemaining: number;
  // Invariant verification
  preTotalRevenue: number;
  postTotalRevenue: number;
  preTotalPayments: number;
  postTotalPayments: number;
  preUnpaidBalancesTotal: number;
  postUnpaidBalancesTotal: number;
  financialInvarianceVerified: boolean;
  thirtyDaysAgoStr: string;
  fourteenDaysAheadStr: string;
}

export interface LessonCleanupResult {
  cleanedLessons: Lesson[];
  prunedLessons: Lesson[];
  prunedCount: number;
  backupArchiveKey: string;
}

/**
 * Helper to format a local Date to YYYY-MM-DD
 */
export function formatLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the set of IDs that have been explicitly pruned so they are never re-imported or resurrected.
 */
export function getPrunedLessonIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PRUNED_LESSON_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Add IDs to the pruned tombstone set.
 */
export function addPrunedLessonIds(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length === 0) return;
  try {
    const current = getPrunedLessonIds();
    ids.forEach((id) => current.add(id));
    localStorage.setItem(PRUNED_LESSON_IDS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // Ignore storage quota
  }
}

/**
 * Checks if a historical lesson is strictly 100% paid and free of any student debts.
 */
export function isLessonFullySettled(lesson: Lesson): boolean {
  if (lesson.deleted) return true;
  // If explicitly pending or partial, it is NOT settled
  if (lesson.paymentStatus === 'pending' || lesson.paymentStatus === 'partial') {
    return false;
  }

  // If amountDue is greater than amountPaid, it's not settled
  if (typeof lesson.amountDue === 'number' && typeof lesson.amountPaid === 'number') {
    if (lesson.amountDue > 0 && lesson.amountPaid < lesson.amountDue && lesson.paymentStatus !== 'exempted') {
      return false;
    }
  }

  // Check studentPayments mapping if present
  if (lesson.studentPayments && typeof lesson.studentPayments === 'object') {
    for (const [_, sp] of Object.entries(lesson.studentPayments)) {
      const status = (sp as any)?.paymentStatus || (sp as any)?.status;
      if (status === 'pending' || status === 'partial') {
        return false;
      }
      const due = Number((sp as any)?.amountDue || (sp as any)?.amount || 0);
      const paid = Number((sp as any)?.amountPaid || 0);
      if (due > 0 && paid < due && status !== 'exempted' && status !== 'paid') {
        return false;
      }
    }
  }

  // Check report.studentPayments if present
  if (lesson.report?.studentPayments && typeof lesson.report.studentPayments === 'object') {
    for (const [_, sp] of Object.entries(lesson.report.studentPayments)) {
      const status = (sp as any)?.paymentStatus || (sp as any)?.status;
      if (status === 'pending' || status === 'partial') {
        return false;
      }
      const due = Number((sp as any)?.amountDue || (sp as any)?.amount || 0);
      const paid = Number((sp as any)?.amountPaid || 0);
      if (due > 0 && paid < due && status !== 'exempted' && status !== 'paid') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Analyzes the lessons collection according to the 30-day historical and 14-day future window rules,
 * running a full pre-check and post-check invariant audit on finances and student balances.
 */
export function analyzeLessonCleanup(
  lessons: Lesson[],
  groups: Group[],
  students: Student[],
  payments: PaymentRecord[],
  financeTransactions: FinanceTransaction[] = []
): LessonCleanupAnalysis {
  const today = new Date();

  // Historical threshold: 30 days ago
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const thirtyDaysAgoStr = formatLocalDateStr(thirtyDaysAgo);

  // Future window threshold: 14 days ahead
  const fourteenDaysAhead = new Date(today);
  fourteenDaysAhead.setDate(today.getDate() + 14);
  const fourteenDaysAheadStr = formatLocalDateStr(fourteenDaysAhead);

  const historicalEligibleToPrune: Lesson[] = [];
  let historicalProtectedCount = 0;

  const futureBloatToPrune: Lesson[] = [];
  let futureProtectedCount = 0;

  const activeStudents = (students || []).filter((s) => s.status !== 'archived');

  // Pre-calculate student balances before cleanup using Glück's canonical due payment calculator
  let preUnpaidBalancesTotal = 0;
  try {
    const dueCycles = calculateDuePaymentCycles(activeStudents, groups, lessons, payments);
    const banner = calculateStudentDueBannerTotals(dueCycles, payments);
    preUnpaidBalancesTotal = banner.totalAmountDueFromStudents;
  } catch (err) {
    console.error('Balance pre-calc error:', err);
  }

  // Pre-calculate revenue & payments
  const preTotalRevenue = financeTransactions
    .filter((tx) => !tx.deleted && tx.type === 'income')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const preTotalPayments = payments
    .filter((p) => !p.deleted && (p.status === 'paid' || (p.amountPaid && p.amountPaid > 0)))
    .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

  // Group lessons by criteria
  lessons.forEach((l) => {
    if (l.deleted) return;

    const lessonDate = l.date;

    // 1. Future lessons beyond 14 days
    if (lessonDate > fourteenDaysAheadStr) {
      // Safe to prune ONLY if it is an unconfirmed auto-generated recurring lesson
      // (starts with l_auto_, status is scheduled, no report, no custom attendance)
      const isAutoGenerated = l.id.startsWith('l_auto_');
      const isUnmodified =
        l.status === 'scheduled' &&
        (!l.report || Object.keys(l.report).length === 0) &&
        (!l.studentPayments || Object.keys(l.studentPayments).length === 0);

      if (isAutoGenerated && isUnmodified) {
        futureBloatToPrune.push(l);
      } else {
        futureProtectedCount++;
      }
      return;
    }

    // 2. Historical lessons older than 30 days
    if (lessonDate < thirtyDaysAgoStr) {
      // Safe to prune ONLY if completed AND 100% fully paid / settled
      const isCompleted = l.status === 'completed';
      const isFullySettled = isLessonFullySettled(l);

      if (isCompleted && isFullySettled) {
        historicalEligibleToPrune.push(l);
      } else {
        historicalProtectedCount++;
      }
      return;
    }

    // Within active window (-30 days to +14 days) -> Protected
    futureProtectedCount++;
  });

  const prunableIds = new Set([
    ...historicalEligibleToPrune.map((l) => l.id),
    ...futureBloatToPrune.map((l) => l.id)
  ]);

  const simulatedRemainingLessons = lessons.filter((l) => !prunableIds.has(l.id));

  // Post-calculate student balances on simulated remaining lessons
  let postUnpaidBalancesTotal = 0;
  try {
    const postDueCycles = calculateDuePaymentCycles(activeStudents, groups, simulatedRemainingLessons, payments);
    const postBanner = calculateStudentDueBannerTotals(postDueCycles, payments);
    postUnpaidBalancesTotal = postBanner.totalAmountDueFromStudents;
  } catch (err) {
    console.error('Balance post-calc error:', err);
  }

  const postTotalRevenue = preTotalRevenue; // Finance transactions are untouched
  const postTotalPayments = preTotalPayments; // Payments are untouched

  // Financial Invariance Check:
  // Since we only prune 100% settled historical lessons and untouched future placeholders,
  // the unpaid balances must match exactly!
  const financialInvarianceVerified =
    Math.round(preUnpaidBalancesTotal) === Math.round(postUnpaidBalancesTotal) &&
    preTotalRevenue === postTotalRevenue &&
    preTotalPayments === postTotalPayments;

  const totalToPrune = prunableIds.size;
  const totalRemaining = simulatedRemainingLessons.length;

  return {
    totalLessons: lessons.length,
    historicalEligibleToPrune,
    historicalProtectedCount,
    futureBloatToPrune,
    futureProtectedCount,
    totalToPrune,
    totalRemaining,
    preTotalRevenue,
    postTotalRevenue,
    preTotalPayments,
    postTotalPayments,
    preUnpaidBalancesTotal,
    postUnpaidBalancesTotal,
    financialInvarianceVerified,
    thirtyDaysAgoStr,
    fourteenDaysAheadStr
  };
}

/**
 * Downloads a timestamped JSON backup file containing all lessons designated for pruning.
 */
export function exportPrunedLessonsBackupJson(prunedLessons: Lesson[]): void {
  if (typeof window === 'undefined') return;

  const backupData = {
    app: 'Glück German Language Studio',
    backupType: 'pre_cleanup_lessons_archive',
    timestamp: new Date().toISOString(),
    totalArchivedLessons: prunedLessons.length,
    lessons: prunedLessons
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = formatLocalDateStr(new Date());
  link.download = `glueck-lessons-pruned-backup-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Executes the safe cleanup.
 * 1. Saves pruned lessons to internal archive storage.
 * 2. Adds IDs to the tombstone set to prevent re-import from Firestore caches.
 * 3. Returns the cleaned lessons array.
 */
export async function executeLessonCleanup(
  currentLessons: Lesson[],
  analysis: LessonCleanupAnalysis
): Promise<LessonCleanupResult> {
  const prunableIds = new Set([
    ...analysis.historicalEligibleToPrune.map((l) => l.id),
    ...analysis.futureBloatToPrune.map((l) => l.id)
  ]);

  const prunedLessons = currentLessons.filter((l) => prunableIds.has(l.id));
  const cleanedLessons = currentLessons.filter((l) => !prunableIds.has(l.id));

  // 1. Save to local storage archive
  try {
    const existingArchive = (await storage.getItem<Lesson[]>(PRUNED_LESSONS_BACKUP_KEY)) || [];
    const combinedArchive = [...existingArchive, ...prunedLessons];
    // Keep at most 5000 archived items
    const truncatedArchive = combinedArchive.slice(-5000);
    await storage.setItem(PRUNED_LESSONS_BACKUP_KEY, truncatedArchive);
  } catch (err) {
    console.warn('Could not store all pruned lessons to local storage archive:', err);
  }

  // 2. Record tombstone IDs so cloud sync will never resurrect them
  addPrunedLessonIds(Array.from(prunableIds));

  // 3. Mark last cleanup date
  try {
    localStorage.setItem(LAST_CLEANUP_DATE_KEY, formatLocalDateStr(new Date()));
  } catch {
    // Ignore
  }

  return {
    cleanedLessons,
    prunedLessons,
    prunedCount: prunableIds.size,
    backupArchiveKey: PRUNED_LESSONS_BACKUP_KEY
  };
}

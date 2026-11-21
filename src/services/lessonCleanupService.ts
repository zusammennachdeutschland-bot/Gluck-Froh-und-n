import { Lesson, Group, Student, PaymentRecord, FinanceTransaction } from '../types';
import { calculateDuePaymentCycles } from '../utils/paymentUtils';
import { isGroupPerLesson } from '../utils/lessonUtils';
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

export const MAX_PRUNED_ARCHIVE_ITEMS = 1000;

/**
 * Add IDs to the pruned tombstone set. Throws on persistence failure so cleanup can abort/roll back cleanly.
 */
export function addPrunedLessonIds(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length === 0) return;
  const current = getPrunedLessonIds();
  ids.forEach((id) => current.add(id));
  const serialized = JSON.stringify(Array.from(current));
  try {
    localStorage.setItem(PRUNED_LESSON_IDS_KEY, serialized);
  } catch (err: any) {
    throw new Error(`Failed to persist pruned lesson tombstones (${err?.message || 'Storage error'}).`);
  }
}

/**
 * Checks if a historical lesson is strictly 100% paid and free of any student debts.
 * Requires explicit proof of settlement; never defaults to true when payment data is missing.
 */
export function isLessonFullySettled(
  lesson: Lesson,
  groups: Group[] = [],
  payments: PaymentRecord[] = []
): boolean {
  if (lesson.deleted) return true;

  // If explicitly pending or partial at lesson or report level, it is NOT settled
  if (lesson.paymentStatus === 'pending' || lesson.paymentStatus === 'partial') {
    return false;
  }
  const reportPaymentStatus = (lesson.report as any)?.paymentStatus;
  if (reportPaymentStatus === 'pending' || reportPaymentStatus === 'partial') {
    return false;
  }

  // If amountDue is greater than amountPaid, it's not settled
  if (typeof lesson.amountDue === 'number' && typeof lesson.amountPaid === 'number') {
    if (lesson.amountDue > 0 && lesson.amountPaid < lesson.amountDue && lesson.paymentStatus !== 'exempted') {
      return false;
    }
  }

  // Individual lesson check: only per-lesson individual lessons (or lessons explicitly covered by a paid PaymentRecord) are eligible
  const group = groups.find((g) => g.id === lesson.groupId);
  const isIndividualLesson =
    Boolean(lesson.studentId) ||
    Boolean((group as any)?.isIndividual);

  const isCoveredByPaidPaymentRecord =
    Array.isArray(payments) &&
    payments.some(
      (p) =>
        !p.deleted &&
        p.status === 'paid' &&
        Array.isArray(p.lessonIds) &&
        p.lessonIds.includes(lesson.id)
    );

  if (
    isIndividualLesson &&
    group &&
    !isGroupPerLesson(group) &&
    !isCoveredByPaidPaymentRecord
  ) {
    return false;
  }

  let hasExplicitSettlementProof = false;

  if (
    lesson.paymentStatus === 'paid' ||
    lesson.paymentStatus === 'exempted' ||
    reportPaymentStatus === 'paid' ||
    reportPaymentStatus === 'exempted' ||
    isCoveredByPaidPaymentRecord
  ) {
    hasExplicitSettlementProof = true;
  }

  if (
    typeof lesson.amountDue === 'number' &&
    lesson.amountDue > 0 &&
    typeof lesson.amountPaid === 'number' &&
    lesson.amountPaid >= lesson.amountDue
  ) {
    hasExplicitSettlementProof = true;
  }

  // Check studentPayments mapping if present
  if (lesson.studentPayments && typeof lesson.studentPayments === 'object') {
    const entries = Object.entries(lesson.studentPayments);
    if (entries.length > 0) {
      let allEntriesSettled = true;
      for (const [_, sp] of entries) {
        const status = (sp as any)?.paymentStatus || (sp as any)?.status;
        if (status === 'pending' || status === 'partial') {
          return false;
        }
        const due = Number((sp as any)?.amountDue ?? (sp as any)?.amount ?? 0);
        const paid = Number((sp as any)?.amountPaid ?? 0);
        if (due > 0 && paid < due && status !== 'exempted' && status !== 'paid') {
          return false;
        }
        const entrySettled =
          status === 'paid' ||
          status === 'exempted' ||
          (due > 0 && paid >= due);
        if (!entrySettled) {
          allEntriesSettled = false;
        }
      }
      if (allEntriesSettled) {
        hasExplicitSettlementProof = true;
      }
    }
  }

  // Check report.studentPayments if present
  if (lesson.report?.studentPayments && typeof lesson.report.studentPayments === 'object') {
    const entries = Object.entries(lesson.report.studentPayments);
    if (entries.length > 0) {
      let allEntriesSettled = true;
      for (const [_, sp] of entries) {
        const status = (sp as any)?.paymentStatus || (sp as any)?.status;
        if (status === 'pending' || status === 'partial') {
          return false;
        }
        const due = Number((sp as any)?.amountDue ?? (sp as any)?.amount ?? 0);
        const paid = Number((sp as any)?.amountPaid ?? 0);
        if (due > 0 && paid < due && status !== 'exempted' && status !== 'paid') {
          return false;
        }
        const entrySettled =
          status === 'paid' ||
          status === 'exempted' ||
          (due > 0 && paid >= due);
        if (!entrySettled) {
          allEntriesSettled = false;
        }
      }
      if (allEntriesSettled) {
        hasExplicitSettlementProof = true;
      }
    }
  }

  return hasExplicitSettlementProof;
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
  let preCalcSucceeded = false;
  try {
    const dueCycles = calculateDuePaymentCycles(activeStudents, groups, lessons, payments);
    const banner = calculateStudentDueBannerTotals(dueCycles, payments);
    if (typeof banner?.totalAmountDueFromStudents === 'number' && Number.isFinite(banner.totalAmountDueFromStudents)) {
      preUnpaidBalancesTotal = banner.totalAmountDueFromStudents;
      preCalcSucceeded = true;
    }
  } catch (err) {
    console.error('Balance pre-calc error:', err);
    preCalcSucceeded = false;
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
      const isFullySettled = isLessonFullySettled(l, groups, payments);

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
  let postCalcSucceeded = false;
  try {
    const postDueCycles = calculateDuePaymentCycles(activeStudents, groups, simulatedRemainingLessons, payments);
    const postBanner = calculateStudentDueBannerTotals(postDueCycles, payments);
    if (
      typeof postBanner?.totalAmountDueFromStudents === 'number' &&
      Number.isFinite(postBanner.totalAmountDueFromStudents)
    ) {
      postUnpaidBalancesTotal = postBanner.totalAmountDueFromStudents;
      postCalcSucceeded = true;
    }
  } catch (err) {
    console.error('Balance post-calc error:', err);
    postCalcSucceeded = false;
  }

  const postTotalRevenue = preTotalRevenue; // Finance transactions are untouched
  const postTotalPayments = preTotalPayments; // Payments are untouched

  // Financial Invariance Check:
  // Both pre and post calculations must succeed without error, and unpaid balances must match.
  const financialInvarianceVerified =
    preCalcSucceeded &&
    postCalcSucceeded &&
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
 * Executes the safe cleanup in strict order: Archive -> Tombstone -> Delete.
 * 1. Verifies financial invariance passed.
 * 2. Snapshots pre-cleanup archive and tombstones.
 * 3. Saves pruned lessons to internal archive storage capped at MAX_PRUNED_ARCHIVE_ITEMS (1,000) and verifies readback.
 * 4. Persists IDs to the tombstone set; if tombstone write fails, rolls back archive immediately and aborts.
 * 5. If an optional commitCleanedLessons callback is supplied and fails during delete/persist, rolls back both archive and tombstones cleanly.
 */
export async function executeLessonCleanup(
  currentLessons: Lesson[],
  analysis: LessonCleanupAnalysis,
  onCommitCleanedLessons?: (cleanedLessons: Lesson[]) => Promise<void>
): Promise<LessonCleanupResult> {
  if (!analysis.financialInvarianceVerified) {
    throw new Error('Cannot execute lesson cleanup: financial invariance verification failed.');
  }

  const prunableIds = new Set([
    ...analysis.historicalEligibleToPrune.map((l) => l.id),
    ...analysis.futureBloatToPrune.map((l) => l.id)
  ]);

  const prunedLessons = currentLessons.filter((l) => prunableIds.has(l.id));
  const cleanedLessons = currentLessons.filter((l) => !prunableIds.has(l.id));

  let previousArchive: Lesson[] | null = null;
  let archiveWasMutated = false;
  let previousTombstonesRaw: string | null = null;
  let tombstonesWereMutated = false;

  if (typeof localStorage !== 'undefined') {
    try {
      previousTombstonesRaw = localStorage.getItem(PRUNED_LESSON_IDS_KEY);
    } catch {
      previousTombstonesRaw = null;
    }
  }

  const rollbackArchiveAndTombstones = async () => {
    if (tombstonesWereMutated && typeof localStorage !== 'undefined') {
      try {
        if (previousTombstonesRaw === null) {
          localStorage.removeItem(PRUNED_LESSON_IDS_KEY);
        } else {
          localStorage.setItem(PRUNED_LESSON_IDS_KEY, previousTombstonesRaw);
        }
      } catch {
        // Best-effort tombstone rollback
      }
    }
    if (archiveWasMutated) {
      try {
        if (previousArchive === null) {
          await storage.removeItem(PRUNED_LESSONS_BACKUP_KEY);
        } else {
          await storage.setItem(PRUNED_LESSONS_BACKUP_KEY, previousArchive);
        }
      } catch {
        // Best-effort archive rollback
      }
    }
  };

  // Step 1: ARCHIVE — save pruned lessons to archive BEFORE tombstoning or deleting
  if (prunedLessons.length > 0) {
    try {
      previousArchive = await storage.getItem<Lesson[]>(PRUNED_LESSONS_BACKUP_KEY);
      const existingArchive = Array.isArray(previousArchive) ? previousArchive : [];
      const existingIds = new Set(existingArchive.map((l) => l.id));
      const newToArchive = prunedLessons.filter((l) => !existingIds.has(l.id));
      const combinedArchive = [...existingArchive, ...newToArchive];
      // Keep at most MAX_PRUNED_ARCHIVE_ITEMS (1,000) archived items
      const truncatedArchive = combinedArchive.slice(-MAX_PRUNED_ARCHIVE_ITEMS);
      await storage.setItem(PRUNED_LESSONS_BACKUP_KEY, truncatedArchive);
      archiveWasMutated = true;
      const verified = await storage.verifyDurableReadBack([PRUNED_LESSONS_BACKUP_KEY]);
      if (!verified) {
        throw new Error('Archive readback verification failed.');
      }
    } catch (err: any) {
      await rollbackArchiveAndTombstones();
      throw new Error(
        `Failed to save pruned lessons archive before deletion (${err?.message || 'Storage error'}). Cleanup aborted.`
      );
    }
  }

  // Step 2: TOMBSTONE — record tombstone IDs strictly; roll back archive on failure
  if (prunableIds.size > 0) {
    try {
      addPrunedLessonIds(Array.from(prunableIds));
      tombstonesWereMutated = true;
    } catch (err: any) {
      await rollbackArchiveAndTombstones();
      throw new Error(
        `Failed to record pruned lesson tombstones (${err?.message || 'Storage error'}). Cleanup aborted and archive rolled back.`
      );
    }
  }

  // Step 3: DELETE — apply cleaned lessons deletion atomically if callback provided
  if (onCommitCleanedLessons) {
    try {
      await onCommitCleanedLessons(cleanedLessons);
    } catch (err: any) {
      await rollbackArchiveAndTombstones();
      throw new Error(
        `Failed to persist cleaned lessons (${err?.message || 'Storage error'}). Cleanup rolled back.`
      );
    }
  }

  // Step 4: Mark last cleanup date only after archive, tombstone, and delete succeed
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_CLEANUP_DATE_KEY, formatLocalDateStr(new Date()));
    }
  } catch {
    // Non-fatal metadata write
  }

  return {
    cleanedLessons,
    prunedLessons,
    prunedCount: prunableIds.size,
    backupArchiveKey: PRUNED_LESSONS_BACKUP_KEY
  };
}

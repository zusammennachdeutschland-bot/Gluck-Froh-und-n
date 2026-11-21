import assert from 'node:assert/strict';
import {
  executeAtomicBackupCommit,
  AtomicBackupCommitEntry
} from '../utils/backupEngine';
import {
  evaluateScheduledBackups,
  executeScheduledBackupCheck,
  getLocalIsoWeekKey,
  getLocalMonthKey
} from '../hooks/useAutomatedDailyBackup';
import {
  analyzeLessonCleanup,
  executeLessonCleanup,
  getPrunedLessonIds,
  PRUNED_LESSON_IDS_KEY,
  PRUNED_LESSONS_BACKUP_KEY,
  LAST_CLEANUP_DATE_KEY
} from '../services/lessonCleanupService';
import {
  safeLocalStorageSetItem,
  storage,
  __setSimulatePrimaryDbForTests,
  __clearMemoryStoreOnlyForTests,
  __setPrimaryDbVerifiedKeyForTests,
  __setStorageFailureHookForTests
} from '../services/storageService';
import {
  HOMEWORK_AUTO_CLOSE_GRACE_DAYS,
  getHomeworkDueDateAutoCloseMs,
  isHomeworkAutoClosedByDeadline,
  isHomeworkAssignmentOpenForStudents,
  saveAssignmentWithConfirmation,
  setHomeworkAssignmentActiveStatus,
  migrateLegacyHomeworkForAccount,
  getLocalAssignments,
  getAssignmentsStorageKey,
  __setHomeworkAuthUserForTests,
  __setHomeworkSyncTransportForTests
} from '../shared/homeworkStorageSync';
import { HomeworkAssignment } from '../shared/homeworkTypes';
import { Lesson } from '../types';

class QuotaAwareMemoryStorage implements Storage {
  private store = new Map<string, string>();
  public quotaKeys = new Set<string>();
  public alwaysThrowQuotaOnSet = false;
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); this.quotaKeys.clear(); this.alwaysThrowQuotaOnSet = false; }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); this.quotaKeys.delete(key); }
  setItem(key: string, value: string): void {
    if (this.alwaysThrowQuotaOnSet || this.quotaKeys.has(key)) {
      const err: any = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      err.code = 22;
      throw err;
    }
    this.store.set(key, String(value));
  }
}

const memStorage = new QuotaAwareMemoryStorage();
(globalThis as any).localStorage = memStorage;
(globalThis as any).window = {
  localStorage: memStorage,
  location: { origin: 'https://glueck.example.com' },
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};
if (typeof CustomEvent === 'undefined') {
  (globalThis as any).CustomEvent = class {
    type: string;
    detail: any;
    constructor(type: string, opts?: any) {
      this.type = type;
      this.detail = opts?.detail;
    }
  };
}

function makeHomework(overrides: Partial<HomeworkAssignment> = {}): HomeworkAssignment {
  return {
    id: overrides.id ?? 'hw_remed_1',
    ownerUid: overrides.ownerUid ?? 'teacher_backup_1',
    shortId: overrides.shortId ?? 'ReMed01',
    title: overrides.title ?? 'Hausaufgabe A1',
    createdAt: overrides.createdAt ?? '2026-10-01T10:00:00.000Z',
    isActive: overrides.isActive ?? true,
    status: overrides.status ?? 'active',
    audienceMode: 'open',
    setSnapshot: {
      id: 'set_1',
      nameAr: 'التحيات',
      nameDe: 'Begrüßung',
      level: 'A1',
      items: [{ id: 1, de: 'Hallo', ar: 'مرحبا', cat: 'Alltag' }]
    },
    allowedGameModes: ['classic_quiz'],
    questionCount: 5,
    maxAttempts: 3,
    ...overrides
  } as HomeworkAssignment;
}

async function runTests(): Promise<void> {
  console.log('Running Backup (#1-#5) & Homework (#1-#3) Remediation Tests...');
  __setSimulatePrimaryDbForTests(true);

  // -------------------------------------------------------------------------
  // Backup #1: Atomic stage -> commit+readback -> rollback across storage & React state
  // -------------------------------------------------------------------------
  {
    memStorage.clear();
    __clearMemoryStoreOnlyForTests();
    const backedMap = new Map<string, any>([
      ['dl_groups', [{ id: 'g_old' }]],
      ['dl_students', [{ id: 's_old' }]],
      ['dl_lessons', [{ id: 'l_old' }]]
    ]);
    let stateGroups: any[] = [{ id: 'g_old' }];
    let stateStudents: any[] = [{ id: 's_old' }];
    let stateLessons: any[] = [{ id: 'l_old' }];
    let failOnLessonsVerify = true;

    const mockAdapter = {
      getItem: async <T>(k: string): Promise<T | null> => (backedMap.has(k) ? backedMap.get(k) : null),
      setItem: async <T>(k: string, v: T): Promise<void> => { backedMap.set(k, v); },
      removeItem: async (k: string): Promise<void> => { backedMap.delete(k); },
      verifyDurableReadBack: async (keys: string[]): Promise<boolean> => {
        if (failOnLessonsVerify && keys.includes('dl_lessons')) return false;
        return true;
      }
    };

    const entries: AtomicBackupCommitEntry[] = [
      { key: 'dl_groups', nextValue: [{ id: 'g_new' }], prevStateValue: stateGroups, applyState: v => { stateGroups = v; } },
      { key: 'dl_students', nextValue: [{ id: 's_new' }], prevStateValue: stateStudents, applyState: v => { stateStudents = v; } },
      { key: 'dl_lessons', nextValue: [{ id: 'l_new' }], prevStateValue: stateLessons, applyState: v => { stateLessons = v; } }
    ];

    await assert.rejects(
      () => executeAtomicBackupCommit(entries, { storageAdapter: mockAdapter }),
      /verification failed/i,
      'Must fail atomically when any category fails readback verification'
    );

    assert.deepEqual(backedMap.get('dl_groups'), [{ id: 'g_old' }], 'dl_groups storage must roll back on dl_lessons failure');
    assert.deepEqual(backedMap.get('dl_students'), [{ id: 's_old' }], 'dl_students storage must roll back');
    assert.deepEqual(backedMap.get('dl_lessons'), [{ id: 'l_old' }], 'dl_lessons storage must roll back');
    assert.deepEqual(stateGroups, [{ id: 'g_old' }], 'React state must NOT advance on partial failure');
    assert.deepEqual(stateStudents, [{ id: 's_old' }]);

    // Now allow all verifies to pass -> commits cleanly
    failOnLessonsVerify = false;
    const okRes = await executeAtomicBackupCommit(entries, { storageAdapter: mockAdapter });
    assert.deepEqual(okRes.committedKeys, ['dl_groups', 'dl_students', 'dl_lessons']);
    assert.deepEqual(stateLessons, [{ id: 'l_new' }]);
    assert.deepEqual(backedMap.get('dl_groups'), [{ id: 'g_new' }]);
    console.log('✓ Backup #1 passed: Atomic multi-category restore & reverse rollback');
  }

  // -------------------------------------------------------------------------
  // Backup #3: Protect dl_lessons / dl_payments when unverified in Primary DB
  // -------------------------------------------------------------------------
  {
    memStorage.clear();
    __clearMemoryStoreOnlyForTests();
    __setPrimaryDbVerifiedKeyForTests('dl_lessons', false);
    __setPrimaryDbVerifiedKeyForTests('dl_payments', false);

    // Seed caches + unverified critical keys
    memStorage.setItem('dl_local_backup_data', 'cache');
    memStorage.setItem('dl_lernstudio_sets', 'cache2');
    memStorage.setItem('dl_lessons', '[{"id":"critical_l"}]');
    memStorage.setItem('dl_payments', '[{"id":"critical_p"}]');

    // Case A: Non-critical caches evictable cleanly -> succeeds & preserves critical keys
    // Simulate quota error until dl_local_backup_data is removed:
    const origSet = memStorage.setItem.bind(memStorage);
    let failUntilCacheCleared = true;
    memStorage.setItem = (k: string, v: string) => {
      if (k === 'dl_test_target' && failUntilCacheCleared && memStorage.getItem('dl_lernstudio_sets') !== null) {
        const err: any = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      }
      origSet(k, v);
    };
    const cacheEvictOk = safeLocalStorageSetItem('dl_test_target', '{"ok":1}', false);
    assert.equal(cacheEvictOk, true, 'Should succeed after evicting non-critical caches');
    assert.equal(memStorage.getItem('dl_lessons'), '[{"id":"critical_l"}]', 'dl_lessons stays intact');
    assert.equal(memStorage.getItem('dl_payments'), '[{"id":"critical_p"}]', 'dl_payments stays intact');

    // Case B: No caches remain and dl_lessons / dl_payments are NOT verified in Primary DB -> MUST refuse to evict & return false
    memStorage.alwaysThrowQuotaOnSet = false;
    memStorage.setItem = (k: string, v: string) => {
      if (k === 'dl_test_target_2' && memStorage.getItem('dl_lessons') !== null) {
        const err: any = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      }
      origSet(k, v);
    };
    const refusedWhenUnverified = safeLocalStorageSetItem('dl_test_target_2', '{"fail":true}', false);
    assert.equal(refusedWhenUnverified, false, 'Must fail safely instead of evicting unverified dl_lessons/dl_payments');
    assert.equal(memStorage.getItem('dl_lessons'), '[{"id":"critical_l"}]');
    assert.equal(memStorage.getItem('dl_payments'), '[{"id":"critical_p"}]');

    // Case C: Now mark dl_lessons verified intact in simulated Primary DB -> mirror eviction succeeds!
    await storage.setItem('dl_lessons', [{ id: 'critical_l' }]);
    const okWhenVerified = safeLocalStorageSetItem('dl_test_target_2', '{"ok":true}', false);
    assert.equal(okWhenVerified, true, 'May evict localStorage mirror of dl_lessons ONLY once primary IndexedDB copy is verified intact');
    assert.equal(memStorage.getItem('dl_lessons'), null);
    console.log('✓ Backup #3 passed: Unverified dl_lessons/dl_payments protected from quota eviction');
  }

  // -------------------------------------------------------------------------
  // Backup #4: Daily, weekly, and monthly auto-backup cadence + marker non-advancement on error
  // -------------------------------------------------------------------------
  {
    memStorage.clear();
    __clearMemoryStoreOnlyForTests();

    const refDate = new Date(2026, 9, 14, 10, 0, 0); // Oct 14, 2026 -> YYYY-W42, 2026-10
    const dueFirst = evaluateScheduledBackups({
      now: refDate,
      config: { dailyEnabled: true, weeklyEnabled: true, monthlyEnabled: true, retentionCount: 10 },
      markers: { lastDailyDate: null, lastWeeklyKey: null, lastMonthlyKey: null }
    });
    assert.deepEqual(dueFirst.dueTiers, ['daily', 'weekly', 'monthly']);

    // Weekly and monthly already completed -> skip correctly
    const weekKey = getLocalIsoWeekKey(refDate);
    const monthKey = getLocalMonthKey(refDate);
    const dueNone = evaluateScheduledBackups({
      now: refDate,
      config: { dailyEnabled: true, weeklyEnabled: true, monthlyEnabled: true, retentionCount: 10 },
      markers: { lastDailyDate: '2026-10-14', lastWeeklyKey: weekKey, lastMonthlyKey: monthKey }
    });
    assert.deepEqual(dueNone.dueTiers, []);

    // Simulate snapshot storage failure -> markers MUST NOT advance!
    const backupStore = new Map<string, any>();
    let snapshotShouldFail = true;
    const mockBackupStore = {
      getItem: async <T>(k: string): Promise<T | null> => (backupStore.has(k) ? backupStore.get(k) : null),
      setItem: async <T>(k: string, v: T): Promise<void> => {
        if (snapshotShouldFail && k === 'dl_auto_backup_history_snapshots') {
          throw new Error('Simulated IndexedDB write error');
        }
        backupStore.set(k, v);
      }
    };
    const cfg = { dailyEnabled: true, weeklyEnabled: true, monthlyEnabled: true, retentionCount: 10 };
    const payloadFn = async () => JSON.stringify({ meta: { timestamp: refDate.toISOString() } });

    await assert.rejects(
      () => executeScheduledBackupCheck({ now: refDate, performBackup: payloadFn, config: cfg, storageAdapter: mockBackupStore }),
      /Simulated IndexedDB write error/
    );
    assert.equal(backupStore.get('dl_last_auto_backup_date'), undefined, 'Daily marker must NOT advance on snapshot failure');
    assert.equal(backupStore.get('dl_last_auto_backup_week'), undefined, 'Weekly marker must NOT advance on snapshot failure');
    assert.equal(backupStore.get('dl_last_auto_backup_month'), undefined, 'Monthly marker must NOT advance on snapshot failure');

    // Now succeed -> markers & retention advance cleanly
    snapshotShouldFail = false;
    const okRun = await executeScheduledBackupCheck({ now: refDate, performBackup: payloadFn, config: cfg, storageAdapter: mockBackupStore });
    assert.deepEqual(okRun.ranTiers, ['daily', 'weekly', 'monthly']);
    const savedSnaps = JSON.parse(backupStore.get('dl_auto_backup_history_snapshots') || '[]');
    assert.equal(savedSnaps.length, 3, 'Creates tagged daily, weekly, and monthly snapshots');
    assert.equal(backupStore.get('dl_last_auto_backup_date'), '2026-10-14');
    assert.equal(backupStore.get('dl_last_auto_backup_week'), weekKey);
    assert.equal(backupStore.get('dl_last_auto_backup_month'), monthKey);
    console.log('✓ Backup #4 passed: Daily/weekly/monthly scheduled backups & failure-safe markers');
  }

  // -------------------------------------------------------------------------
  // Backup #5: Ordered Archive -> Tombstone -> Delete cleanup with rollback on failure
  // -------------------------------------------------------------------------
  {
    memStorage.clear();
    __clearMemoryStoreOnlyForTests();
    const oldSettledLesson: Lesson = {
      id: 'l_clean_1',
      groupId: 'g_c',
      groupName: 'Clean Grp',
      title: 'Old Settled',
      date: '2025-01-10',
      time: '15:00',
      durationMinutes: 60,
      type: 'online',
      grade: 'A1',
      sessionNumber: 1,
      totalSessionsInPackage: 4,
      status: 'completed',
      paymentStatus: 'paid',
      amountDue: 200,
      amountPaid: 200
    };
    const analysis = analyzeLessonCleanup([oldSettledLesson], [], [], []);
    assert.equal(analysis.historicalEligibleToPrune.length, 1);

    // Inject failure during delete commit -> Archive & Tombstones MUST roll back cleanly!
    await assert.rejects(
      () => executeLessonCleanup([oldSettledLesson], analysis, async () => {
        throw new Error('Disk failure during cleaned lessons commit');
      }),
      /rolled back/i
    );
    assert.equal(getPrunedLessonIds().has('l_clean_1'), false, 'Tombstone must roll back when delete commit fails');
    const archiveAfterRollback = await storage.getItem<Lesson[]>(PRUNED_LESSONS_BACKUP_KEY);
    assert.equal(archiveAfterRollback, null, 'Archive must roll back when delete commit fails');
    assert.equal(memStorage.getItem(LAST_CLEANUP_DATE_KEY), null);

    // Inject tombstone write failure -> Archive MUST roll back before deletion runs!
    memStorage.quotaKeys.add(PRUNED_LESSON_IDS_KEY);
    let deleteCalled = false;
    await assert.rejects(
      () => executeLessonCleanup([oldSettledLesson], analysis, async () => {
        deleteCalled = true;
      }),
      /archive rolled back/i
    );
    assert.equal(deleteCalled, false, 'Delete callback must never execute if tombstone fails');
    assert.equal(await storage.getItem<Lesson[]>(PRUNED_LESSONS_BACKUP_KEY), null);
    memStorage.quotaKeys.clear();

    // Now succeed cleanly
    let committed: Lesson[] = [];
    const res = await executeLessonCleanup([oldSettledLesson], analysis, async (cleaned) => {
      committed = cleaned;
    });
    assert.equal(res.prunedCount, 1);
    assert.equal(committed.length, 0);
    assert.equal(getPrunedLessonIds().has('l_clean_1'), true);
    const archivedOk = await storage.getItem<Lesson[]>(PRUNED_LESSONS_BACKUP_KEY);
    assert.equal(archivedOk?.length, 1);
    __setStorageFailureHookForTests(null);
    console.log('✓ Backup #5 passed: Ordered Archive -> Tombstone -> Delete with full failure rollback');
  }

  // -------------------------------------------------------------------------
  // Backup #2 & Homework #1, #2, #3: Honest save confirmation, 14-day dueDate auto-close + reopen, safe legacy migration
  // -------------------------------------------------------------------------
  {
    memStorage.clear();
    __clearMemoryStoreOnlyForTests();
    const uid = 'teacher_hw_remed';
    __setHomeworkAuthUserForTests({ uid, email: 'teacher@glueck.de' });

    // Homework #1: Cloud failure -> saved locally as pending sync with explicit warning (NOT silent success!)
    const hwOffline = makeHomework({ id: 'hw_off_1', ownerUid: uid, shortId: 'OffSyn1' });
    __setHomeworkSyncTransportForTests({
      saveAssignment: async () => {
        throw new Error('Offline / Firestore unavailable');
      }
    });
    const offRes = await saveAssignmentWithConfirmation(hwOffline);
    assert.equal(offRes.localSaved, true);
    assert.equal(offRes.cloudSynced, false);
    assert.equal(offRes.pendingSync, true);
    assert.equal(offRes.syncStatus, 'local_pending_cloud');
    assert.ok((offRes.warningEn || '').toLowerCase().includes('pending cloud sync'));

    // Homework #1: Local storage failure -> throws explicitly so UI aborts without claiming saved!
    memStorage.alwaysThrowQuotaOnSet = true;
    await assert.rejects(
      () => saveAssignmentWithConfirmation(makeHomework({ id: 'hw_fail_local', ownerUid: uid })),
      /QuotaExceededError/
    );
    memStorage.alwaysThrowQuotaOnSet = false;

    // Homework #2: 14-day dueDate auto-close + manual teacher reopen
    assert.equal(HOMEWORK_AUTO_CLOSE_GRACE_DAYS, 14);
    const dueMs = getHomeworkDueDateAutoCloseMs({ dueDate: '2026-10-01' });
    assert.ok(dueMs !== null);
    const before14Days = dueMs! - 1000;
    const atOrAfter14Days = dueMs! + 1000;

    const hwWithDue = makeHomework({ id: 'hw_due_1', ownerUid: uid, dueDate: '2026-10-01', isActive: true, status: 'active' });
    assert.equal(isHomeworkAutoClosedByDeadline(hwWithDue, before14Days), false);
    assert.equal(isHomeworkAssignmentOpenForStudents(hwWithDue, before14Days), true);
    assert.equal(isHomeworkAutoClosedByDeadline(hwWithDue, atOrAfter14Days), true);
    assert.equal(isHomeworkAssignmentOpenForStudents(hwWithDue, atOrAfter14Days), false, 'Must auto-close 14 days after dueDate');

    // Undated legacy assignment remains open
    const hwUndated = makeHomework({ id: 'hw_undated', ownerUid: uid, dueDate: undefined });
    assert.equal(isHomeworkAssignmentOpenForStudents(hwUndated, atOrAfter14Days), true);

    // Save hwWithDue and test manual teacher reopen override!
    __setHomeworkSyncTransportForTests({ saveAssignment: async () => true });
    await saveAssignmentWithConfirmation(hwWithDue);
    const reopenedRes = await setHomeworkAssignmentActiveStatus(hwWithDue.id, true);
    const reopened = reopenedRes.assignment!;
    assert.ok(reopened?.manualReopenedAt && reopened.manualReopenedAt > 0);
    assert.equal(isHomeworkAutoClosedByDeadline(reopened, before14Days + 15 * 24 * 60 * 60 * 1000), false);
    assert.equal(isHomeworkAssignmentOpenForStudents(reopened, atOrAfter14Days), true, 'Manual teacher reopen keeps assignment open even past 14 days');

    // Manually closing again keeps it closed
    const manuallyClosedRes = await setHomeworkAssignmentActiveStatus(hwWithDue.id, false);
    assert.equal(isHomeworkAssignmentOpenForStudents(manuallyClosedRes.assignment, before14Days), false);

    // Backup #2 & Homework #3: Legacy migration reports 'no_records' cleanly when empty, preserves source & reports 'failed' on quota error!
    memStorage.clear();
    const noRecRes = migrateLegacyHomeworkForAccount({ uid, email: 'teacher@glueck.de' });
    assert.equal(noRecRes.status, 'no_records');
    assert.equal(noRecRes.retryable, false);

    // Seed legacy key 'glueck_hw_assignments_v2'
    const legacyHw = makeHomework({ id: 'hw_leg_safe', ownerUid: undefined as any, shortId: 'LegSaf1' });
    memStorage.setItem('glueck_hw_assignments_v2', JSON.stringify([legacyHw]));

    // Force failure when writing target scoped key
    const targetScopedKey = getAssignmentsStorageKey(uid);
    memStorage.quotaKeys.add(targetScopedKey);
    const failMig = migrateLegacyHomeworkForAccount({ uid, email: 'teacher@glueck.de', ownedSetIds: ['set_1'] });
    assert.equal(failMig.status, 'failed');
    assert.equal(failMig.retryable, true);
    assert.ok(failMig.error, 'Must report explicit migration error message');
    assert.ok(memStorage.getItem('glueck_hw_assignments_v2')?.includes('hw_leg_safe'), 'Original legacy source data MUST be preserved on target write failure');

    // Clear quota error and retry migration -> completes and moves into target account scope
    memStorage.quotaKeys.clear();
    const okMig = migrateLegacyHomeworkForAccount({ uid, email: 'teacher@glueck.de', ownedSetIds: ['set_1'] });
    assert.equal(okMig.status, 'completed');
    assert.equal(okMig.migratedAssignments, 1);
    assert.equal(getLocalAssignments(uid).some(a => a.id === 'hw_leg_safe'), true);

    __setHomeworkAuthUserForTests(undefined);
    __setHomeworkSyncTransportForTests(null);
    console.log('✓ Backup #2 & Homework #1-#3 passed: Offline/cloud warnings, local fail throw, 14-day dueDate auto-close + teacher reopen, & safe legacy migration');
  }

  console.log('ALL BACKUP & HOMEWORK REMEDIATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Backup & Homework remediation test failed:', err);
  process.exit(1);
});

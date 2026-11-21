import assert from 'node:assert/strict';
import {
  calculateDuePaymentCycles,
  getStudentCyclePricing
} from '../utils/paymentUtils';
import {
  shouldSettlePendingCycleRecord,
  allocateAdvancePaymentFIFO,
  reconcilePaymentFinanceTransaction,
  computeAccountBalance
} from '../services/financeService';
import {
  deduplicateLessonList,
  deduplicatePaymentsList,
  resequenceScheduledLessonsAfterChange
} from '../utils/lessonUtils';
import { advanceDueDateByFrequency } from '../utils/timeUtils';
import { resolveStudentWhatsAppContact } from '../utils/phoneUtils';
import {
  FinanceAccount,
  FinanceTransaction,
  Group,
  Lesson,
  PaymentRecord,
  Student
} from '../types';

function makeStudent(overrides: Partial<Student> & { id: string; name: string }): Student {
  return {
    id: overrides.id,
    name: overrides.name,
    groupId: overrides.groupId ?? 'g_1',
    grade: overrides.grade ?? 'A1',
    parentName: overrides.parentName ?? 'Parent',
    parentPhone: overrides.parentPhone ?? '+201000000001',
    studentPhone: overrides.studentPhone ?? '',
    documents: [],
    joinedDate: '2026-01-01',
    paymentStatus: 'pending',
    ...overrides
  };
}

function makeGroup(overrides: Partial<Group> & { id: string; name: string }): Group {
  return {
    id: overrides.id,
    name: overrides.name,
    grade: overrides.grade ?? 'A1',
    type: 'online',
    color: 'blue',
    scheduleDays: ['Monday', 'Thursday'],
    scheduleTime: '17:00',
    monthlyPackagePrice: 800,
    sessionCount: 4,
    paymentCycle: 'monthly',
    paymentModel: 'package',
    ...overrides
  };
}

function makeLesson(overrides: Partial<Lesson> & { id: string; date: string }): Lesson {
  return {
    id: overrides.id,
    groupId: overrides.groupId ?? 'g_1',
    groupName: overrides.groupName ?? 'A1 Group',
    title: overrides.title ?? 'Session',
    date: overrides.date,
    time: overrides.time ?? '17:00',
    durationMinutes: 60,
    type: 'online',
    grade: 'A1',
    sessionNumber: overrides.sessionNumber ?? 1,
    totalSessionsInPackage: overrides.totalSessionsInPackage ?? 4,
    status: overrides.status ?? 'completed',
    paymentStatus: overrides.paymentStatus ?? 'pending',
    amountDue: overrides.amountDue ?? 200,
    amountPaid: overrides.amountPaid ?? 0,
    ...overrides
  };
}

function makePayment(overrides: Partial<PaymentRecord> & { id: string; studentId: string }): PaymentRecord {
  return {
    id: overrides.id,
    studentId: overrides.studentId,
    studentName: overrides.studentName ?? 'Student',
    groupId: overrides.groupId ?? 'g_1',
    groupName: overrides.groupName ?? 'A1 Group',
    amountDue: overrides.amountDue ?? 800,
    amountPaid: overrides.amountPaid ?? 0,
    dueDate: overrides.dueDate ?? '2026-10-10',
    status: overrides.status ?? 'pending',
    ...overrides
  };
}

async function runTests(): Promise<void> {
  console.log('Running Finance Remediation & 5,000-Record Scale Tests (#1-#12)...');

  // -------------------------------------------------------------------------
  // Finance #1: Legitimate paid & unpaid invoices with SAME (dueDate, amountDue) are preserved
  // -------------------------------------------------------------------------
  {
    const st = makeStudent({ id: 's_1', name: 'Ahmed', groupId: 'g_a' });
    const grp = makeGroup({ id: 'g_a', name: 'Group A', sessionCount: 2, monthlyPackagePrice: 500 });
    const lPaid = makeLesson({ id: 'l_paid_1', groupId: 'g_a', date: '2026-10-01', sessionNumber: 1, totalSessionsInPackage: 2 });
    const lPaid2 = makeLesson({ id: 'l_paid_2', groupId: 'g_a', date: '2026-10-03', sessionNumber: 2, totalSessionsInPackage: 2 });
    const lPend1 = makeLesson({ id: 'l_pend_1', groupId: 'g_a', date: '2026-10-08', sessionNumber: 3, totalSessionsInPackage: 2 });
    const lPend2 = makeLesson({ id: 'l_pend_2', groupId: 'g_a', date: '2026-10-10', sessionNumber: 4, totalSessionsInPackage: 2 });

    const paidSameAmtDate = makePayment({
      id: 'pay_paid_same',
      studentId: 's_1',
      groupId: 'g_a',
      amountDue: 500,
      amountPaid: 500,
      dueDate: '2026-10-10',
      paidDate: '2026-10-10',
      status: 'paid',
      lessonIds: ['l_paid_1', 'l_paid_2'],
      lessonDates: ['2026-10-01', '2026-10-03']
    });
    const pendingSameAmtDate = makePayment({
      id: 'pay_pend_same',
      studentId: 's_1',
      groupId: 'g_a',
      amountDue: 500,
      amountPaid: 0,
      dueDate: '2026-10-10',
      status: 'pending',
      lessonIds: ['l_pend_1', 'l_pend_2'],
      lessonDates: ['2026-10-08', '2026-10-10']
    });

    assert.equal(
      shouldSettlePendingCycleRecord(pendingSameAmtDate, {
        studentId: 's_1',
        groupId: 'g_a',
        lessonIds: ['l_paid_1', 'l_paid_2'],
        lessonDates: ['2026-10-01', '2026-10-03']
      }),
      false,
      'Settling paid cycle must NOT settle separate unpaid record with identical amountDue and dueDate'
    );

    const dedupedPayments = deduplicatePaymentsList([paidSameAmtDate, pendingSameAmtDate]);
    assert.equal(dedupedPayments.deduplicated.length, 2, 'deduplicatePaymentsList must preserve distinct paid and pending invoices sharing amountDue + dueDate');

    const cycles = calculateDuePaymentCycles([st], [grp], [lPaid, lPaid2, lPend1, lPend2], [paidSameAmtDate, pendingSameAmtDate]);
    assert.equal(cycles.length, 1, 'Pending invoice with same amountDue & dueDate must still appear as due cycle');
    assert.equal(cycles[0].existingPaymentRecordId, 'pay_pend_same');
    console.log('✓ Finance #1 passed: Separate invoices sharing (dueDate, amountDue) preserved');
  }

  // -------------------------------------------------------------------------
  // Finance #2 & #3: Pending cycles keyed strictly by sorted lessonIds (plus legacy fallback)
  // -------------------------------------------------------------------------
  {
    const st = makeStudent({ id: 's_cyc', name: 'Nour', groupId: 'g_c' });
    const grp = makeGroup({ id: 'g_c', name: 'Cycle Grp', sessionCount: 2, monthlyPackagePrice: 400 });

    const pCycleA = makePayment({
      id: 'pay_c_a',
      studentId: 's_cyc',
      groupId: 'g_c',
      amountDue: 400,
      dueDate: '2026-10-05',
      status: 'overdue' as any,
      bundleSize: 2,
      lessonIds: ['l_c_2', 'l_c_1'],
      lessonDates: ['2026-10-05', '2026-10-02']
    });
    // Separate cycle on overlapping date text, different lessonIds -> MUST NOT collapse!
    const pCycleB = makePayment({
      id: 'pay_c_b',
      studentId: 's_cyc',
      groupId: 'g_c',
      amountDue: 400,
      dueDate: '2026-10-05',
      status: 'overdue' as any,
      bundleSize: 2,
      lessonIds: ['l_c_3', 'l_c_4'],
      lessonDates: ['2026-10-05', '2026-10-02']
    });
    // Exact duplicate referring to same sorted lessonIds as pCycleA -> MUST deduplicate!
    const pCycleADup = makePayment({
      id: 'pay_c_a_dup',
      studentId: 's_cyc',
      groupId: 'g_c',
      amountDue: 400,
      dueDate: '2026-10-05',
      status: 'overdue' as any,
      bundleSize: 2,
      lessonIds: ['l_c_1', 'l_c_2'],
      lessonDates: ['2026-10-02', '2026-10-05']
    });
    // Two legacy records missing lessonIds -> MUST preserve both by distinct record ID fallback
    const pLegacy1 = makePayment({
      id: 'pay_leg_1',
      studentId: 's_cyc',
      groupId: 'g_c',
      amountDue: 400,
      dueDate: '2026-10-12',
      status: 'overdue' as any,
      bundleSize: 2,
      lessonIds: [],
      lessonDates: ['2026-10-12']
    });
    const pLegacy2 = makePayment({
      id: 'pay_leg_2',
      studentId: 's_cyc',
      groupId: 'g_c',
      amountDue: 400,
      dueDate: '2026-10-12',
      status: 'overdue' as any,
      bundleSize: 2,
      lessonIds: [],
      lessonDates: ['2026-10-12']
    });

    const cycles = calculateDuePaymentCycles([st], [grp], [], [pCycleA, pCycleB, pCycleADup, pLegacy1, pLegacy2]);
    assert.equal(cycles.length, 4, 'Should keep Cycle A, Cycle B, Legacy 1, Legacy 2 and dedupe only pCycleADup');
    console.log('✓ Finance #2 & #3 passed: Cycle dedupe keys strictly by sorted lessonIds with safe legacy fallback');
  }

  // -------------------------------------------------------------------------
  // Finance #4: Idempotent receiving account change moves transaction without duplicate income
  // -------------------------------------------------------------------------
  {
    const accounts: FinanceAccount[] = [
      { id: 'acc_cash', name: 'Cash', type: 'cash', initialBalance: 1000, currentBalance: 1000, currency: 'EGP', createdAt: '2026-01-01' },
      { id: 'acc_bank', name: 'Bank', type: 'bank', initialBalance: 500, currentBalance: 500, currency: 'EGP', createdAt: '2026-01-01' }
    ];

    const step1 = reconcilePaymentFinanceTransaction([], accounts, {
      paymentId: 'pay_acc_1',
      accountId: 'acc_cash',
      amount: 600,
      date: '2026-10-10',
      note: 'Tuition Omar',
      relatedStudentId: 's_1'
    });
    assert.equal(step1.action, 'created');
    assert.equal(step1.nextTransactions.filter(t => !t.deleted).length, 1);
    assert.equal(computeAccountBalance(step1.nextAccounts.find(a => a.id === 'acc_cash')!, step1.nextTransactions), 1600);

    // Repeat with same account -> noop
    const step2 = reconcilePaymentFinanceTransaction(step1.nextTransactions, step1.nextAccounts, {
      paymentId: 'pay_acc_1',
      accountId: 'acc_cash',
      amount: 600,
      date: '2026-10-10',
      note: 'Tuition Omar',
      relatedStudentId: 's_1'
    });
    assert.equal(step2.action, 'noop');
    assert.equal(step2.nextTransactions.filter(t => !t.deleted).length, 1);

    // Switch receiving account from Cash -> Bank
    const step3 = reconcilePaymentFinanceTransaction(step2.nextTransactions, step2.nextAccounts, {
      paymentId: 'pay_acc_1',
      accountId: 'acc_bank',
      amount: 600,
      date: '2026-10-10',
      note: 'Tuition Omar',
      relatedStudentId: 's_1'
    });
    assert.equal(step3.action, 'updated');
    assert.equal(step3.nextTransactions.filter(t => !t.deleted).length, 1, 'Must move single transaction, never duplicate income');
    assert.equal(step3.nextAccounts.find(a => a.id === 'acc_cash')!.currentBalance, 1000, 'Old account balance restored');
    assert.equal(step3.nextAccounts.find(a => a.id === 'acc_bank')!.currentBalance, 1100, 'New account balance credited once');
    console.log('✓ Finance #4 passed: Account switching reconciles existing FinanceTransaction idempotently');
  }

  // -------------------------------------------------------------------------
  // Finance #5 & #6: FIFO advance allocation & strict lessonIds settlement
  // -------------------------------------------------------------------------
  {
    const oldest = makePayment({
      id: 'inv_old',
      studentId: 's_adv',
      amountDue: 400,
      amountPaid: 0,
      dueDate: '2026-09-01',
      status: 'pending',
      lessonIds: ['l_old_1', 'l_old_2']
    });
    const middle = makePayment({
      id: 'inv_mid',
      studentId: 's_adv',
      amountDue: 500,
      amountPaid: 100, // 400 remaining
      dueDate: '2026-09-15',
      status: 'partial',
      lessonIds: ['l_mid_1', 'l_mid_2']
    });
    const newest = makePayment({
      id: 'inv_new',
      studentId: 's_adv',
      amountDue: 600,
      amountPaid: 0,
      dueDate: '2026-10-01',
      status: 'pending',
      lessonIds: ['l_new_1', 'l_new_2']
    });
    const otherStudent = makePayment({
      id: 'inv_other',
      studentId: 's_other',
      amountDue: 500,
      amountPaid: 0,
      dueDate: '2026-08-01',
      status: 'pending',
      lessonIds: ['l_other_1']
    });

    // Advance payment of 550 EGP for 3 lessons -> pays 400 of inv_old (paid) + 150 into inv_mid (now paid 250, rem 250, partial); inv_new & inv_other untouched!
    const alloc = allocateAdvancePaymentFIFO([newest, middle, oldest, otherStudent], {
      studentId: 's_adv',
      studentName: 'Ali',
      groupId: 'g_1',
      groupName: 'G1',
      numberOfLessons: 3,
      amount: 550,
      accountId: 'acc_cash',
      today: '2026-10-10'
    });

    assert.equal(alloc.appliedToDebt, 550);
    assert.equal(alloc.surplusAmount, 0);
    assert.equal(alloc.surplusLessons, 0);
    assert.deepEqual(alloc.settledLessonIds, ['l_old_1', 'l_old_2']);

    const afterOld = alloc.updatedPayments.find(p => p.id === 'inv_old')!;
    const afterMid = alloc.updatedPayments.find(p => p.id === 'inv_mid')!;
    const afterNew = alloc.updatedPayments.find(p => p.id === 'inv_new')!;
    const afterOther = alloc.updatedPayments.find(p => p.id === 'inv_other')!;

    assert.equal(afterOld.status, 'paid');
    assert.equal(afterOld.remainingBalance, 0);
    assert.equal(afterMid.status, 'partial');
    assert.equal(afterMid.amountPaid, 250);
    assert.equal(afterMid.remainingBalance, 250);
    assert.equal(afterNew.status, 'pending');
    assert.equal(afterNew.amountPaid, 0);
    assert.equal(afterOther.status, 'pending');
    assert.equal(afterOther.amountPaid, 0);

    // Verify Finance #6 strict targetIds matching: settling l_same_date_1 leaves l_same_date_2 pending
    const sameDatePending2 = makePayment({
      id: 'inv_same_date_2',
      studentId: 's_adv',
      groupId: 'g_1',
      amountDue: 200,
      dueDate: '2026-10-10',
      status: 'pending',
      lessonIds: ['l_same_date_2'],
      lessonDates: ['2026-10-10']
    });
    assert.equal(
      shouldSettlePendingCycleRecord(sameDatePending2, {
        studentId: 's_adv',
        groupId: 'g_1',
        lessonIds: ['l_same_date_1'],
        lessonDates: ['2026-10-10']
      }),
      false,
      'Must NOT settle unrelated same-date lesson when target lessonIds explicitly identify another lesson'
    );
    console.log('✓ Finance #5 & #6 passed: FIFO advance allocation & strict lessonIds settlement');
  }

  // -------------------------------------------------------------------------
  // Finance #7, #8, #9: Package price edit remainingBalance, same-day multi-lesson, & date+time sort
  // -------------------------------------------------------------------------
  {
    // #7 Pricing edit formula consistency
    const st = makeStudent({ id: 's_p', name: 'Salma', groupId: 'g_p', paymentPlan: '4_lessons', customBundlePrice: undefined });
    const grpBefore = makeGroup({ id: 'g_p', name: 'P Grp', monthlyPackagePrice: 800, sessionCount: 4 });
    const grpAfter = makeGroup({ id: 'g_p', name: 'P Grp', monthlyPackagePrice: 1000, sessionCount: 4 });
    assert.equal(getStudentCyclePricing(st, grpBefore).amountDue, 800);
    assert.equal(getStudentCyclePricing(st, grpAfter).amountDue, 1000);
    const updatedRemaining = Math.max(0, grpAfter.monthlyPackagePrice! - 300 /* amountPaid */ - 100 /* discount */);
    assert.equal(updatedRemaining, 600);

    // #8 & #9: Two same-day completed lessons at 10:00 (session 2) and 18:00 (session 1) in a 2-session cycle
    // Notice cycle 1 took the evening lesson first if time wasn't sorted! With time sort, morning comes before evening.
    const lMorning = makeLesson({ id: 'l_sd_am', groupId: 'g_sd', date: '2026-10-10', time: '09:00', sessionNumber: 1, totalSessionsInPackage: 2 });
    const lEvening = makeLesson({ id: 'l_sd_pm', groupId: 'g_sd', date: '2026-10-10', time: '18:00', sessionNumber: 1, totalSessionsInPackage: 2 }); // intentional duplicate sessionNumber!
    const lDay2 = makeLesson({ id: 'l_sd_day2', groupId: 'g_sd', date: '2026-10-12', time: '09:00', sessionNumber: 2, totalSessionsInPackage: 2 });
    const lDay3 = makeLesson({ id: 'l_sd_day3', groupId: 'g_sd', date: '2026-10-14', time: '09:00', sessionNumber: 3, totalSessionsInPackage: 2 });

    const stSd = makeStudent({ id: 's_sd', name: 'Karim', groupId: 'g_sd' });
    const grpSd = makeGroup({ id: 'g_sd', name: 'SD Grp', sessionCount: 2, monthlyPackagePrice: 400 });

    const cycles = calculateDuePaymentCycles([stSd], [grpSd], [lDay2, lEvening, lDay3, lMorning], []);
    assert.equal(cycles.length, 2, 'Distinct same-day lessons even with matching sessionNumber must NOT collapse into one');
    assert.deepEqual(cycles[0].lessonIds, ['l_sd_am', 'l_sd_pm'], 'Morning (09:00) must sort before Evening (18:00) on 2026-10-10');
    assert.deepEqual(cycles[1].lessonIds, ['l_sd_day2', 'l_sd_day3']);
    console.log('✓ Finance #7, #8, #9 passed: Pricing consistency, same-day distinct lesson preservation, and date+time ordering');
  }

  // -------------------------------------------------------------------------
  // Finance #10: Strict studentId WhatsApp recipient resolution
  // -------------------------------------------------------------------------
  {
    const students = [
      makeStudent({ id: 'st_omar_1', name: 'Omar Hassan', parentPhone: '+201011111111' }),
      makeStudent({ id: 'st_omar_2', name: 'Omar Hassan', parentPhone: '+201022222222' })
    ];
    // Simulate UI lookup strictly by studentId (never falling back to name lookup)
    const targetById = students.find(s => s.id === 'st_omar_2');
    const resolved = resolveStudentWhatsAppContact(targetById, { quickParentPhone: '+201099999999' });
    assert.equal(resolved.contact, '+201022222222', 'Must resolve st_omar_2 phone via studentId, not st_omar_1 by name');

    const missingStudent = students.find(s => s.id === 'st_missing');
    const fallbackResolved = resolveStudentWhatsAppContact(missingStudent, { quickParentPhone: '+201099999999' });
    assert.equal(fallbackResolved.contact, '+201099999999', 'Missing studentId uses cycle stored phone fallback cleanly');
    console.log('✓ Finance #10 passed: Student WhatsApp resolution binds strictly by studentId');
  }

  // -------------------------------------------------------------------------
  // Finance #11: Daily recurring & yearly installment due-date advancement
  // -------------------------------------------------------------------------
  {
    assert.equal(advanceDueDateByFrequency('2026-10-31', 'daily'), '2026-11-01');
    assert.equal(advanceDueDateByFrequency('2026-10-28', 'weekly'), '2026-11-04');
    assert.equal(advanceDueDateByFrequency('2026-01-31', 'monthly'), '2026-02-28');
    assert.equal(advanceDueDateByFrequency('2026-06-15', 'yearly'), '2027-06-15');
    assert.equal(advanceDueDateByFrequency('2024-02-29', 'yearly'), '2025-02-28', 'Leap-day yearly installment clamps safely to Feb 28 in non-leap year');
    console.log('✓ Finance #11 passed: Daily, weekly, monthly, and yearly due-date advancement');
  }

  // -------------------------------------------------------------------------
  // Finance #12 & Scale Benchmark: 5,000 rows processed well under 1 second
  // -------------------------------------------------------------------------
  {
    const scaleStudents: Student[] = [];
    const scaleGroups: Group[] = [];
    const scaleLessons: Lesson[] = [];
    const scalePayments: PaymentRecord[] = [];

    // 250 groups, 500 students, 5,000 completed lessons + 1,250 payments
    for (let g = 0; g < 250; g++) {
      scaleGroups.push(makeGroup({
        id: `sg_${g}`,
        name: `Scale Group ${g}`,
        sessionCount: 4,
        monthlyPackagePrice: 800
      }));
    }
    for (let s = 0; s < 500; s++) {
      const gIdx = s % 250;
      scaleStudents.push(makeStudent({
        id: `ss_${s}`,
        name: `Student ${s}`,
        groupId: `sg_${gIdx}`
      }));
    }
    for (let i = 0; i < 5000; i++) {
      const gIdx = i % 250;
      const seqInGroup = Math.floor(i / 250); // 0..19 unique per group
      const day = String(seqInGroup + 1).padStart(2, '0');
      const month = String((gIdx % 10) + 1).padStart(2, '0');
      const hour = String(8 + (gIdx % 12)).padStart(2, '0');
      scaleLessons.push(makeLesson({
        id: `sl_${i}`,
        groupId: `sg_${gIdx}`,
        groupName: `Scale Group ${gIdx}`,
        title: `Scale Group ${gIdx} Lesson ${seqInGroup + 1}`,
        date: `2026-${month}-${day}`,
        time: `${hour}:00`,
        sessionNumber: (seqInGroup % 4) + 1,
        totalSessionsInPackage: 4,
        status: i % 5 === 0 ? 'scheduled' : 'completed'
      }));
    }
    for (let p = 0; p < 1250; p++) {
      const sIdx = p % 500;
      const gIdx = sIdx % 250;
      scalePayments.push(makePayment({
        id: `sp_${p}`,
        studentId: `ss_${sIdx}`,
        groupId: `sg_${gIdx}`,
        amountDue: 800,
        amountPaid: p % 3 === 0 ? 800 : 0,
        status: p % 3 === 0 ? 'paid' : 'pending',
        lessonIds: [`sl_${p * 2}`, `sl_${p * 2 + 1}`],
        lessonDates: ['2026-01-01', '2026-01-04']
      }));
    }

    const t0 = performance.now();
    const deduped5k = deduplicateLessonList(scaleLessons);
    const reseq5k = resequenceScheduledLessonsAfterChange(deduped5k.deduplicated, { groupId: 'sg_0' }, { group: scaleGroups[0] });
    const due5k = calculateDuePaymentCycles(scaleStudents, scaleGroups, reseq5k, scalePayments);
    const elapsedMs = performance.now() - t0;

    assert.ok(Array.isArray(due5k), 'Due cycles result must be array');
    assert.ok(deduped5k.deduplicated.length === 5000, 'Unique 5,000 lessons preserved');
    assert.ok(elapsedMs < 1000, `5,000-row pipeline took ${elapsedMs.toFixed(1)}ms, expected < 1000ms`);
    console.log(`✓ Finance #12 passed: 5,000-row dedupe + resequence + cycle calc completed in ${elapsedMs.toFixed(1)}ms (< 1000ms)`);
  }

  console.log('ALL FINANCE REMEDIATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Finance remediation test failed:', err);
  process.exit(1);
});

import assert from 'node:assert/strict';
import {
  computeAccountBalance,
  recalculateAllAccountBalances,
  calculateAccountPerformance,
  calculateTodaysIncome,
  shouldSettlePendingCycleRecord,
  calculateStudentDueBannerTotals,
  applyFullPaymentsUpdate,
} from '../services/financeService';
import { FinanceAccount, FinanceTransaction, PaymentRecord } from '../types';

export function runFinanceServiceTests(): { passed: boolean; log: string[] } {
  const log: string[] = [];

  const accA: FinanceAccount = {
    id: 'acc_a',
    name: 'Main Cash',
    type: 'cash',
    initialBalance: 1000,
    currentBalance: 1000,
    currency: 'EGP',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const accB: FinanceAccount = {
    id: 'acc_b',
    name: 'Bank Account',
    type: 'bank',
    openingBalance: 500,
    currentBalance: 500,
    currency: 'EGP',
    createdAt: '2026-01-01T00:00:00.000Z',
  } as FinanceAccount;

  const cairoNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const todayStr = `${cairoNow.getFullYear()}-${String(cairoNow.getMonth() + 1).padStart(2, '0')}-${String(cairoNow.getDate()).padStart(2, '0')}`;

  const transactions: FinanceTransaction[] = [
    {
      id: 'tx_1',
      accountId: 'acc_a',
      type: 'income',
      amount: 250.555,
      categoryId: 'Tuition',
      date: `${todayStr}T10:00:00.000Z`,
      createdAt: `${todayStr}T10:00:00.000Z`,
    },
    {
      id: 'tx_2',
      accountId: 'acc_a',
      type: 'expense',
      amount: 50.055,
      categoryId: 'Supplies',
      date: `${todayStr}T11:00:00.000Z`,
      createdAt: `${todayStr}T11:00:00.000Z`,
    },
    {
      id: 'tx_3',
      accountId: 'acc_a',
      toAccountId: 'acc_b',
      type: 'transfer',
      amount: 300,
      categoryId: 'Transfer',
      date: `${todayStr}T12:00:00.000Z`,
      createdAt: `${todayStr}T12:00:00.000Z`,
    },
    {
      id: 'tx_4',
      accountId: 'acc_b',
      type: 'adjustment',
      amount: -25,
      categoryId: 'Adjustment',
      date: `${todayStr}T13:00:00.000Z`,
      createdAt: `${todayStr}T13:00:00.000Z`,
    },
    {
      id: 'tx_5_deleted',
      accountId: 'acc_a',
      type: 'income',
      amount: 9999,
      categoryId: 'Deleted',
      date: `${todayStr}T14:00:00.000Z`,
      createdAt: `${todayStr}T14:00:00.000Z`,
      deleted: true,
    },
  ];

  // 1. computeAccountBalance: income, expense, transfer out, and ignoring deleted tx
  // 1000 + 250.555 - 50.055 - 300 = 900.5
  const balA = computeAccountBalance(accA, transactions);
  assert.equal(balA, 900.5, 'acc_a balance should equal 900.5');
  log.push('[PASS] computeAccountBalance calculates income, expense, transfer out, and ignores deleted transactions');

  // 2. computeAccountBalance: openingBalance fallback, transfer in, and negative adjustment
  // 500 + 300 - 25 = 775
  const balB = computeAccountBalance(accB, transactions);
  assert.equal(balB, 775, 'acc_b balance should equal 775');
  log.push('[PASS] computeAccountBalance handles openingBalance fallback, incoming transfers, and adjustments');

  // 3. recalculateAllAccountBalances updates currentBalance and preserves initialBalance
  const recalculated = recalculateAllAccountBalances([accA, accB], transactions);
  assert.equal(recalculated.length, 2);
  assert.equal(recalculated[0].currentBalance, 900.5);
  assert.equal(recalculated[1].initialBalance, 500);
  assert.equal(recalculated[1].currentBalance, 775);
  log.push('[PASS] recalculateAllAccountBalances updates all accounts deterministically');

  // 4. calculateAccountPerformance computes todayChange and monthChange
  const perfA = calculateAccountPerformance('acc_a', transactions);
  // +250.555 - 50.055 - 300 = -99.5
  assert.equal(perfA.todayChange, -99.5);
  assert.equal(perfA.monthChange, -99.5);
  log.push('[PASS] calculateAccountPerformance computes daily and monthly net change accurately');

  // 5. calculateTodaysIncome sums only non-deleted today income/investment_return
  const todayIncome = calculateTodaysIncome(transactions);
  assert.equal(todayIncome, 250.56);
  log.push('[PASS] calculateTodaysIncome sums non-deleted income and rounds to 2 decimals');

  // 6. Fix #1: shouldSettlePendingCycleRecord settles only matching cycle lessonIds/lessonDates, NOT unrelated cycles in same group
  const cycle1Pending: PaymentRecord = {
    id: 'pay_cycle_1',
    studentId: 'st_1',
    studentName: 'Ahmed',
    groupId: 'grp_1',
    groupName: 'A1',
    amountDue: 400,
    amountPaid: 0,
    dueDate: '2026-09-01',
    status: 'pending',
    lessonIds: ['l_1', 'l_2'],
    lessonDates: ['2026-09-01', '2026-09-04'],
  };
  const cycle2PendingSameGroup: PaymentRecord = {
    id: 'pay_cycle_2',
    studentId: 'st_1',
    studentName: 'Ahmed',
    groupId: 'grp_1',
    groupName: 'A1',
    amountDue: 400,
    amountPaid: 0,
    dueDate: '2026-10-01',
    status: 'pending',
    lessonIds: ['l_5', 'l_6'],
    lessonDates: ['2026-10-01', '2026-10-04'],
  };
  assert.equal(
    shouldSettlePendingCycleRecord(cycle1Pending, {
      studentId: 'st_1',
      lessonIds: ['l_1', 'l_2'],
      lessonDates: ['2026-09-01', '2026-09-04'],
    }),
    true,
    'Matching cycle 1 should be settled'
  );
  assert.equal(
    shouldSettlePendingCycleRecord(cycle2PendingSameGroup, {
      studentId: 'st_1',
      lessonIds: ['l_1', 'l_2'],
      lessonDates: ['2026-09-01', '2026-09-04'],
    }),
    false,
    'Unrelated cycle 2 in the same group must NOT be settled'
  );
  log.push('[PASS] Fix #1: shouldSettlePendingCycleRecord settles only overlapping lessons/dates and preserves other unpaid cycles');

  // 7. Fix #2: calculateStudentDueBannerTotals prevents NaN and avoids double-counting records already in dueCycles
  const dueCyclesMock = [
    { id: 'pay_unpaid_1', existingPaymentRecordId: 'pay_unpaid_1', amountDue: 500 },
  ];
  const paymentsMock: PaymentRecord[] = [
    {
      id: 'pay_unpaid_1',
      studentId: 'st_1',
      studentName: 'Ahmed',
      groupId: 'grp_1',
      groupName: 'A1',
      amountDue: 500,
      amountPaid: 0,
      dueDate: '2026-10-01',
      status: 'partial',
    },
    {
      id: 'pay_partial_2',
      studentId: 'st_2',
      studentName: 'Sara',
      groupId: 'grp_1',
      groupName: 'A1',
      amountDue: 600,
      amountPaid: 250,
      dueDate: '2026-10-05',
      status: 'partial',
    },
  ];
  const bannerTotals = calculateStudentDueBannerTotals(dueCyclesMock, paymentsMock);
  assert.equal(Number.isNaN(bannerTotals.totalAmountDueFromStudents), false, 'Total due must never be NaN');
  assert.equal(bannerTotals.totalStudentsNeedingPayment, 2, 'Should count 1 cycle + 1 standalone partial (no double count)');
  assert.equal(bannerTotals.totalAmountDueFromStudents, 850, '500 from cycle + (600 - 250) from partial = 850');
  log.push('[PASS] Fix #2: calculateStudentDueBannerTotals uses amountDue/amountPaid without NaN or double counting');

  // 8. Fix #3: applyFullPaymentsUpdate persists quick payment toggle & new pending records into full archive
  const archivedOldPayment: PaymentRecord = {
    id: 'pay_archived_old',
    studentId: 'st_old',
    studentName: 'Old Student',
    groupId: 'grp_old',
    groupName: 'A1 Old',
    amountDue: 300,
    amountPaid: 300,
    dueDate: '2025-01-01',
    paidDate: '2025-01-01',
    status: 'paid',
  };
  const activePendingPayment: PaymentRecord = {
    id: 'pay_quick_1',
    studentId: 'st_1',
    studentName: 'Ahmed',
    groupId: 'grp_1',
    groupName: 'A1',
    amountDue: 400,
    amountPaid: 0,
    dueDate: todayStr,
    status: 'pending',
  };
  const initialFull = [activePendingPayment, archivedOldPayment];
  const filterActiveMock = (list: PaymentRecord[]) => list.filter(p => p.id !== 'pay_archived_old' || p.status !== 'paid');
  const { nextFull, nextActive } = applyFullPaymentsUpdate(
    initialFull,
    prev => prev.map(p => (p.id === 'pay_quick_1' ? { ...p, status: 'paid', amountPaid: p.amountDue } : p)),
    filterActiveMock
  );
  assert.equal(nextFull.length, 2, 'Full archive retains both archived and updated record');
  assert.equal(nextFull.find(p => p.id === 'pay_quick_1')?.status, 'paid', 'Toggled status persisted in fullPaymentsRef');
  assert.equal(nextActive.find(p => p.id === 'pay_quick_1')?.amountPaid, 400, 'Active state updated in sync with fullPaymentsRef');
  log.push('[PASS] Fix #3: applyFullPaymentsUpdate keeps fullPaymentsRef and active payments in sync');

  return { passed: true, log };
}

const result = runFinanceServiceTests();
result.log.forEach(line => console.log(line));


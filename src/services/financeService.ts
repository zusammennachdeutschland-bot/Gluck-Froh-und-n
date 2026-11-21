import { FinanceAccount, FinanceTransaction, PaymentRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Pure, deterministic calculation of an account's financial balance based on the ledger.
 * Single Source of Truth: FinanceTransactions
 */
export const computeAccountBalance = (
  account: FinanceAccount,
  transactions: FinanceTransaction[]
): number => {
  if (!account) return 0;
  
  // Baseline initial balance (safeguard for migrated or newly created accounts)
  const initial = account.initialBalance !== undefined 
    ? account.initialBalance 
    : (account.openingBalance !== undefined ? account.openingBalance : 0);
  
  let balance = initial;
  
  if (!Array.isArray(transactions)) {
    return Math.round(balance * 100) / 100;
  }

  // Iterate deterministically through all non-deleted transactions
  for (const tx of transactions) {
    if (!tx || tx.deleted) continue;

    if (tx.type === 'income' || tx.type === 'investment_return') {
      if (tx.accountId === account.id) {
        balance += tx.amount || 0;
      }
    } else if (tx.type === 'expense') {
      if (tx.accountId === account.id) {
        balance -= tx.amount || 0;
      }
    } else if (tx.type === 'adjustment') {
      if (tx.accountId === account.id) {
        // Positive adjustment increases balance, negative adjustment decreases balance
        balance += tx.amount || 0;
      }
    } else if (tx.type === 'transfer') {
      if (tx.accountId === account.id) {
        balance -= tx.amount || 0;
      }
      if (tx.toAccountId === account.id) {
        balance += tx.amount || 0;
      }
    }
  }

  return Math.round(balance * 100) / 100;
};

/**
 * Recomputes and updates the cached currentBalance for all accounts deterministically.
 */
export const recalculateAllAccountBalances = (
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[]
): FinanceAccount[] => {
  if (!accounts || !Array.isArray(accounts)) return [];
  const safeTxs = Array.isArray(transactions) ? transactions : [];

  return accounts.map(acc => {
    const safeAccount = { ...acc };
    // Baseline safeguard: preserve initialBalance if undefined
    if (safeAccount.initialBalance === undefined) {
      if (safeAccount.openingBalance !== undefined) {
        safeAccount.initialBalance = safeAccount.openingBalance;
      } else if (safeAccount.currentBalance !== undefined) {
        safeAccount.initialBalance = safeAccount.currentBalance;
      } else {
        safeAccount.initialBalance = 0;
      }
    }

    const derivedBalance = computeAccountBalance(safeAccount, safeTxs);
    return {
      ...safeAccount,
      currentBalance: derivedBalance,
    };
  });
};

export const calculateAccountPerformance = (
  accountId: string,
  transactions: FinanceTransaction[]
) => {
  const now = new Date();
  
  // Use Cairo timezone explicitly
  const cairoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const todayPrefix = `${cairoNow.getFullYear()}-${String(cairoNow.getMonth() + 1).padStart(2, '0')}-${String(cairoNow.getDate()).padStart(2, '0')}`;
  const monthPrefix = `${cairoNow.getFullYear()}-${String(cairoNow.getMonth() + 1).padStart(2, '0')}`;

  const accountTxs = transactions.filter(
    tx => !tx.deleted && (tx.accountId === accountId || tx.toAccountId === accountId)
  );

  let todayChange = 0;
  let monthChange = 0;

  for (const tx of accountTxs) {
    if (!tx.date) continue;
    
    // Parse using string prefixes (safe, avoids timezone shift bugs)
    const isToday = tx.date.startsWith(todayPrefix);
    const isThisMonth = tx.date.startsWith(monthPrefix);
    
    // Calculate effective amount for THIS account
    let effectiveAmount = 0;
    
    if (tx.type === 'income' || tx.type === 'investment_return' || (tx.type === 'adjustment' && tx.amount > 0)) {
        if (tx.accountId === accountId) effectiveAmount = tx.amount;
    } else if (tx.type === 'expense' || (tx.type === 'adjustment' && tx.amount < 0)) {
        if (tx.accountId === accountId) effectiveAmount = -Math.abs(tx.amount);
    } else if (tx.type === 'transfer') {
        if (tx.accountId === accountId) effectiveAmount = -tx.amount;
        if (tx.toAccountId === accountId) effectiveAmount = tx.amount;
    }

    if (isToday) todayChange += effectiveAmount;
    if (isThisMonth) monthChange += effectiveAmount;
  }

  // Round to 2 decimal places to avoid floating point issues
  todayChange = Math.round(todayChange * 100) / 100;
  monthChange = Math.round(monthChange * 100) / 100;

  return { todayChange, monthChange };
};

export const calculateTodaysIncome = (transactions: FinanceTransaction[]) => {
  const now = new Date();
  const cairoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const todayPrefix = `${cairoNow.getFullYear()}-${String(cairoNow.getMonth() + 1).padStart(2, '0')}-${String(cairoNow.getDate()).padStart(2, '0')}`;

  let todayIncome = 0;
  for (const tx of transactions) {
    if (!tx.deleted && tx.date && tx.date.startsWith(todayPrefix)) {
      if (tx.type === 'income' || tx.type === 'investment_return') {
        todayIncome += tx.amount;
      }
    }
  }

  return Math.round(todayIncome * 100) / 100;
};

/**
 * Fix #1: Determines whether an existing pending payment record belongs to the exact cycle being settled
 * (by overlapping non-virtual lessonIds or lessonDates), preventing unrelated cycles in the same group from being settled.
 */
export const shouldSettlePendingCycleRecord = (
  record: PaymentRecord,
  paidCycle: { studentId: string; lessonIds?: string[]; lessonDates?: string[] }
): boolean => {
  if (record.studentId !== paidCycle.studentId) return false;
  const st = String(record.status || '');
  if (st !== 'not_yet' && st !== 'pending' && st !== 'unpaid') return false;

  const targetIds = new Set((paidCycle.lessonIds || []).filter(id => !id.startsWith('virtual_')));
  const overlapsIds = Boolean(record.lessonIds && record.lessonIds.some(id => targetIds.has(id)));
  const overlapsDates = Boolean(
    record.lessonDates &&
    paidCycle.lessonDates &&
    record.lessonDates.some(d => paidCycle.lessonDates!.includes(d))
  );

  return overlapsIds || overlapsDates;
};

/**
 * Fix #2: Computes total students needing payment and total amount due without double-counting records
 * already represented in dueCycles and using amountDue/amountPaid so NaN never occurs.
 */
export const calculateStudentDueBannerTotals = (
  dueCycles: { id: string; existingPaymentRecordId?: string; amountDue?: number }[],
  payments: PaymentRecord[]
): { totalStudentsNeedingPayment: number; totalAmountDueFromStudents: number } => {
  const safeCycles = Array.isArray(dueCycles) ? dueCycles : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const coveredRecordIds = new Set<string>();
  for (const cycle of safeCycles) {
    if (cycle.id) coveredRecordIds.add(cycle.id);
    if (cycle.existingPaymentRecordId) coveredRecordIds.add(cycle.existingPaymentRecordId);
  }

  const standalonePendingList = safePayments.filter(p => {
    const st = String(p.status || '');
    return !p.deleted && (st === 'not_paid' || st === 'partial') && !coveredRecordIds.has(p.id);
  });

  const cycleTotal = safeCycles.reduce((sum, c) => sum + (Number(c.amountDue) || 0), 0);
  const pendingTotal = standalonePendingList.reduce((sum, p) => {
    const legacyRec = p as PaymentRecord & { amount?: number; paidAmount?: number };
    const due = Number(legacyRec.amountDue ?? legacyRec.amount ?? 0) || 0;
    const paid = Number(legacyRec.amountPaid ?? legacyRec.paidAmount ?? 0) || 0;
    return sum + Math.max(0, due - paid);
  }, 0);

  return {
    totalStudentsNeedingPayment: safeCycles.length + standalonePendingList.length,
    totalAmountDueFromStudents: Math.round((cycleTotal + pendingTotal) * 100) / 100,
  };
};

/**
 * Fix #3: Applies a payment state updater to the full archive list as well as active RAM state,
 * ensuring quick toggles and pending cycle records are never lost on subsequent archive syncs.
 */
export const applyFullPaymentsUpdate = (
  fullPayments: PaymentRecord[],
  updater: (prev: PaymentRecord[]) => PaymentRecord[],
  filterActive: (all: PaymentRecord[]) => PaymentRecord[]
): { nextFull: PaymentRecord[]; nextActive: PaymentRecord[] } => {
  const nextFull = updater(fullPayments);
  const nextActive = filterActive(nextFull);
  return { nextFull, nextActive };
};

/**
 * Task 4: Splits a package payment across `count` lessons so that the per-lesson amounts
 * sum to `amountPaid` exactly (putting any rounding remainder on the last lesson).
 */
export const splitPaymentAcrossLessons = (amountPaid: number, count: number): number[] => {
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const safeTotal = round2(Number(amountPaid) || 0);
  if (!Number.isFinite(count) || count <= 1) {
    return [safeTotal];
  }
  const n = Math.floor(count);
  const isIntegerTotal = Number.isInteger(safeTotal);
  const baseShare = isIntegerTotal
    ? Math.floor(safeTotal / n)
    : Math.floor((safeTotal * 100) / n) / 100;
  const shares: number[] = [];
  let allocated = 0;
  for (let i = 0; i < n - 1; i++) {
    shares.push(baseShare);
    allocated = round2(allocated + baseShare);
  }
  shares.push(round2(safeTotal - allocated));
  return shares;
};

